import { GetParameterCommand, SSMClient } from "@aws-sdk/client-ssm";
import { Client, ClientConfig } from "pg";

const ssm = new SSMClient({ region: process.env.AWS_REGION });

export const getClient = async (): Promise<Client> => {
    const config:ClientConfig = { 
      user: (await ssm.send(new GetParameterCommand({ Name: `/${process.env.ENV}/bonecp.username` }))).Parameter?.Value,
      host: (await ssm.send(new GetParameterCommand({ Name: `/${process.env.ENV}/bonecp.host` }))).Parameter?.Value,
      database: (await ssm.send(new GetParameterCommand({ Name: `/${process.env.ENV}/bonecp.databasename` }))).Parameter?.Value,
      password: (await ssm.send(new GetParameterCommand({ Name: `/${process.env.ENV}/bonecp.password`, WithDecryption: true }))).Parameter?.Value,
      port: 5432,
    }
    return new Client(config)
}