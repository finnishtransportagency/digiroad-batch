import { SSMClient, GetParameterCommand, GetParameterResult } from "@aws-sdk/client-ssm";
import { Client, ClientConfig } from 'pg';
import { Agent, setGlobalDispatcher } from 'undici'

const agent = new Agent({
  connect: {
    rejectUnauthorized: false
  }
})

setGlobalDispatcher(agent)

const ssm = new SSMClient({ region: process.env.AWS_REGION });



const getClient = async (): Promise<Client> => {
    const config:ClientConfig = { 
      user: (await ssm.send(new GetParameterCommand({ Name: `/${process.env.ENV}/bonecp.username` }))).Parameter?.Value,
      host: (await ssm.send(new GetParameterCommand({ Name: `/${process.env.ENV}/bonecp.host` }))).Parameter?.Value,
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

const fetchSourceData = async (token:string, path:string) => {
    console.log(path, token)
    try {
    const response = await fetch(`https://apiv2prdvelho.vaylapilvi.fi/latauspalvelu/api/v1/${path}`, {
        method: 'GET',
        headers: {
            'Authorization': 'Bearer '+token,
        },
    });
    console.log(response)

    if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
    }

    const ndjson = await response.text()
    return ndjson
        .split('\n')
        .filter((line:string) => line.trim().length > 0) // Remove any empty lines
        .map((line:string) => JSON.parse(line))
} catch (err) {
    console.log(err)
}
}

interface PointAsset {
    sijainti: {
      osa: number,
      tie: number,
      etaisyys: number,
    },
    keskilinjageometria: {
        coordinates: [ number, number, number ],
        type: "Point"
    },
    'sijainti-oid': string,
    sijaintitarkenne: {
      ajoradat: [
        string
      ]
    },
    oid: string,
    luotu: string,
    muokattu: string
}

interface PointAssetWithLinkId extends PointAsset {
    link_id?: string
}

interface DbAsset {
    externalId: string,
    createdBy: string,
    createdDate: Date,
    modifiedBy: string | null,
    modifiedDate: Date | null,
    linkid: string,
    startMeasure: number,
    endMeasure: number,
    municipalitycode: number
}

interface VKMResponse {
    features: {
        properties: {
            tunniste: string;
            link_id: string;
        };
    }[];
}

const convertEly = (velhoEly: string): number => {
    const velhoElyToDigiroad: {[velhoEly: string]: number } = { "16": 0, "15": 1, "13": 2, "11": 3, "10": 4, "08": 5, "05": 6, "06": 7, "01": 8, "02": 9}
    return velhoElyToDigiroad[velhoEly]
}

const fetchDestData = async (velhoEly: string) => {
    const typeId = 200
    const digiroadEly = convertEly(velhoEly)
    const municipalities = [683, 698, 742, 751, 241, 583, 732, 845, 851, 890, 976, 758, 148, 498, 47, 240, 320, 261, 273, 854, 614]
    const client = await getClient()
    try {
        await client.connect()
        const sql = `
        select asset.external_id, asset.created_by, asset.created_date, asset.modified_by, asset.modified_date, kgv.linkid, lp.start_measure, lp.end_measure, kgv.municipalitycode
        from asset
            left join asset_link
                on asset.id = asset_link.asset_id
            left join lrm_position lp
                on asset_link.position_id = lp.id
            left join kgv_roadlink kgv
                on kgv.linkid = lp.link_id 
        where
            asset.valid_to is null
            and asset_type_id = ${typeId}
            and kgv.adminclass = 1
            and kgv.municipalitycode in (${municipalities.join(',')})
        ;`
        console.log(sql)
        const query = {
            text: sql,
            rowMode: 'array',
        }
        const result = await client.query(query)

        const assets: DbAsset[] = result.rows.map((row: any) => ({
            externalId: row[0] !== null ? row[0] : null,
            createdBy: row[1] !== null ? row[1] : null,
            createdDate: row[2] !== null ? new Date(row[2]) : null,
            modifiedBy: row[3] !== null ? row[3] : null,
            modifiedDate: row[4] !== null ? new Date(row[4]) : null,
            linkid: row[5] !== null ? row[5] : null,
            startMeasure: row[6] !== null ? row[6] : null,
            endMeasure: row[7] !== null ? row[7] : null,
            municipalitycode: row[8] !== null ? row[8] : null,
        }));
        

        return assets
    } catch (err){
        console.log('err',err)      
    } finally {
        console.log('finally')
        await client.end()
    }
    throw '500: something weird happened'
}

const calculateDiff = (srcData: PointAsset[], currentData: DbAsset[]) => { 
    const specifiedDate: Date = new Date(new Date().setMonth(new Date().getMonth() - 6));


    const preserved = currentData.filter(curr => srcData.some(src => src.oid === curr.externalId));
    const removed = currentData.filter(curr => !srcData.some(src => src.oid === curr.externalId))
    const added = srcData.filter(src => !preserved.some(p => p.externalId === src.oid));
    const updatedOld = preserved.filter(p => {
        const correspondingSrcAsset = srcData.find(src => src.oid === p.externalId);
        if (correspondingSrcAsset && correspondingSrcAsset.muokattu) {
          const muokattuDate = new Date(correspondingSrcAsset.muokattu);
          return muokattuDate > specifiedDate;
        }
        return false;
      });
    const updatedNew = srcData.filter(src => updatedOld.some(u => u.externalId === src.oid))  
    const notTouched = preserved.filter(p => !updatedOld.some(u => u.externalId === p.externalId));  

    //TODO refactor updatedAsset structure to something more handy
    return {added: added, removed: removed, updatedOld: updatedOld, updatedNew: updatedNew, notTouched: notTouched}}

const getRoadLinks = async (srcData: PointAsset[]) => {
    const chunkSize = 50
    const chunkData = <T>(array: T[], chunkSize: number): T[][] => {
        const R: T[][] = [];
        for (let i = 0, len = array.length; i < len; i += chunkSize) {
          R.push(array.slice(i, i + chunkSize));
        }
        return R;
    };

    const fetchVKM = async (src: PointAsset[]) => {
        const locationAndReturnValue = src.map(s => ({...s.sijainti, tunniste: s.oid, palautusarvot: "6"}));
        const encodedBody = encodeURIComponent(JSON.stringify(locationAndReturnValue));
        console.log(encodedBody)
        const response = await fetch('https://avoinapi.vaylapilvi.fi/viitekehysmuunnin/muunna', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
            },
            body: `json=${encodedBody}`,
          });

          console.log("response", response)
        
          if (!response.ok) {
            throw new Error(`Error: ${response.statusText}`);
          }
        
          const data: VKMResponse = await response.json();

          return data.features.map(f => f.properties);
      };
  
      const chunkedData = chunkData(srcData, chunkSize);
      const promises = chunkedData.map(chunk => fetchVKM(chunk));
  
      try {
          const results = await Promise.all(promises);
          const flatResults = results.flat();
  
          const mappedResults: PointAssetWithLinkId[] = srcData.map(suojatie => {
              const match = flatResults.find(r => r.tunniste === suojatie.oid);
              return { ...suojatie, link_id: match?.link_id };
          });
  
          return mappedResults;
    } catch (err) {
        console.error('err', err);
        return []
  }
}

export const handler = async (event:{ely:string}, ctx:any) => {
    console.log(`Event: ${JSON.stringify(event, null, 2)}`);
    /*
     * ely
     * 
     * ely = ely code as string
     */
    const ely = event.ely

    const authToken = await authenticate()
    console.log({authToken})
    const ely2polku = await listKohdeluokka(authToken, 'kohdeluokka/kohdepisteet-ja-valit/suojatiet')
    console.log(ely2polku)
    if (!ely2polku[ely]) return
    const srcData = await fetchSourceData(authToken, ely2polku[ely]) as PointAsset[]
    console.log(srcData)
    // query mtk link id from vkm with tienumero
    for (const d of srcData) {
        const tie = d.sijainti.tie
        const coords = d.keskilinjageometria.coordinates
        //await fetchVKM(tie, coords)
    }

    const currentData = await fetchDestData(ely)

    const {added, removed, updatedOld, updatedNew, notTouched } = calculateDiff(srcData, currentData)
    //console.log("added", added[0])
    //console.log("removed", removed[0])
    //console.log("updated", updatedOld[0])
    //console.log("notTouched", notTouched[0])

    const dataWithLinks = await getRoadLinks(added)
    console.log(dataWithLinks[0])
    

}