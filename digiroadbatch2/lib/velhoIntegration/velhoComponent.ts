import {Duration, Stack} from "aws-cdk-lib";
import {IVpc, SelectedSubnets} from "aws-cdk-lib/aws-ec2";
import {NodejsFunction} from "aws-cdk-lib/aws-lambda-nodejs";
import {Runtime} from "aws-cdk-lib/aws-lambda";
import {StringParameter} from "aws-cdk-lib/aws-ssm";
import {Parallel, StateMachine, TaskInput} from "aws-cdk-lib/aws-stepfunctions";
import {LambdaInvoke} from "aws-cdk-lib/aws-stepfunctions-tasks";
import {LogGroup, RetentionDays} from "aws-cdk-lib/aws-logs";

export function velhoIntegraiont(context: Stack,vpc: IVpc, vpcSubnets: SelectedSubnets, ENV: string) {
    const fetchAndProcess = new NodejsFunction(context, 'FetchAndProcess', {
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
    StringParameter.fromStringParameterAttributes(context, 'dbName', {
        parameterName: `/${ENV}/bonecp.databasename`
    }).grantRead(fetchAndProcess)
    StringParameter.fromStringParameterAttributes(context, 'dbUser', {
        parameterName: `/${ENV}/bonecp.username`
    }).grantRead(fetchAndProcess)
    StringParameter.fromStringParameterAttributes(context, 'dbHost', {
        parameterName: `/${ENV}/bonecp.host`
    }).grantRead(fetchAndProcess)
    StringParameter.fromStringParameterAttributes(context, 'velhoUser', {
        parameterName: `/${ENV}/velho-prod.username`
    }).grantRead(fetchAndProcess)
    StringParameter.fromSecureStringParameterAttributes(context, 'velhoPass', {
        parameterName: `/${ENV}/velho-prod.password`
    }).grantRead(fetchAndProcess)
    StringParameter.fromSecureStringParameterAttributes(context, 'db.pw', {
        parameterName: `/${ENV}/bonecp.password`,
    }).grantRead(fetchAndProcess)


    // states
    const ELYs = ["16", "15", "13", "11", "10", "08", "05", "06", "01", "02"]
    const parallelProcessState = new Parallel(this, 'parallelFetchAndProcess', {})
    for (const ely of ELYs) {
        parallelProcessState.branch(new LambdaInvoke(this, `singleFetchAndProcess-${ely}`, {
            lambdaFunction: fetchAndProcess, payload: TaskInput.fromObject({ely})
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
    return fetchAndProcessStateMachine;
}