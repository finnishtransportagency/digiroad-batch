import { getClient } from "./fetchAndProcess";
import { AssetHandler, EnrichedVelhoAsset } from "./assetHandler";
import { VelhoAsset } from "./assetHandler";

export interface VKMResponseForRoadAddress {
    features: {
        properties: {
            tunniste: string,
            link_id: string,
            link_id_loppu: string,
            m_arvo: number,
            m_arvo_loppu: number,
            kuntakoodi: number
        };
    }[];
}

interface LinkData {
    tie: number | undefined;
    tunniste: string;
    link_id: string;
    link_id_loppu: string;
    m_arvo: number;
    m_arvo_loppu: number;
    kuntakoodi: number;
}

export class LinearAssetHandler extends AssetHandler {
    
    getRoadLinks = async (srcData: VelhoAsset[]): Promise<EnrichedVelhoAsset[]> => {
        const chunkData = <T>(array: T[], chunkSize: number): T[][] => {
            const R: T[][] = [];
            for (let i = 0, len = array.length; i < len; i += chunkSize) {
              R.push(array.slice(i, i + chunkSize));
            }
            return R;
        };
    
        const fetchStartAndEndlinkFromVKM = async (src: VelhoAsset[]): Promise<LinkData[]> => {
            // TODO add ajorata parameter when dealing with assets that have it 
            const locationAndReturnValue = src.map(s => ({tie: s.alkusijainti?.tie, osa: s.alkusijainti?.osa, etaisyys: s.alkusijainti?.etaisyys, 
                osa_loppu: s.loppusijainti?.osa, etaisyys_loppu: s.loppusijainti?.etaisyys, tunniste: s.oid, palautusarvot: '4,6', valihaku: true}));    
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
            
              const data: VKMResponseForRoadAddress = await response.json();
    
              const startAndEndLinkData: LinkData[] = data.features.map(f => {
                const originalAsset = locationAndReturnValue.find(a => a.tunniste === f.properties.tunniste);
                return {
                    ...f.properties,
                    tie: originalAsset?.tie
                };
            });
        
            return startAndEndLinkData;
          }; 

        const fetchIntervalsFromVKM = async (src: LinkData[]) => {
            const locationAndReturnValue = src.map(s => ({tie: s.tie, link_id: s.link_id, link_id_loppu: s.link_id_loppu,
                tunniste: s.tunniste, palautusarvot: '4,6', valihaku: "true"}));    
                
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
            
              const data: VKMResponseForRoadAddress = await response.json();
              return data.features.map(f => f.properties);
          }; 
          
          const chunkedVelhoAssets = chunkData(srcData, 50);
          const promisesForStartAndEnd = chunkedVelhoAssets.map(chunk => fetchStartAndEndlinkFromVKM(chunk));
      
          try {
              const firstResults = (await Promise.all(promisesForStartAndEnd)).flat();
              const chunkedLinkData = chunkData(firstResults, 50)
              const promisesForAllLinks = chunkedLinkData.map(chunk => fetchIntervalsFromVKM(chunk))

              const secondResults = (await Promise.all(promisesForAllLinks)).flat()
      
              const mappedResults: EnrichedVelhoAsset[] = srcData.map(asset => {
                  const match = secondResults.find(r => r.tunniste === asset.oid);
                  return { ...asset, linkData: [{ linkId: match?.link_id, mValue: match?.m_arvo, mValueEnd: match?.m_arvo_loppu, municipalityCode: match?.kuntakoodi }] };
              });
      
              return mappedResults;
        } catch (err) {
            console.error('err', err);
            return []
      }
    }

    filterRoadLinks = async (src: EnrichedVelhoAsset[]): Promise<EnrichedVelhoAsset[]> => {
        
        const allLinkIds = src.flatMap(s => s.linkData.map(ld => ld.linkId)).filter(id => id);
        const client = await getClient();
        
        const missingLinkIds: string[] = [];
        
        try {
            await client.connect();
            const linkIdsString = allLinkIds.map(linkId => `'${linkId}'`).join(',');            
            const sql = `
                SELECT 
                    kr.linkid,
                    CASE 
                        WHEN td.traffic_direction = 2 THEN 1  -- Both Directions
                        WHEN td.traffic_direction = 3 THEN 3  -- Against Digitizing
                        WHEN td.traffic_direction = 4 THEN 2  -- Towards Digitizing
                        ELSE 
                            CASE 
                                WHEN kr.directiontype = 0 THEN 1  -- Both Directions
                                WHEN kr.directiontype = 1 THEN 2  -- Towards Digitizing
                                WHEN kr.directiontype = 2 THEN 3  -- Against Digitizing
                            END
                    END as side_code
                FROM kgv_roadlink kr
                LEFT JOIN administrative_class ac ON kr.linkid = ac.link_id   
                LEFT JOIN traffic_direction td ON kr.linkid = td.link_id      
                WHERE kr.linkid IN (${linkIdsString})
                AND COALESCE(ac.administrative_class, kr.adminclass) = 1;   
            `;
            
            const query = {
                text: sql,
                rowMode: 'array',
            };
            
            const result = await client.query(query);
            
            const matchedLinks = result.rows.map((row: [string, number]) => ({
                linkId: row[0],
                sideCode: row[1],
            }));
            
            console.log(`Links found in db ${matchedLinks.length}/${allLinkIds.length}`);
            
            return src.map(asset => {
                const filteredLinkData = asset.linkData
                    .map(ld => {
                        const match = matchedLinks.find(link => link.linkId === ld.linkId);
                        if (match) {
                            return {
                                ...ld,
                                sideCode: match.sideCode
                            };
                        } else {
                            if (ld.linkId) { 
                                missingLinkIds.push(ld.linkId);
                            }
                            return null
                        }
                    })
                    .filter(ld => ld !== null);  

                return {
                    ...asset,
                    linkData: filteredLinkData
                };
            }).filter(asset => asset.linkData.length > 0);
            
        } catch (err) {
            console.log('err', err);
            throw '500 during road link filtering';
        } finally {
            await client.end();
            
            if (missingLinkIds.length > 0) {
                console.log('VKM links not found in db:', missingLinkIds.join(','));
            } else {
                console.log('All VKM links were found in db.');
            }
        }
    };
    
    
    saveNewAssets = async (asset_type_id: number, newAssets: EnrichedVelhoAsset[]) => {
        const client = await getClient();
        const timeStamp = Date.now() - (Date.now() % (24 * 60 * 60 * 1000)) - (5 * 60 * 60 * 1000);
    
        try {
            await client.connect();
            
            await client.query('BEGIN');
            const insertPromises = newAssets.map((asset) => {
                asset.linkData.map(async (data) => {
                const insertSql = `
                    WITH asset_insert AS (
                        INSERT INTO asset (id, external_id, asset_type_id, created_by, created_date, municipality_code)
                        VALUES (nextval('primary_key_seq'), $1, $2, $3, current_timestamp, $4)
                        RETURNING id
                    ),
                    position_insert AS (
                        INSERT INTO lrm_position (id, start_measure, end_measure, link_id, side_code, adjusted_timestamp, link_source, modified_date)
                        VALUES (nextval('lrm_position_primary_key_seq'), $5, $6, $7, $8, $9, $10, current_timestamp)
                        RETURNING id
                    )
                    INSERT INTO asset_link (asset_id, position_id)
                    VALUES ((SELECT id FROM asset_insert), (SELECT id FROM position_insert));
                `;
    
                await client.query(insertSql, [
                    asset.oid,              
                    asset_type_id,                    
                    'Tievelho-import',
                    data.municipalityCode,                     
                    data.mValue,
                    data.mValueEnd,           
                    data.linkId,
                    data.sideCode,           
                    timeStamp,              
                    1 // normal link interface
                ]);
                })
            });
    
            await Promise.all(insertPromises);
            await client.query('COMMIT');
        } catch (err) {
            console.error('err', err);
            await client.query('ROLLBACK');
            throw new Error('500 during saving');
        } finally {
            await client.end();
        }
    };

}