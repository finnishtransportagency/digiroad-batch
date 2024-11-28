import {GetParameterCommand, SSMClient} from "@aws-sdk/client-ssm";
import {Client, ClientConfig} from "pg";

const delay = async (delayTimeMs: number) => new Promise((resolve) => setTimeout(resolve, delayTimeMs));

export const retry = async <T>(
    fn: () => Promise<T>,
    retryIfTest?: (err: Error) => boolean,
    retries = 3,
    delayTimeMs = 5000,
    err?: Error
): Promise<T> => {
    if (!retries) {
        return Promise.reject(err);
    }
    return fn().catch((err: Error) => {
        console.log('err', err);
        if (!retryIfTest || retryIfTest(err)) {
            console.log(`Retries left: ${retries}`);
            return delay(delayTimeMs).then(() => retry(fn, retryIfTest, retries - 1, delayTimeMs, err));
        }
        throw err;
    });
};

export const retryTimeout = async <T>(fn: () => Promise<T>, retries = 3, delayTimeMs = 5000): Promise<T> => {
    const timeoutTest = (err: Error) => {
        if ('code' in err) return (err as unknown as { code: string }).code === 'ETIMEDOUT'
        return err.message.includes('network timeout');
    }
    return retry(fn, timeoutTest, retries, delayTimeMs);
};

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

export const fetchMunicipalities = async (ely: string): Promise<number[]> => {
    const client = await getClient()
    try {
        await client.connect()
        const sql = `select id from municipality where ely_nro = ${Number(ely)};`
        const query = {
            text: sql,
            rowMode: 'array',
        }
        const result = await client.query(query)
        return result.rows.map((row: [number]) => row[0])
    } catch (err) {
        console.log('err', err)
    } finally {
        await client.end()
    }
    throw '500: something weird happened'
}

// When using in promise, you should be mindfull what you are measuring, are you measuring resolving of promise or actual operation.
// Best to use in non async method.
export const timer = <R>(operationName: string, operation: () => R): R => {
    const begin = performance.now();
    try {
        const result = operation();
        const duration = performance.now() - begin;
        console.log(`Call to ${operationName} took: ${(duration / 1000).toFixed(4)} s.`);
        return result;
    } catch (e: any) {
        const duration = performance.now() - begin;
        console.log(`Call to ${operationName} failed at ${(duration / 1000).toFixed(4)} s.`,e);
        throw e;
    }

};