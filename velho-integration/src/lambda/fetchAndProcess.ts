import { SSMClient, GetParameterCommand } from "@aws-sdk/client-ssm";
import { Client, ClientConfig } from 'pg';
import { Agent, setGlobalDispatcher } from 'undici';
import { PointAssetHandler } from "./pointAssetHandler";
import { LinearAssetHandler } from "./linearAssetHandler";
import { VelhoAsset } from "./assetHandler";

const agent = new Agent({
  connect: {
    rejectUnauthorized: false
  }
})

setGlobalDispatcher(agent)

const ssm = new SSMClient({ region: process.env.AWS_REGION });

export const getClient = async (): Promise<Client> => {
    const config:ClientConfig = { 
      user: (await ssm.send(new GetParameterCommand({ Name: `/${process.env.ENV}/bonecp.username` }))).Parameter?.Value,
      host: 'velhotestdb.c8sq5c8rj3gu.eu-west-1.rds.amazonaws.com', //(await ssm.send(new GetParameterCommand({ Name: `/${process.env.ENV}/bonecp.host` }))).Parameter?.Value,
      database: (await ssm.send(new GetParameterCommand({ Name: `/${process.env.ENV}/bonecp.databasename` }))).Parameter?.Value,
      password: (await ssm.send(new GetParameterCommand({ Name: `/${process.env.ENV}/bonecp.password`, WithDecryption: true }))).Parameter?.Value,
      port: 5432,
    }
    return new Client(config)
}

const authenticate = async () => {
    const user = (await ssm.send(new GetParameterCommand({ Name: `/${process.env.ENV}/velho-prod.username` }))).Parameter?.Value
    const password = (await ssm.send(new GetParameterCommand({ Name: `/${process.env.ENV}/velho-prod.password`, WithDecryption: true }))).Parameter?.Value

    const response = await fetch('https://vayla-velho-prd.auth.eu-west-1.amazoncognito.com/oauth2/token', {
    method: 'POST',
    headers: {
      'Authorization': 'Basic ' + Buffer.from(user+':'+password).toString('base64'),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  })

  const data = await response.json() as { access_token: string }
  return data.access_token
}

const listKohdeluokka = async (token:string, target:string):Promise<{ [key:string]: string }> => {
    const response = await fetch(`https://apiv2prdvelho.vaylapilvi.fi/latauspalvelu/api/v1/${target}`, {
        method: 'GET',
        headers: {
            'Authorization': 'Bearer '+token,
        },
    });

    if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
    }

    interface Kohdeluokka {
        jaottelut: {
            "alueet/ely": {
                [ely:string]: {
                    polku: string
                }
            }
        }
    }

    const data = await response.json() as Kohdeluokka
    return Object.keys(data.jaottelut["alueet/ely"]).reduce( (acc:any, val:string) => {
        const ely = val.replace('ely/ely', '')
        acc[ely] = data.jaottelut["alueet/ely"][val].polku
        return acc
    }, {})
}

const fetchMunicipalities = async (ely: string): Promise<number[]> => {
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
    } catch (err){
        console.log('err',err)      
    } finally {
        await client.end()
    }
    throw '500: something weird happened'
} 

export const handler = async (event: { ely: string, asset_name: string, asset_type_id: number, asset_type: string, path: string }, ctx: any) => {
    console.log(`Event: ${JSON.stringify(event, null, 2)}`);
  
    const { ely, asset_name, asset_type_id, asset_type, path } = event;
    const assetHandler = asset_type === 'Point' ? new PointAssetHandler : new LinearAssetHandler

    const authToken = await authenticate()
    const ely2polku = await listKohdeluokka(authToken, `kohdeluokka/${path}`)
    if (!ely2polku[ely]) return
    const srcData = await assetHandler.fetchSourceData(authToken, ely2polku[ely]) as VelhoAsset[]
    console.log(`fetched ${srcData.length} assets from velho`)
    const municipalities = await fetchMunicipalities(ely)
    console.log(`municipalities to process: ${municipalities.join(',')}`)
    const currentData = await assetHandler.fetchDestData(asset_type_id, municipalities)
    console.log(`fetched ${currentData.length} assets from digiroad`)
    const {added, removed, updatedOld, updatedNew, notTouched } = assetHandler.calculateDiff(srcData, currentData)
    console.log(`assets to add: ${added.length}`)
    const dataWithLinks = await assetHandler.getRoadLinks(added)
    console.log('road link data fetched')
    const dataWithDigiroadLinks = await assetHandler.filterRoadLinks(dataWithLinks)
    await assetHandler.saveNewAssets(asset_type_id, dataWithDigiroadLinks)
}