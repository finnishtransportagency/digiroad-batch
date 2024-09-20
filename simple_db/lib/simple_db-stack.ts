import * as cdk from 'aws-cdk-lib';
import { Duration } from 'aws-cdk-lib';
import { SubnetType, Vpc } from 'aws-cdk-lib/aws-ec2';
import { Rule, Schedule } from 'aws-cdk-lib/aws-events';
import { SfnStateMachine } from 'aws-cdk-lib/aws-events-targets';
import { Runtime } from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { LogGroup, RetentionDays } from 'aws-cdk-lib/aws-logs';
import { StringParameter } from 'aws-cdk-lib/aws-ssm';
import { DefinitionBody, StateMachine } from 'aws-cdk-lib/aws-stepfunctions';
import { LambdaInvoke } from 'aws-cdk-lib/aws-stepfunctions-tasks';
import { Construct } from 'constructs';
// import * as sqs from 'aws-cdk-lib/aws-sqs';

export class SimpleDbStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const ENV = 'dev'

    const vpcId = 'vpc-0f430b7fedef04ba3' //StringParameter.valueFromLookup(this, `vpcId`);
    const vpc = Vpc.fromLookup(this, vpcId, { vpcId });
    const vpcSubnets = vpc.selectSubnets({
      subnetType: SubnetType.PRIVATE_WITH_EGRESS
    });


    const state = (name:string, dir='point/') => {
      const lambdaFunction = new NodejsFunction(this, 'Lambda_'+name, {
        vpc,
        vpcSubnets,
        runtime: Runtime.NODEJS_20_X,
        timeout: Duration.seconds(300),
        entry: `./src/lambda/${dir+name}.ts`,
        handler: 'handler',
        bundling: {
          minify: true,
        },
        environment: {
          ENV
        }
      });
      StringParameter.fromSecureStringParameterAttributes(this, `${name}_db.pw`, {
        parameterName: `/${ENV}/bonecp.password`,
      }).grantRead(lambdaFunction)
      StringParameter.fromStringParameterAttributes(this, `${name}_dbName`, {
        parameterName: `/${ENV}/bonecp.databasename`
      }).grantRead(lambdaFunction)
      StringParameter.fromStringParameterAttributes(this, `${name}_dbUser`, {
        parameterName: `/${ENV}/bonecp.username`
      }).grantRead(lambdaFunction)
      StringParameter.fromStringParameterAttributes(this, `${name}_dbHost`, {
        parameterName: `/${ENV}/bonecp.host`
      }).grantRead(lambdaFunction)
  
      return new LambdaInvoke(this, `${name}_state`, {
        lambdaFunction
      });

    }


    // flow
    const definition = 
      //state('create_schema','')
      state('10_joukkoliikenteen_pysakki')
        .next(state('200_suojatie'))                 
        .next(state('220_esterakennelma'))           
        .next(state('230_rautatien_tasoristeys'))         
        .next(state('240_opastaulu_ja_sen_informaatio'))  
        .next(state('250_palvelupiste'))
        .next(state('280_liikennevalo'))
        .next(state('300_liikennemerkki'))
        .next(state('120_tien_leveys', 'vector/'))

    // state machine
    const statemachineLogs = new LogGroup(this, 'fetchAndProcess', {
      retention: RetentionDays.SIX_MONTHS
    });

    const fetchAndProcessStateMachine = new StateMachine(this, 'sm', {
      definitionBody: DefinitionBody.fromChainable(definition),
      stateMachineName: 'simple_db_converter',
      logs: {
        destination: statemachineLogs,
        includeExecutionData: true
      }
    });

    const eventRule = new Rule(this, 'nightlyRoutine', {
      schedule: Schedule.cron({ hour: '3', minute: '0' }),
    });
    eventRule.addTarget(new SfnStateMachine(fetchAndProcessStateMachine));
  }
}
