import { Stack, StackProps, SecretValue } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { BranchConfig } from '../bin/cicd'
import * as codepipeline from 'aws-cdk-lib/aws-codepipeline';
import * as codepipelineActions from 'aws-cdk-lib/aws-codepipeline-actions';
import * as codebuild from 'aws-cdk-lib/aws-codebuild';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import * as iam from 'aws-cdk-lib/aws-iam';

interface BatchCICDStackProps extends StackProps {
  branchEnvMap: { [branch: string]: BranchConfig };
  allowedBranches: string[];
}

export class BatchCICDStack extends Stack {
  constructor(scope: Construct, id: string, props: BatchCICDStackProps) {
    super(scope, id, props);

    const { branchEnvMap, allowedBranches } = props;

    const projects = ['velho-integration']

    projects.forEach((project) => {
      this.createPipelineForProject(project, branchEnvMap, allowedBranches);
    });
  }
  
  private createPipelineForProject(project:string, branchEnvMap: { [branch: string]: BranchConfig }, allowedBranches: string[]) {
    allowedBranches.forEach((branch) => {
      const { env, account, region } = branchEnvMap[branch];
      const sourceOutput = new codepipeline.Artifact();

      const assetsBucket = s3.Bucket.fromBucketName(this, 'AssetsBucket', 'cdk-hnb659fds-assets-475079312496-eu-west-1');
      const bootstrapVersion = ssm.StringParameter.fromStringParameterName(this, 'BootstrapVersion', '/cdk-bootstrap/hnb659fds/version');

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
                'cdk synth',
                `cdk deploy --require-approval never --context branch=${branch} --context env=${env} --context account=${account} --context region=${region}`,
              ],
            },
          },
        }),
        role: new iam.Role(this, 'BuildProjectRole', {
          assumedBy: new iam.ServicePrincipal('codebuild.amazonaws.com'),
          inlinePolicies: {
            assumeRolePolicy: new iam.PolicyDocument({
              statements: [
                new iam.PolicyStatement({
                  actions: ['sts:AssumeRole'],
                  resources: [
                    'arn:aws:iam::*:role/cdk-hnb659fds-deploy-role-*',
                    'arn:aws:iam::*:role/cdk-hnb659fds-file-publishing-role-*',
                  ],
                }),
              ],
            }),
          },
        }),  
      });

      assetsBucket.grantReadWrite(buildProject.role!);
      bootstrapVersion.grantRead(buildProject.role!);  

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
    })
  }
}