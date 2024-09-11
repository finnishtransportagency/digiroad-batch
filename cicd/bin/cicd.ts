#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { BatchCICDStack } from '../lib/cicd-stack';

export interface BranchConfig {
  env: string;
  account: string;
  region: string;
}

const app = new cdk.App();

const branchToContext: { [branch: string]: BranchConfig } = {
  "development": { env: "dev", account: "475079312496", region: "eu-west-1" }
};

const branch = app.node.tryGetContext('branch')

if (!branch || !(branch in branchToContext)) {
  throw new Error(`Branch name '${branch}' is not recognized.`);
}

new BatchCICDStack(app, `${branchToContext[branch].env}-BatchCICDStack`, {
  branchEnvMap: branchToContext,
  allowedBranches: Object.keys(branchToContext),
});