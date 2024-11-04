import { getClient } from "./fetchAndProcess";
import { AssetHandler, EnrichedVelhoAsset } from "./assetHandler";
import { VelhoAsset } from "./assetHandler";
import { retryTimeout } from "./utils";

export interface ValidVKMFeature {
    properties: {
        tunniste: string;
        link_id: string;
        link_id_loppu: string;
        m_arvo: number;
        m_arvo_loppu: number;
        kuntakoodi: number;
    };
}

export interface InvalidVKMFeature {
    properties: {
        virheet: string;
    };
}

export type VKMResponseForRoadAddress = {
    features: (ValidVKMFeature | InvalidVKMFeature)[];
};

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

    getRoadLinks = async (srcData: VelhoAsset[], vkmApiKey: string): Promise<EnrichedVelhoAsset[]> => {
        const isValidVKMFeature = (feature: ValidVKMFeature | InvalidVKMFeature): feature is ValidVKMFeature => {
            return !('virheet' in feature.properties)
        }

        const chunkData = <T>(array: T[], chunkSize: number): T[][] => {
            const R: T[][] = [];
            for (let i = 0, len = array.length; i < len; i += chunkSize) {
                R.push(array.slice(i, i + chunkSize));
            }
            return R;
        };

        const fetchVKM = async (body: string): Promise<VKMResponseForRoadAddress> => {
            const response = await fetch('https://api.vaylapilvi.fi/viitekehysmuunnin/muunna', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                    'X-API-KEY': `${vkmApiKey}`
                },
                body: `json=${body}`,
            });
            if (!response.ok) {
                throw new Error(`Error: ${response.statusText}`);
            }

            const vkmResponse: VKMResponseForRoadAddress = await response.json();

            vkmResponse.features = vkmResponse.features.filter(f => isValidVKMFeature(f))

            return vkmResponse
        };

        if (srcData.length === 0) {
            console.log("No velho assets to fetch roadlinks for")
            return []
        }

        try {

            const batchSize = 20
            const chunkedVelhoAssets = chunkData(srcData, 50);
            const firstResults: LinkData[] = []
            for (let i = 0; i < chunkedVelhoAssets.length; i += batchSize) {
                const batch = chunkedVelhoAssets.slice(i, i + batchSize)
                const batchPromises = batch.map(async (chunk) => {
                    const locationAndReturnValue = chunk.map(c => ({
                        tie: c.alkusijainti?.tie, osa: c.alkusijainti?.osa, etaisyys: c.alkusijainti?.etaisyys,
                        osa_loppu: c.loppusijainti?.osa, etaisyys_loppu: c.loppusijainti?.etaisyys, tunniste: c.oid, palautusarvot: '4,6', valihaku: true
                    }));
                    const encodedBody = encodeURIComponent(JSON.stringify(locationAndReturnValue));
                    const data = await retryTimeout(async () => await fetchVKM(encodedBody), 3, 5000);
                    return data.features
                        .filter(f => isValidVKMFeature(f))
                        .map(f => {
                            const originalAsset = locationAndReturnValue.find(a => a.tunniste === f.properties.tunniste);
                            return {
                                ...f.properties,
                                tie: originalAsset?.tie
                            };
                        });
                });
                const batchResults = (await Promise.all(batchPromises)).flat();
                firstResults.push(...batchResults);
            }
            console.log(`fetched ${firstResults.length} start and end links from vkm`)

            const chunkedLinkData = chunkData(firstResults, 50)
            const secondResults: LinkData[] = []
            for (let i = 0; i < chunkedLinkData.length; i += batchSize) {
                const batch = chunkedLinkData.slice(i, i + batchSize)
                const batchPromises = batch.map(async chunk => {
                    const locationAndReturnValue = chunk.map(c => ({
                        tie: c.tie, link_id: c.link_id, link_id_loppu: c.link_id_loppu,
                        tunniste: c.tunniste, m_arvo: c.m_arvo, m_arvo_loppu: c.m_arvo_loppu, palautusarvot: '4,6', valihaku: "true"
                    }));
                    const encodedBody = encodeURIComponent(JSON.stringify(locationAndReturnValue));
                    const data = await retryTimeout(async () => await fetchVKM(encodedBody), 3, 5000);

                    return data.features
                        .filter(f => isValidVKMFeature(f))
                        .map(f => ({ ...f.properties, tie: undefined }))
                })
                const batchResults = (await Promise.all(batchPromises)).flat()
                secondResults.push(...batchResults)
            }

            const mappedResults: EnrichedVelhoAsset[] = secondResults.flatMap(r => {
                const match = srcData.find(asset => r.tunniste === asset.oid);
                return match ? [{ ...match, linkData: [{ linkId: r.link_id, mValue: r.m_arvo, mValueEnd: r.m_arvo_loppu, municipalityCode: r.kuntakoodi }] }] : [];
            });

            return mappedResults;

        } catch (err) {
            console.error(err);
            throw new Error("Error during vkm fetch.")
        }
    }

    filterRoadLinks = async (src: EnrichedVelhoAsset[]): Promise<EnrichedVelhoAsset[]> => {

        if (src.length === 0) {
            console.log("No velho assets to filter")
            return []
        }

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

            console.log(`VKM links found in db ${matchedLinks.length}/${allLinkIds.length}`);

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

        if (newAssets.length === 0) {
            console.log("No assets to save.")
            return
        }

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

    //TODO implement update for linears when there are asset types to update
    updateAssets = async (assetsToUpdate: EnrichedVelhoAsset[]) => {
        return
    }
}