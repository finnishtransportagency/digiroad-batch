import { getClient } from "./fetchAndProcess"
import {AssetHandler, VelhoAsset, VelhoPointAsset, DbAsset, AssetWithLinkData, RoadLink} from "./assetHandler"

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

    override calculateDiff(srcData: VelhoAsset[], currentData: DbAsset[]) {
        const diff = super.calculateDiff(srcData, currentData);

        return {
            added: diff.added as VelhoPointAsset[],
            expired: diff.expired,
            updated: diff.updated as VelhoPointAsset[],
            notTouched: diff.notTouched
        };
    }
    async saveChanges(asset_type_id: number, newAssets: AssetWithLinkData[], assetsToUpdate: AssetWithLinkData[],links:RoadLink[]): Promise<void> {
        await this.saveNewAssets(asset_type_id, newAssets)
        await this.updateAssets(asset_type_id, newAssets)
    }
    getRoadLinks = async (srcData: VelhoAsset[], vkmApiKey: string): Promise<AssetWithLinkData[]> => {
        const sourcePointAssets = srcData as VelhoPointAsset[]
        const chunkSize = 50
        const chunkData = <T>(array: T[], chunkSize: number): T[][] => {
            const R: T[][] = [];
            for (let i = 0, len = array.length; i < len; i += chunkSize) {
                R.push(array.slice(i, i + chunkSize));
            }
            return R;
        };

        const fetchVKM = async (src: VelhoPointAsset[]) => {
            const locationAndReturnValue = src.map(s => {
        const fetchVKM = async (src: VelhoAsset[]) => {
            const locationAndReturnValue = (src  as VelhoPointAsset[]).filter( a=> a.sijainti?.tie !=undefined).map(s => {
                const roadways = s.sijaintitarkenne.ajoradat || [];
                const roadwayNumbers = roadways.map(ajorata => ajorata.match(/\d+/)).filter(match => match !== null).map(match => match[0])

                if (s.keskilinjageometria.type !== 'Point') throw "illegal geometry type for point asset"

                // add roadway parameter if exists
                const params: {tie:number ,osa:number ,etaisyys:number,  tunniste: string, palautusarvot: string, ajr?: string, hallinnollinen_luokka:string } = {
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

        if (sourcePointAssets.length === 0) {
            console.log("No velho assets to fetch roadlinks for")
            return []
        }

        const chunkedData = chunkData(sourcePointAssets, chunkSize);
        const promises = chunkedData.map(chunk => fetchVKM(chunk));

        try {
            const results = await Promise.all(promises);
            const flatResults = results.flat();

            // VelhoLinearAsset matches 0 to 1 LinkData
            const mappedResults: AssetWithLinkData[] = sourcePointAssets.flatMap(asset => {
                const match = flatResults.find(r => r.tunniste === asset.oid);
                return match
                    ? [{
                        asset,
                        linkData: [{
                            linkId: match.link_id,
                            mValue: match.m_arvo,
                            municipalityCode: match.kuntakoodi
                        }]
                    }]
                    : [];
            });

            return mappedResults;
        } catch (err) {
            console.error(err);
            throw new Error("Erroe during vkm fetch")
        }
    }

    override filterRoadLinks(assetsWithLinkData: AssetWithLinkData[],links:RoadLink[]): AssetWithLinkData[] {
        if (assetsWithLinkData.length === 0) {
            console.log("No velho assets to filter")
            return []
        }
        const linkIds = links.map(a => a.linkId)
        return assetsWithLinkData.filter(s =>
            s.linkData?.[0]?.linkId !== undefined && linkIds.some(linkid => s.linkData?.[0]?.linkId === linkid)
        );
    }

     async saveNewAssets(asset_type_id: number, newAssets: AssetWithLinkData[]) {

        if (newAssets.length === 0) {
            console.log("No velho assets to save.")
            return
        }

        const client = await getClient();
        const timeStamp = Date.now() - (Date.now() % (24 * 60 * 60 * 1000)) - (5 * 60 * 60 * 1000);

        try {
            await client.connect();

            await client.query('BEGIN');
            const insertPromises = newAssets.map(async (assetWithLinkData) => {
                const pointAsset = assetWithLinkData.asset as VelhoPointAsset
                const pointGeometry = `ST_GeomFromText('POINT(${pointAsset.keskilinjageometria?.coordinates[0]} ${pointAsset.keskilinjageometria?.coordinates[1]} 0)', 3067)`;
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
                    assetWithLinkData.asset.oid,
                    asset_type_id,
                    'Tievelho-import',
                    assetWithLinkData.linkData?.[0]?.municipalityCode,
                    assetWithLinkData.linkData?.[0]?.mValue,
                    assetWithLinkData.linkData?.[0]?.linkId,
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

     async updateAssets(asset_type_id: number, assetsToUpdate: AssetWithLinkData[]) {

        if (this.updateAssets.length === 0) {
            console.log("No assets to update.")
            return
        }

        const client = await getClient();
        const timeStamp = Date.now() - (Date.now() % (24 * 60 * 60 * 1000)) - (5 * 60 * 60 * 1000);

        try {
            await client.connect();

            await client.query('BEGIN');
            const updatePromises = assetsToUpdate.map(async (assetWithLinkData) => {
                const pointAsset = assetWithLinkData.asset as VelhoPointAsset
                const pointGeometry = `ST_GeomFromText('POINT(${pointAsset.keskilinjageometria?.coordinates[0]} ${pointAsset.keskilinjageometria?.coordinates[1]} 0)', 3067)`;
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
                    assetWithLinkData.linkData?.[0]?.municipalityCode,
                    assetWithLinkData.asset.oid,
                    assetWithLinkData.linkData?.[0]?.mValue,
                    assetWithLinkData.linkData?.[0]?.linkId,
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