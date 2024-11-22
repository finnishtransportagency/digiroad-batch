import { getClient } from "./fetchAndProcess"
import { AssetHandler, EnrichedVelhoAsset, VelhoAsset } from "./assetHandler"

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

    getRoadLinks = async (srcData: VelhoAsset[], vkmApiKey: string): Promise<EnrichedVelhoAsset[]> => {
        const chunkSize = 50
        const chunkData = <T>(array: T[], chunkSize: number): T[][] => {
            const R: T[][] = [];
            for (let i = 0, len = array.length; i < len; i += chunkSize) {
                R.push(array.slice(i, i + chunkSize));
            }
            return R;
        };

        const fetchVKM = async (src: VelhoAsset[]) => {
            const locationAndReturnValue = src.filter( a=> a.sijainti?.tie !=undefined).map(s => {
                const roadways = s.sijaintitarkenne.ajoradat || [];
                const roadwayNumbers = roadways.map(ajorata => ajorata.match(/\d+/)).filter(match => match !== null).map(match => match[0])

                if (s.keskilinjageometria.type !== 'Point') throw "illegal geometry type for point asset"
                // add roadway parameter if exists
                const params: {tie:number ,osa:number ,etaisyys:number,  tunniste: string, palautusarvot: string, ajr?: string, hallinnollinen_luokka } = {
                    tie: s.sijainti?.tie as number, 
                    osa: s.sijainti?.osa as number,
                    etaisyys: s.sijainti?.etaisyys as number,
                    tunniste: s.oid,
                    palautusarvot: '4,6',
                    hallinnollinen_luokka: '1'
                };

                if (roadwayNumbers.length > 0) {
                    params['ajr'] = roadwayNumbers.join(',');
                }

                return params;
            });
            const encodedBody = encodeURIComponent(JSON.stringify(locationAndReturnValue));
            const response = await fetch('https://api.vaylapilvi.fi/viitekehysmuunnin/muunna', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                    'X-API-KEY': `${vkmApiKey}`
                },
                body: `json=${encodedBody}`,
            });

            if (!response.ok) {
                throw new Error(`Error: ${response.statusText}`);
            }

            const data: VKMResponseForPoint = await response.json();

            return data.features.map(f => f.properties);
        };

        if (srcData.length === 0) {
            console.log("No velho assets to fetch roadlinks for")
            return []
        }

        const chunkedData = chunkData(srcData, chunkSize);
        const promises = chunkedData.map(chunk => fetchVKM(chunk));

        try {
            const results = await Promise.all(promises);
            const flatResults = results.flat();

            const mappedResults: EnrichedVelhoAsset[] = srcData.map(asset => {
                const match = flatResults.find(r => r.tunniste === asset.oid);
                return { ...asset, linkData: [{ linkId: match?.link_id, mValue: match?.m_arvo, municipalityCode: match?.kuntakoodi }] };
            });

            return mappedResults;
        } catch (err) {
            console.error(err);
            throw new Error("Erroe during vkm fetch")
        }
    }

    filterRoadLinks = async (src: EnrichedVelhoAsset[]): Promise<EnrichedVelhoAsset[]> => {
        let sqlWhichCreatedError = ""

        if (src.length === 0) {
            console.log("No velho assets to filter")
            return []
        }

        const vkmLinks = src.map(s => s.linkData[0].linkId).filter(id => id !== undefined)
        const client = await getClient()

        if (vkmLinks.length==0) {
            console.log("No links to filter")
            return []
        }
        try {
            await client.connect()
            const linkIdsString = vkmLinks.map(linkId => `'${linkId}'`).join(',');
            
            // admin class
            const sql = `
                SELECT linkid from kgv_roadlink kr
                    LEFT JOIN administrative_class ac ON kr.linkid = ac.link_id       
                    WHERE kr.linkid IN (${linkIdsString})
                    AND COALESCE(ac.administrative_class, kr.adminclass) = 1;
            `;

            sqlWhichCreatedError = sql
            const query = {
                text: sql,
                rowMode: 'array',
            }
            const result = await client.query(query)

            const linkIds = result.rows.map((row: [string]) => row[0])

            console.log(`VKM links found in db ${linkIds.length}/${vkmLinks.length}`);

            const missingLinks = vkmLinks.filter(linkId => !linkIds.includes(linkId));

            if (missingLinks.length > 0) {
                console.log('Missing links in db:', missingLinks.join(','));
            }
            return src.filter(s => linkIds.some(linkid => s.linkData[0].linkId === linkid))
        } catch (err) {
            console.log('Error was created when executing :'+ sqlWhichCreatedError)
            console.log('error during road link filtering', err)
        } finally {
            await client.end()
        }
        throw '500 during road link filtering'
    }

    saveNewAssets = async (asset_type_id: number, newAssets: EnrichedVelhoAsset[]) => {

        if (newAssets.length === 0) {
            console.log("No velho assets to save.")
            return
        }

        const client = await getClient();
        const timeStamp = Date.now() - (Date.now() % (24 * 60 * 60 * 1000)) - (5 * 60 * 60 * 1000);

        try {
            await client.connect();

            await client.query('BEGIN');
            const insertPromises = newAssets.map(async (asset) => {
                const pointGeometry = `ST_GeomFromText('POINT(${asset.keskilinjageometria?.coordinates[0]} ${asset.keskilinjageometria?.coordinates[1]} 0)', 3067)`;
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
                    asset_type_id,
                    'Tievelho-import',
                    asset.linkData[0].municipalityCode,
                    asset.linkData[0].mValue,
                    asset.linkData[0].linkId,
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

    updateAssets = async (assetsToUpdate: EnrichedVelhoAsset[]) => {
        if (this.updateAssets.length === 0) {
            console.log("No assets to update.")
            return
        }

        const client = await getClient();
        const timeStamp = Date.now() - (Date.now() % (24 * 60 * 60 * 1000)) - (5 * 60 * 60 * 1000);

        try {
            await client.connect();

            await client.query('BEGIN');
            const updatePromises = assetsToUpdate.map(async (asset) => {
                const pointGeometry = `ST_GeomFromText('POINT(${asset.keskilinjageometria?.coordinates[0]} ${asset.keskilinjageometria?.coordinates[1]} 0)', 3067)`;
                const updateSql = `
                WITH asset_update AS (
                    UPDATE asset 
                    SET modified_by = 'Tievelho-update', modified_date = current_timestamp, municipality_code = $1, geometry = ${pointGeometry}
                    WHERE external_id = $2
                    RETURNING id
                )
                UPDATE lrm_position 
                SET start_measure = $3, link_id = $4, adjusted_timestamp = $5, modified_date = current_timestamp
                WHERE id = (
                    SELECT position_id 
                    FROM asset_link 
                    WHERE asset_id = (SELECT id FROM asset_update)
                );
            `;

                await client.query(updateSql, [
                    asset.linkData[0].municipalityCode,
                    asset.oid,
                    asset.linkData[0].mValue,
                    asset.linkData[0].linkId,
                    timeStamp
                ]);
            });

            await Promise.all(updatePromises);
            await client.query('COMMIT');
        } catch (err) {
            console.error('err', err);
            await client.query('ROLLBACK');
            throw new Error('500: Transaction failed');
        } finally {
            await client.end();
        }
    }
}