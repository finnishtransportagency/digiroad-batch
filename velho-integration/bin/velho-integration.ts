#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { VelhoIntegrationStack } from '../lib/velho-integration-stack';

const app = new cdk.App();

const envName: string | undefined = app.node.tryGetContext('env') || process.env.ENV;
const allowedEnvironments = ['dev', 'qa', 'prod']

if (!envName || !allowedEnvironments.includes(envName)) throw new Error('env not defined or valid')

const account = app.node.tryGetContext('account') || process.env.CDK_DEFAULT_ACCOUNT;
const region = app.node.tryGetContext('region') || process.env.CDK_DEFAULT_REGION;

new VelhoIntegrationStack(app, `${envName}-VelhoIntegrationStack`, {
  env: { account, region },
  envName
});