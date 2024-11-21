import { SSMClient, GetParameterCommand } from "@aws-sdk/client-ssm";
import { Client, ClientConfig } from 'pg';
import { Agent, setGlobalDispatcher } from 'undici';
import { PointAssetHandler } from "./pointAssetHandler";
import { LinearAssetHandler } from "./linearAssetHandler";
import {PavementHandler, VelhoPavementAsset} from "./pavementHandler";
import {timer} from "./utils";
import {AssetWithLinkData, VelhoAsset} from "./assetHandler";

const agent = new Agent({
    connect: {
        rejectUnauthorized: false
    }
})

setGlobalDispatcher(agent)

const ssm = new SSMClient({ region: process.env.AWS_REGION });

export const getVelhoBaseUrl = async () => (await ssm.send(new GetParameterCommand({ Name: 'velhoLatauspalveluBaseUrl' }))).Parameter?.Value
const getVkmApiKey = async () => (await ssm.send(new GetParameterCommand({ Name: '/prod/apikey/viitekehysmuunnin', WithDecryption: true }))).Parameter?.Value

export const getClient = async (): Promise<Client> => {
    const config: ClientConfig = {
        user: (await ssm.send(new GetParameterCommand({ Name: `/${process.env.ENV}/bonecp.username` }))).Parameter?.Value,
        host: `velhotestdb.c8sq5c8rj3gu.eu-west-1.rds.amazonaws.com`,//(await ssm.send(new GetParameterCommand({ Name: `velhotestdb.c8sq5c8rj3gu.eu-west-1.rds.amazonaws.com` }))).Parameter?.Value,
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
            'Authorization': 'Basic ' + Buffer.from(user + ':' + password).toString('base64'),
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: 'grant_type=client_credentials',
    })

    const data = await response.json() as { access_token: string }
    return data.access_token
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
    } catch (err) {
        console.log('err', err)
    } finally {
        await client.end()
    }
    throw '500: something weird happened'
}

const getAssetHandler = (asset_type_id: number, asset_type: string) => {
    if (asset_type_id === 110) {
        return new PavementHandler
    } else if (asset_type === 'Point') {
        return new PointAssetHandler
    } else {
        return new LinearAssetHandler
    }
}

export const handler = async (event: { ely: string, asset_name: string, asset_type_id: number, asset_type: string, paths: string[] }, ctx: any) => {
    console.log(`Event: ${JSON.stringify(event, null, 2)}`);

    const { ely, asset_name, asset_type_id, asset_type, paths } = event;
    const assetHandler = getAssetHandler(asset_type_id, asset_type)
    const vkmApiKey = await getVkmApiKey()
    if (!vkmApiKey) throw new Error("vkm api key is not defined")
    const authToken = await authenticate()
    const srcData = await assetHandler.fetchSource(authToken, ely, paths)
  
    console.log(`fetched ${srcData.length} assets from velho`)
    const filteredSrc = timer("filterUnnecessary", () => {
        return assetHandler.filterUnnecessary(srcData)
    })
    console.log(`fetched assets from velho filtered`)
    if (filteredSrc.length === 0) {
        console.log('No assets to process after filtering.')
        return
    }
    const occurrences = {};
    filteredSrc.map(a => a.oid).forEach(a=> {
        occurrences[a] = (occurrences[a] || 0) + 1;
    })
    Object.keys(occurrences).forEach(oid => {
        if (occurrences[oid] > 1) {
            console.log(`Duplicate oid found: ${oid} appears ${occurrences[oid]} times.`);
        }
    });
    
    const municipalities = await fetchMunicipalities(ely)
    console.log(`municipalities to process: ${municipalities.join(',')}`)
    const currentData = await assetHandler.fetchDestData(asset_type_id, municipalities)

    console.log(`fetched ${currentData.length} assets from digiroad`)
    const { added, expired, updated, notTouched }  = timer("calculateDiff", ()=> {
        return assetHandler.calculateDiff(filteredSrc, currentData)
    })
    
    console.log(`assets left untouched: ${notTouched.length}`)
    console.log(`assets to expire: ${expired.length}`)
    console.log(`assets to add: ${added.length}`)
    const addedWithLinks = await assetHandler.getRoadLinks(added, vkmApiKey)
   
    console.log(`assets to update: ${updated.length}`)
    const updatedWithLinks= await assetHandler.getRoadLinks(updated, vkmApiKey)
  
    console.log('road link data fetched')
    console.log('start saving')

   
    const addedWithDigiroadLinks = await assetHandler.filterRoadLinks(addedWithLinks)
    const updatedWithDigiroadLinks =await  assetHandler.filterRoadLinks(updatedWithLinks)
    console.log('start saving added,')

    const assetPerLink:{[p: string]:   VelhoAsset[]} = {};

    addedWithDigiroadLinks.forEach(a => {
        a.linkData.forEach(a1=> {
            if (assetPerLink[a1.linkId] == undefined || assetPerLink[a1.linkId].length == 0)
                assetPerLink[a1.linkId] = [a.asset]
            else assetPerLink[a1.linkId].push(a.asset)
        })
    })
    
    Object.keys(assetPerLink).forEach(key => {
        if (assetPerLink[key].length > 1) {
            const asset =assetPerLink[key] 
            console.log("links has more than one VelhoAsset: "+key)
            asset.forEach(a =>{
                    const p =  a as VelhoPavementAsset
                    console.log(`${p.oid} : ${p.ominaisuudet?.velhoSource} : ${p.ominaisuudet?.tyyppi} : ${JSON.stringify(p.alkusijainti)}: ${JSON.stringify(p.loppusijainti)} : ${JSON.stringify(p.sijaintitarkenne)}`)
            }
            )
        }
    });
}