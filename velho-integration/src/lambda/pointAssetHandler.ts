import { getClient} from "./fetchAndProcess"
import { AssetHandler, VelhoAsset } from "./assetHandler"

export interface PointAsset extends VelhoAsset {
    keskilinjageometria: {
        coordinates: [ number, number, number ],
        type: "Point"
    }
}

export interface EnrichedPointAsset extends PointAsset {
    linkId?: string
    mValue?: number
    municipalityCode?: number
}

export interface VKMResponseForPoint {
    features: {
        properties: {
            tunniste: string,
            link_id: string,
            m_arvo: number,
            kuntakoodi: number
        };
    }[];
}

export class PointAssetHandler extends AssetHandler {
    fetchSourceData = async (token:string, path:string) => {
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
            .map((line:string) => JSON.parse(line)) as PointAsset[]
    } catch (err) {
        console.log(err)
        return []
    }
    }

        
    getRoadLinks = async (srcData: PointAsset[]) => {
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
            
              const data: VKMResponseForPoint = await response.json();
    
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

    filterRoadLinks = async (src: EnrichedPointAsset[]): Promise<EnrichedPointAsset[]> => {
        const vkmLinks = src.map(s => s.linkId).filter(id => id)
        const client = await getClient()
        try {
            await client.connect()
            const linkIdsString = vkmLinks.map(linkId => `'${linkId}'`).join(',');
            const sql = `select linkid from kgv_roadlink where linkid in (${linkIdsString});`;
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

    saveNewAssets = async (newAssets: EnrichedPointAsset[]) => {
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
}