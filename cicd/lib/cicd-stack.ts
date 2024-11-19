import { Stack, StackProps, SecretValue } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { BranchConfig } from '../bin/cicd'
import * as codepipeline from 'aws-cdk-lib/aws-codepipeline';
import * as codepipelineActions from 'aws-cdk-lib/aws-codepipeline-actions';
import * as codebuild from 'aws-cdk-lib/aws-codebuild';
import * as iam from 'aws-cdk-lib/aws-iam';

interface BatchCICDStackProps extends StackProps {
  branch: string,
  branchConfig: BranchConfig
}

export class BatchCICDStack extends Stack {
  constructor(scope: Construct, id: string, props: BatchCICDStackProps) {
    super(scope, id, props);

    const { branch, branchConfig } = props;

    const projects = ['velho-integration']

    projects.forEach((project) => {
      this.createPipelineForProject(project, branch, branchConfig);
    });
  }

  private createPipelineForProject(project: string, branch: string, branchConfig: BranchConfig) {

    const { env, account, region } = branchConfig;
    const sourceOutput = new codepipeline.Artifact();

    const sourceAction = new codepipelineActions.GitHubSourceAction({
      actionName: `${env}-${project}-source-action`,
      owner: 'finnishtransportagency',
      repo: 'digiroad-batch',
      branch,
      oauthToken: SecretValue.secretsManager('GITHUB_PAT'),
      output: sourceOutput,
    });

    const buildProject = new codebuild.PipelineProject(this, `${env}-${project}-build`, {
      projectName: `${env}-${project}-build`,
      environment: {
        buildImage: codebuild.LinuxBuildImage.STANDARD_7_0,
      },
      buildSpec: codebuild.BuildSpec.fromObject({
        version: '0.2',
        phases: {
          install: {
            commands: [
              `cd ${project}`,
              'npm install',
              'npm install -g aws-cdk',
            ],
          },
          build: {
            commands: [
              `cdk synth --context branch=${branch} --context env=${env} --context account=${account} --context region=${region}`,
              `cdk deploy --require-approval never --context branch=${branch} --context env=${env} --context account=${account} --context region=${region}`,
            ],
          },
        },
      }),
    });

    buildProject.role?.addManagedPolicy(iam.ManagedPolicy.fromManagedPolicyArn(this, 'cicdAdminPolicy', 'arn:aws:iam::aws:policy/AdministratorAccess'))

    const buildAction = new codepipelineActions.CodeBuildAction({
      actionName: `${env}-${project}-build-action`,
      project: buildProject,
      input: sourceOutput,
    });

    new codepipeline.Pipeline(this, `${env}-${project}-pipeline`, {
      pipelineName: `${env}-${project}-pipeline`,
      stages: [
        {
          stageName: 'Source',
          actions: [sourceAction],
        },
        {
          stageName: 'Build_and_Deploy',
          actions: [buildAction],
        },
      ],
    });
  }
}
