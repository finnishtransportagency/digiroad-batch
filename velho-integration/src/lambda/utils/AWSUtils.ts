import {GetParameterCommand, SSMClient} from "@aws-sdk/client-ssm";
import {Client, ClientConfig} from "pg";

const ssm = new SSMClient({ region: process.env.AWS_REGION });

export const getVelhoBaseUrl = async () => (await ssm.send(new GetParameterCommand({ Name: 'velhoLatauspalveluBaseUrl' }))).Parameter?.Value
export const getVkmApiKey = async () => (await ssm.send(new GetParameterCommand({ Name: '/prod/apikey/viitekehysmuunnin', WithDecryption: true }))).Parameter?.Value

export const getClient = async (): Promise<Client> => {
    const config: ClientConfig = {
        user: (await ssm.send(new GetParameterCommand({ Name: `/${process.env.ENV}/bonecp.username` }))).Parameter?.Value,
        host: (await ssm.send(new GetParameterCommand({ Name: `/${process.env.ENV}/bonecp.host` }))).Parameter?.Value,
        database: (await ssm.send(new GetParameterCommand({ Name: `/${process.env.ENV}/bonecp.databasename` }))).Parameter?.Value,
        password: (await ssm.send(new GetParameterCommand({ Name: `/${process.env.ENV}/bonecp.password`, WithDecryption: true }))).Parameter?.Value,
        port: 5432,
    }
    return new Client(config)
}

export const authenticate = async () => {
    const user = (await ssm.send(new GetParameterCommand({ Name: `/${process.env.ENV}/velho-prod.username` }))).Parameter?.Value
    const password = (await ssm.send(new GetParameterCommand({ Name: `/${process.env.ENV}/velho-prod.password`, WithDecryption: true }))).Parameter?.Value

    const response = await fetch('https://vayla-velho-prd.auth.eu-west-1.amazoncognito.com/oauth2/token', {
        method: 'POST',
        headers: {
            'Authorization': 'Basic ' + Buffer.from(user + ':' + password).toString('base64'),
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: 'grant_type=client_credentials',
    })

    const data = await response.json() as { access_token: string }
    return data.access_token
}