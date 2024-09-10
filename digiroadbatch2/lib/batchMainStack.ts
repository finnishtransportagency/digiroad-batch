import { Duration, Stack, StackProps } from "aws-cdk-lib";
import {IVpc, SelectedSubnets, SubnetType, Vpc} from "aws-cdk-lib/aws-ec2";
import { Rule, Schedule } from "aws-cdk-lib/aws-events";
import { SfnStateMachine } from "aws-cdk-lib/aws-events-targets";
import { Runtime } from "aws-cdk-lib/aws-lambda";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import { LogGroup, RetentionDays } from "aws-cdk-lib/aws-logs";
import { StringParameter } from "aws-cdk-lib/aws-ssm";
import { Parallel, StateMachine, TaskInput } from "aws-cdk-lib/aws-stepfunctions";
import { LambdaInvoke } from "aws-cdk-lib/aws-stepfunctions-tasks";
import { Construct } from "constructs";
import {velhoIntegraiont} from "./velhoIntegration/velhoComponent";



export class BatchMainStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const ENV = 'dev'

    const vpcId = StringParameter.valueFromLookup(this, `/${ENV}/vpcid`);
    const vpc = Vpc.fromLookup(this, vpcId, { vpcId });
    const vpcSubnets = vpc.selectSubnets({
      subnetType: SubnetType.PRIVATE_WITH_EGRESS
    });
    // tähän erilaisia ajastuksia ja muuta räätälöintiä tukemaan ajastusta
    const eventRule = new Rule(this, 'mondayIntegrationRoutine', {
      schedule: Schedule.cron({ weekDay: 'MON', hour: '5', minute: '0' }),
    });
    eventRule.addTarget(new SfnStateMachine(velhoIntegraiont(this, vpc, vpcSubnets, ENV)));
  }
}
