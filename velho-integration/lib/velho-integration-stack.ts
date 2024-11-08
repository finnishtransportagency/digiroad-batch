import { Duration, Stack, StackProps } from "aws-cdk-lib";
import { SubnetType, Vpc } from "aws-cdk-lib/aws-ec2";
import { Rule, Schedule } from "aws-cdk-lib/aws-events";
import { SfnStateMachine } from "aws-cdk-lib/aws-events-targets";
import { Runtime } from "aws-cdk-lib/aws-lambda";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import { LogGroup, RetentionDays } from "aws-cdk-lib/aws-logs";
import { StringParameter } from "aws-cdk-lib/aws-ssm";
import { Parallel, StateMachine, TaskInput, Chain, Pass } from "aws-cdk-lib/aws-stepfunctions";
import { LambdaInvoke, SnsPublish } from "aws-cdk-lib/aws-stepfunctions-tasks";
import { Construct } from "constructs";
import { Topic } from "aws-cdk-lib/aws-sns";
import { EmailSubscription } from "aws-cdk-lib/aws-sns-subscriptions";

interface VelhoIntegrationStackProps extends StackProps {
  envName: string
}

export class VelhoIntegrationStack extends Stack {
  constructor(scope: Construct, id: string, props: VelhoIntegrationStackProps) {
    super(scope, id, props);

    const ENV = props.envName

    const vpcId = StringParameter.valueFromLookup(this, `/${ENV}/vpcid`);
    const vpc = Vpc.fromLookup(this, vpcId, { vpcId });
    const vpcSubnets = vpc.selectSubnets({
      subnetType: SubnetType.PRIVATE_WITH_EGRESS
    });

    const fetchAndProcess = new NodejsFunction(this, `${ENV}-FetchAndProcess`, {
      vpc,
      vpcSubnets,
      runtime: Runtime.NODEJS_20_X,
      timeout: Duration.seconds(600),
      memorySize: 1024,
      entry: './src/lambda/fetchAndProcess.ts',
      handler: 'handler',
      bundling: {
        minify: true,
      },
      environment: {
        ENV
      }
    });
    StringParameter.fromStringParameterAttributes(this, 'dbName', {
      parameterName: `/${ENV}/bonecp.databasename`
    }).grantRead(fetchAndProcess)
    StringParameter.fromStringParameterAttributes(this, 'dbUser', {
      parameterName: `/${ENV}/bonecp.username`
    }).grantRead(fetchAndProcess)
    StringParameter.fromStringParameterAttributes(this, 'dbHost', {
      parameterName: `/${ENV}/bonecp.host`
    }).grantRead(fetchAndProcess)
    StringParameter.fromSecureStringParameterAttributes(this, 'db.pw', {
      parameterName: `/${ENV}/bonecp.password`,
    }).grantRead(fetchAndProcess)
    StringParameter.fromStringParameterAttributes(this, 'velhoBaseUrl', {
      parameterName: 'velhoLatauspalveluBaseUrl'
    }).grantRead(fetchAndProcess)
    StringParameter.fromStringParameterAttributes(this, 'velhoUser', {
      parameterName: `/${ENV}/velho-prod.username`
    }).grantRead(fetchAndProcess)
    StringParameter.fromSecureStringParameterAttributes(this, 'velhoPass', {
      parameterName: `/${ENV}/velho-prod.password`
    }).grantRead(fetchAndProcess)
    StringParameter.fromSecureStringParameterAttributes(this, 'vkm.apikey', {
      parameterName: '/prod/apikey/viitekehysmuunnin',
    }).grantRead(fetchAndProcess)

    const failureNotificationTopic = new Topic(this, `${ENV}-VelhoIntegrationFailureTopic`);
    failureNotificationTopic.addSubscription(new EmailSubscription('kehitys@digiroad.fi'))

    // states
    const ELYs = ["15", "13", "11", "10", "08", "05", "06", "01", "02"];
    const assets = [
      { asset_name: "lit_road", asset_type_id: 100, asset_type: "Linear", paths: ["varusteet/valaistukset"] },
      { asset_name: "paved_road", asset_type_id: 110, asset_type: "Linear", paths: ["paallyste-ja-pintarakenne/sitomattomat-pintarakenteet", "paallyste-ja-pintarakenne/ladottavat-pintarakenteet", "paallyste-ja-pintarakenne/sidotut-paallysrakenteet", "paallyste-ja-pintarakenne/pintaukset", "paallyste-ja-pintarakenne/muut-pintarakenteet"] },
      { asset_name: "pedestrian_crossing", asset_type_id: 200, asset_type: "Point", paths: ["kohdepisteet-ja-valit/suojatiet"] },
      { asset_name: "traffic_sign", asset_type_id: 300, asset_type: "Point", paths: ["varusteet/liikennemerkit"] }
    ];

    let chain: Chain | undefined = undefined;

    for (const ely of ELYs) {
      const parallelAssets = new Parallel(this, `${ENV}-ParallelAssets-${ely}`);

      for (const asset of assets) {
        const currentTask = new LambdaInvoke(this, `${ENV}-singleFetchAndProcess-${ely}-${asset.asset_name}`, {
          lambdaFunction: fetchAndProcess,
          payload: TaskInput.fromObject({
            ely,
            asset_name: asset.asset_name,
            asset_type_id: asset.asset_type_id,
            asset_type: asset.asset_type,
            paths: asset.paths,
          }),
        });

        const snsTask = new SnsPublish(this, `${ENV}-NotifyFailure-${ely}-${asset.asset_name}`, {
          topic: failureNotificationTopic,
          message: TaskInput.fromText(`${ENV}-Velho integration failed for ely: ${ely}, asset: ${asset.asset_name}`),
        });

        const passTask = new Pass(this, `${ENV}-Pass-${ely}-${asset.asset_name}`, {
          result: TaskInput.fromObject({ message: `Passing ely ${ely} ${asset.asset_name} because of error.` }),
        });

        snsTask.next(passTask);

        const taskWithCatch = currentTask.addCatch(snsTask, {
        });

        parallelAssets.branch(Chain.start(taskWithCatch));
      }
      if (!chain) {
        chain = Chain.start(parallelAssets);
      } else {
        chain = chain.next(parallelAssets);
      }
    }

    if (!chain) {
      throw new Error('No tasks were created in the chain.');
    }

    // flow 
    const definition = chain;

    // state machine
    const statemachineLogs = new LogGroup(this, `${ENV}-fetchAndProcessLogGroup`, {
      retention: RetentionDays.SIX_MONTHS
    });

    const fetchAndProcessStateMachine = new StateMachine(this, `${ENV}-sm`, {
      definition,
      stateMachineName: `${ENV}-velho_weekly_fetch`,
      logs: {
        destination: statemachineLogs,
        includeExecutionData: true
      }
    });

    const eventRule = new Rule(this, `${ENV}-mondayIntegrationRoutine`, {
      schedule: Schedule.cron({ weekDay: 'MON', hour: '5', minute: '0' }),
    });
    eventRule.addTarget(new SfnStateMachine(fetchAndProcessStateMachine));
  }
}