import { Duration, Stack, StackProps } from "aws-cdk-lib";
import { SubnetType, Vpc } from "aws-cdk-lib/aws-ec2";
import { Rule, Schedule } from "aws-cdk-lib/aws-events";
import { SfnStateMachine } from "aws-cdk-lib/aws-events-targets";
import { Runtime } from "aws-cdk-lib/aws-lambda";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import { LogGroup, RetentionDays } from "aws-cdk-lib/aws-logs";
import { StringParameter } from "aws-cdk-lib/aws-ssm";
import { Parallel, StateMachine, TaskInput } from "aws-cdk-lib/aws-stepfunctions";
import { LambdaInvoke } from "aws-cdk-lib/aws-stepfunctions-tasks";
import { Construct } from "constructs";

export class VelhoIntegrationStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const ENV = 'dev'

    const vpcId = StringParameter.valueFromLookup(this, `/${ENV}/vpcid`);
    const vpc = Vpc.fromLookup(this, vpcId, { vpcId });
    const vpcSubnets = vpc.selectSubnets({
      subnetType: SubnetType.PRIVATE_WITH_EGRESS
    });

    const fetchAndProcess = new NodejsFunction(this, 'FetchAndProcess', {
      vpc,
      vpcSubnets,
      runtime: Runtime.NODEJS_20_X,
      timeout: Duration.seconds(300),
      memorySize: 256,
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
    StringParameter.fromStringParameterAttributes(this, 'velhoUser', {
      parameterName: `/${ENV}/velho-prod.username`
    }).grantRead(fetchAndProcess)
    StringParameter.fromSecureStringParameterAttributes(this, 'velhoPass', {
      parameterName: `/${ENV}/velho-prod.password`
    }).grantRead(fetchAndProcess)
    StringParameter.fromSecureStringParameterAttributes(this, 'db.pw', {
      parameterName: `/${ENV}/bonecp.password`,
    }).grantRead(fetchAndProcess)

 

    // states
    const ELYs = ["16", "15", "13", "11", "10", "08", "05", "06", "01", "02"]
    const parallelProcessState = new Parallel(this, 'parallelFetchAndProcess', { })
    for (const ely of ELYs) {
      parallelProcessState.branch(new LambdaInvoke(this, `singleFetchAndProcess-${ely}`, {
        lambdaFunction: fetchAndProcess, payload: TaskInput.fromObject({ ely })
      }))
    }

    // flow
    const definition = parallelProcessState

    // state machine
    const statemachineLogs = new LogGroup(this, 'fetchAndProcess', {
      retention: RetentionDays.SIX_MONTHS
    });

    const fetchAndProcessStateMachine = new StateMachine(this, 'sm', {
      definition,
      stateMachineName: 'velho_weekly_fetch',
      logs: {
        destination: statemachineLogs,
        includeExecutionData: true
      }
    });

     const eventRule = new Rule(this, 'mondayIntegrationRoutine', {
      schedule: Schedule.cron({ weekDay: 'MON', hour: '5', minute: '0' }),
    });
    eventRule.addTarget(new SfnStateMachine(fetchAndProcessStateMachine));
  }
}
