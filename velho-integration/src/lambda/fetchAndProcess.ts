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

const fetchSourceData = async (token:string, path:string) => {
    try {
    const response = await fetch(`https://apiv2prdvelho.vaylapilvi.fi/latauspalvelu/api/v1/${path}`, {
        method: 'GET',
        headers: {
            'Authorization': 'Bearer '+token,
        },
    });

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
    return null
}
}

export interface PointAsset {
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
    muokattu: string,
    'tiekohteen-tila': string | null
}

interface EnrichedPointAsset extends PointAsset {
    linkId?: string
    mValue?: number
    municipalityCode?: number
}

export interface DbAsset {
    externalId: string | null,
    createdBy: string,
    createdDate: Date,
    modifiedBy: string | null,
    modifiedDate: Date | null,
    linkid: string,
    startMeasure: number | null,
    endMeasure: number | null,
    municipalitycode: number
}

interface VKMResponse {
    features: {
        properties: {
            tunniste: string,
            link_id: string,
            m_arvo: number,
            kuntakoodi: number
        };
    }[];
}

const convertEly = (velhoEly: string): number => {
    const velhoElyToDigiroad: {[velhoEly: string]: number } = { "16": 0, "15": 1, "13": 2, "11": 3, "10": 4, "08": 5, "05": 6, "06": 7, "01": 8, "02": 9}
    return velhoElyToDigiroad[velhoEly]
}

const fetchMunicipalities = async (digiroadEly: number): Promise<number[]> => {
    const client = await getClient()
    try {
        await client.connect()
        const sql = `select id from municipality where ely_nro = ${digiroadEly};`
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

const fetchDestData = async (velhoEly: string) => {
    const typeId = 200
    const digiroadEly = convertEly(velhoEly)
    const municipalities = await fetchMunicipalities(digiroadEly)
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
        const query = {
            text: sql,
            rowMode: 'array',
        }
        const result = await client.query(query)

        const assets: DbAsset[] = result.rows.map((row: any) => ({
            externalId: row[0] !== null ? row[0] : null,
            createdBy: row[1],
            createdDate: new Date(row[2]),
            modifiedBy: row[3] !== null ? row[3] : null,
            modifiedDate: row[4] !== null ? new Date(row[4]) : null,
            linkid: row[5],
            startMeasure: row[6] !== null ? row[6] : null,
            endMeasure: row[7] !== null ? row[7] : null,
            municipalitycode: row[8],
        }));
        

        return assets
    } catch (err){
        console.log('err',err)      
    } finally {
        await client.end()
    }
    throw '500: something weird happened'
}

export const calculateDiff = (srcData: PointAsset[], currentData: DbAsset[]) => { 
    //TODO create table for these values and fetch from there, when update code is run
    const lastSuccessfulFetch: Date = new Date(new Date().setMonth(new Date().getMonth() - 6));

    // exclude assets that have other state than built or unknown 
    const filteredSrc = srcData.filter(src => src['tiekohteen-tila'] === null || src['tiekohteen-tila'] === 'tiekohteen-tila/tt03')

    //TODO implement remove and update later
    const preserved = currentData.filter(curr => filteredSrc.some(src => src.oid === curr.externalId));
    //const removed = currentData.filter(curr => !filteredSrc.some(src => src.oid === curr.externalId))
    const added = filteredSrc.filter(src => !preserved.some(p => p.externalId === src.oid));
    /* const updatedOld = preserved.filter(p => {
        const correspondingSrcAsset = filteredSrc.find(src => src.oid === p.externalId);
        if (correspondingSrcAsset && correspondingSrcAsset.muokattu) {
          const muokattuDate = new Date(correspondingSrcAsset.muokattu);
          return muokattuDate > lastSuccessfulFetch;
        }
        return false;
      });
    const updatedNew = filteredSrc.filter(src => updatedOld.some(u => u.externalId === src.oid))  
    const notTouched = preserved.filter(p => !updatedOld.some(u => u.externalId === p.externalId));   */

    //TODO refactor updatedAsset structure to something more handy
    return {added: added, removed: null, updatedOld: null, updatedNew: null, notTouched: null}}

const saveNewAssets = async (newAssets: EnrichedPointAsset[]) => {
    const client = await getClient();

    const timeStamp = Date.now() - (Date.now() % (24 * 60 * 60 * 1000)) - (5 * 60 * 60 * 1000);

    try {
        await client.connect();
        
        await client.query('BEGIN');
        const insertPromises = newAssets.map(async (asset) => {
            const pointGeometry = `ST_GeomFromText('POINT(${asset.keskilinjageometria.coordinates[0]} ${asset.keskilinjageometria.coordinates[1]} 0)', 3067)`;
            const insertSql = `
                WITH asset_insert AS (
                    INSERT INTO asset (id, external_id, asset_type_id, created_by, created_date, municipality_code, modified_by, modified_date, geometry)
                    VALUES (nextval('primary_key_seq'), $1, $2, $3, current_timestamp, $4, null, null, ${pointGeometry})
                    RETURNING id
                ),
                position_insert AS (
                    INSERT INTO lrm_position (id, start_measure, link_id, adjusted_timestamp, link_source, modified_date)
                    VALUES (nextval('lrm_position_primary_key_seq'), $5, $6, $7, $8, current_timestamp)
                    RETURNING id
                )
                INSERT INTO asset_link (asset_id, position_id)
                VALUES ((SELECT id FROM asset_insert), (SELECT id FROM position_insert));
            `;

            await client.query(insertSql, [
                asset.oid,              
                200,                    
                'Tievelho-import',
                asset.municipalityCode,                     
                asset.mValue,           
                asset.linkId,           
                timeStamp,              
                1 // normal link interface
            ]);
        });

        await Promise.all(insertPromises);
        await client.query('COMMIT');
    } catch (err) {
        console.error('err', err);
        await client.query('ROLLBACK');
        throw new Error('500: Transaction failed');
    } finally {
        await client.end();
    }
};
    

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
        const locationAndReturnValue = src.map(s => ({x: s.keskilinjageometria.coordinates[0], y: s.keskilinjageometria.coordinates[1], tunniste: s.oid, palautusarvot: '4,6'}));
        const encodedBody = encodeURIComponent(JSON.stringify(locationAndReturnValue));
        const response = await fetch('https://avoinapi.vaylapilvi.fi/viitekehysmuunnin/muunna', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
            },
            body: `json=${encodedBody}`,
          });
        
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
  
          const mappedResults: EnrichedPointAsset[] = srcData.map(asset => {
              const match = flatResults.find(r => r.tunniste === asset.oid);
              return { ...asset, linkId: match?.link_id, mValue: match?.m_arvo, municipalityCode: match?.kuntakoodi };
          });
  
          return mappedResults;
    } catch (err) {
        console.error('err', err);
        return []
  }
}

const filterRoadLinks = async (src: EnrichedPointAsset[]): Promise<EnrichedPointAsset[]> => {
    const vkmLinks = src.map(s => s.linkId).filter(id => id)
    console.log(vkmLinks)
    const client = await getClient()
    try {
        await client.connect()
        const linkIdsString = vkmLinks.map(linkId => `'${linkId}'`).join(',');
        const sql = `
        select linkid from kgv_roadlink where linkid in (${linkIdsString})
        ;`;
        const query = {
            text: sql,
            rowMode: 'array',
        }
        const result = await client.query(query)
        const linkIds = result.rows.map((row: [string]) => row[0])
        return src.filter(s => linkIds.some(linkid => s.linkId === linkid))
    } catch (err){
        console.log('err',err)      
    } finally {
        await client.end()
    }
    throw '500: something weird happened'
}

export const handler = async (event:{ely:string}, ctx:any) => {
    console.log(`Event: ${JSON.stringify(event, null, 2)}`);

    const ely = event.ely

    const authToken = await authenticate()
    const ely2polku = await listKohdeluokka(authToken, 'kohdeluokka/kohdepisteet-ja-valit/suojatiet')
    if (!ely2polku[ely]) return
    const srcData = await fetchSourceData(authToken, ely2polku[ely]) as PointAsset[]
    console.log('src fetched')
    const currentData = await fetchDestData(ely)
    console.log('current db data fetched')
    const {added, removed, updatedOld, updatedNew, notTouched } = calculateDiff(srcData, currentData)
    console.log('diff calculated')
    const dataWithLinks = await getRoadLinks(added)
    console.log('road link data fetched')
    const dataWithDigiroadLinks = await filterRoadLinks(dataWithLinks)
    console.log('data filtered')
    await saveNewAssets(dataWithDigiroadLinks)
}