import { getClient } from "./fetchAndProcess";
import {AssetHandler, VelhoAsset, DbAsset, AssetWithLinkData, VelhoLinearAsset} from "./assetHandler";
import { VelhoLinearAsset } from "./assetHandler";
import {chunkData, retryTimeout, timer} from "./utils";
import {performance} from "perf_hooks";
import {data} from "aws-cdk/lib/logging";
import {match} from "assert";

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

    override calculateDiff(srcData: VelhoAsset[], currentData: DbAsset[]) {
        const diff = super.calculateDiff(srcData, currentData);

        return {
            added: diff.added as VelhoLinearAsset[],
            expired: diff.expired,
            updated: diff.updated as VelhoLinearAsset[],
            notTouched: diff.notTouched
        };
    }


    private isValidVKMFeature = (feature: ValidVKMFeature | InvalidVKMFeature): feature is ValidVKMFeature => {
        return !('virheet' in feature.properties)
    }
    
    private fetchVKM = async (body: string,vkmApiKey:string): Promise<VKMResponseForRoadAddress> => {
        const begin = performance.now();
        const response= await fetch('https://api.vaylapilvi.fi/viitekehysmuunnin/muunna', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                'X-API-KEY': `${vkmApiKey}`
            },
            body: `json=${body}`,
        })
        const duration = performance.now() - begin;
        console.log("By using this",body)
        console.log(`Call to fetchVKM call took: ${(duration / 1000).toFixed(4)} s.`)
        if (!response.ok) {
            throw new Error(`Error: ${response.statusText}`);
        }

        const vkmResponse: VKMResponseForRoadAddress = await response.json();

        vkmResponse.features = vkmResponse.features.filter(f => this.isValidVKMFeature(f))

        return vkmResponse
    };
    
    getRoadLinks = async (srcData: VelhoAsset[], vkmApiKey: string): Promise<AssetWithLinkData[]> => {
        const sourceLinearAssets = srcData as VelhoLinearAsset[]
        if (sourceLinearAssets.length === 0) {
            console.log("No velho assets to fetch roadlinks for")
            return []
        }
        try {
            const batchSize = 20
            const firstResults = await this.firstResult(sourceLinearAssets, batchSize,vkmApiKey);
            console.log(`fetched ${firstResults.length} start and end links from vkm`)
            const secondResultsIndexed=  await this.secondResult(firstResults, batchSize,vkmApiKey);
            
            console.log(`Start mapping ${sourceLinearAssets.length} to links ${Object.keys(secondResultsIndexed).length}`);
            // VelhoLinearAsset matches 0 to many LinkData
           const mappedResults = timer("mappedResults", ()=> {
                const mappedResults: AssetWithLinkData[] = []
                sourceLinearAssets.forEach(asset => {
                    if (secondResultsIndexed[asset.oid] != undefined && secondResultsIndexed[asset.oid].length !=0) {
                        mappedResults.push({
                            asset: asset,
                            linkData: secondResultsIndexed[asset.oid].map(link => ({
                                linkId: link.link_id,
                                mValue: link.m_arvo,
                                mValueEnd: link.m_arvo_loppu,
                                municipalityCode: link.kuntakoodi
                            }))
                        });
                    }
                });
               return  mappedResults;
            })
            console.log(`Mapped ${mappedResults.length}`);
            return mappedResults;
        } catch (err) {
            console.error(err);
            throw new Error("Error during vkm fetch.")
        }
    }

    private async secondResult<T>(firstResults: LinkData[], batchSize: number,vkmApiKey: string) {
        const begin = performance.now();
        const chunkedLinkData = chunkData(firstResults, 50)
        const secondResultsIndexed: { [index: string]: LinkData[] } = {};
        for (let i = 0; i < chunkedLinkData.length; i += batchSize) {
            const batch = chunkedLinkData.slice(i, i + batchSize)
            const batchPromises = batch.map(async chunk => {
                const locationAndReturnValue = chunk.map(c => ({
                    tie: c.tie, link_id: c.link_id, link_id_loppu: c.link_id_loppu,
                    tunniste: c.tunniste, palautusarvot: '4,6', valihaku: "true"
                }));
                const encodedBody = encodeURIComponent(JSON.stringify(locationAndReturnValue));
                const data = await retryTimeout(async () => await this.fetchVKM(encodedBody,vkmApiKey), 10, 5000);

                return data.features
                    .filter(f => this.isValidVKMFeature(f))
                    .map(f => ({...f.properties, tie: undefined}))
            })
            const batchResults = (await Promise.all(batchPromises)).flat()

            batchResults.forEach(a => {
                if (secondResultsIndexed[a.tunniste] == undefined || secondResultsIndexed[a.tunniste].length == 0)
                    secondResultsIndexed[a.tunniste] = [a]
                else secondResultsIndexed[a.tunniste].push(a)
            })
        }
        const duration = performance.now() - begin;
        console.log(`Call to secondResult call took: ${(duration / 1000).toFixed(4)} s.`)
        return secondResultsIndexed;
    }

    private async firstResult<T>(sourceLinearAssets: VelhoLinearAsset[], batchSize: number,vkmApiKey: string) {
        const begin = performance.now();
        const chunkedVelhoAssets = chunkData(sourceLinearAssets, 50);
        const firstResults: LinkData[] = []
        for (let i = 0; i < chunkedVelhoAssets.length; i += batchSize) {
            const batch = chunkedVelhoAssets.slice(i, i + batchSize)
            const batchPromises = batch.map(async (chunk) => {
                const locationAndReturnValue = chunk.map(c => ({
                    tie: c.alkusijainti?.tie,
                    osa: c.alkusijainti?.osa,
                    etaisyys: c.alkusijainti?.etaisyys,
                    osa_loppu: c.loppusijainti?.osa,
                    etaisyys_loppu: c.loppusijainti?.etaisyys,
                    tunniste: c.oid,
                    palautusarvot: '4,6',
                    valihaku: true
                }));
                const encodedBody = encodeURIComponent(JSON.stringify(locationAndReturnValue));
                const data = await retryTimeout(async () => await this.fetchVKM(encodedBody,vkmApiKey), 10, 5000);
                return data.features
                    .filter(f => this.isValidVKMFeature(f))
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
        const duration = performance.now() - begin;
        console.log(`Call to firstResult call took: ${(duration / 1000).toFixed(4)} s.`)
        return firstResults;
    }

    override async filterRoadLinks(assetsWithLinkData: AssetWithLinkData[]): Promise<AssetWithLinkData[]> {
        if (assetsWithLinkData.length === 0) {
            console.log("No velho assets to filter")
            return []
        }

        const vkmLinkIds = assetsWithLinkData.flatMap(asset => asset.linkData.map(link => link.linkId)).filter(id => id);

        const client = await getClient();

        const missingLinkIds: string[] = [];

        try {
            await client.connect();
            const linkIdsString = vkmLinkIds.map(linkId => `'${linkId}'`).join(',');
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

            console.log(`VKM links found in db ${matchedLinks.length}/${vkmLinkIds.length}`);

            return assetsWithLinkData.map(asset => {
                const filteredLinkData = asset.linkData.map(ld => {
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


    override async saveNewAssets(asset_type_id: number, newAssets: AssetWithLinkData[]) {

        if (newAssets.length === 0) {
            console.log("No assets to save.")
            return
        }

        const client = await getClient();
        const timeStamp = Date.now() - (Date.now() % (24 * 60 * 60 * 1000)) - (5 * 60 * 60 * 1000);

        try {
            await client.connect();

            await client.query('BEGIN');
            const insertPromises = newAssets.map((assetWithLinkData) => {
                (assetWithLinkData.linkData || []).map(async (linkData) => {
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
                        assetWithLinkData.asset.oid,
                        asset_type_id,
                        'Tievelho-import',
                        linkData.municipalityCode,
                        linkData.mValue,
                        linkData.mValueEnd,
                        linkData.linkId,
                        linkData.sideCode,
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

    updateAssets(asset_type_id: number, assetsToUpdate: AssetWithLinkData[]): Promise<void> {
        //Placeholder logic
        return new Promise<void>((resolve, reject) => {resolve();}); 
    };

    async saveChanges(asset_type_id: number, newAssets: AssetWithLinkData[], assetsToUpdate: AssetWithLinkData[]): Promise<void> {
        await this.saveNewAssets(asset_type_id, newAssets)
        await this.updateAssets(asset_type_id, newAssets)
    }
}