import {Geometry, LineString} from "wkx";
import {DbAsset, RoadLink} from "./type/type";
import {AssetWithLinkData, VelhoAsset} from "./type/velhoAsset";
import {getClient, getVelhoBaseUrl} from "./utils/AWSUtils";

interface Kohdeluokka {
    jaottelut: {
        "alueet/ely": {
            [ely: string]: {
                polku: string
            }
        }
    }
}
/*
 AssetHandler duty is to provide generic base logic for the lambda.
 It implements the lowest common denominator logic only.
 */
export abstract class AssetHandler {

    abstract getRoadLinks(srcData: VelhoAsset[], vkmApiKey: string): Promise<AssetWithLinkData[]>;

    abstract filterRoadLinks(src: AssetWithLinkData[],links:RoadLink[]): AssetWithLinkData[];

    async getRoadLinksDB(src: AssetWithLinkData[]): Promise<RoadLink[]> {

        if (src.length === 0) {
            console.log("No velho assets which need RoadLink")
            return []
        }

        const vkmLinkIds = src.flatMap(asset => asset.linkData.map(link => link.linkId)).filter(id => id);

        const client = await getClient();

        const missingLinkIds: string[] = [];

        try {
            await client.connect();
            const linkIdsString = vkmLinkIds.map(linkId => `'${linkId}'`).join(',');
            const sql = `
                SELECT kr.linkid,
                       CASE
                           WHEN td.traffic_direction = 2 THEN 1 -- Both Directions
                           WHEN td.traffic_direction = 3 THEN 3 -- Against Digitizing
                           WHEN td.traffic_direction = 4 THEN 2 -- Towards Digitizing
                           ELSE
                               CASE
                                   WHEN kr.directiontype = 0 THEN 1 -- Both Directions
                                   WHEN kr.directiontype = 1 THEN 2 -- Towards Digitizing
                                   WHEN kr.directiontype = 2 THEN 3 -- Against Digitizing
                                   END
                           END as side_code,
                       kr.geometrylength,
                       kr.shape
                FROM kgv_roadlink kr
                         LEFT JOIN administrative_class ac ON kr.linkid = ac.link_id
                         LEFT JOIN traffic_direction td ON kr.linkid = td.link_id
                WHERE kr.linkid IN (${linkIdsString})
                  AND COALESCE(ac.administrative_class, kr.adminclass) = 1;
            `;

            const query = {text: sql,rowMode: 'array'};
            
            const geom = (shape:string)  => {
                if (!shape) return {} as LineString
                const wkbBuffer = new Buffer(shape, 'hex');
                return  Geometry.parse(wkbBuffer) as LineString
            }
            
            const result = await client.query(query);

            const matchedLinks = result.rows.map((row: [string, number,number,string]) => ({
                linkId: row[0],
                sideCode: row[1],
                geometryLength:row[2],
                shape:geom(row[3])
            } as RoadLink));

            console.log(`VKM links found in db ${matchedLinks.length}/${vkmLinkIds.length}`);
            const linksIds = matchedLinks.map(a=>a.linkId)
            const missingLinks = vkmLinkIds.filter(linkId => !linksIds.includes(linkId));

            if (missingLinks.length > 0) {
                console.log('Missing links in db:', missingLinks.join(','));
            }

            return matchedLinks

        } catch (err) {
            console.log('err', err);
            throw '500 during road link fetching';
        } finally {
            await client.end();

            if (missingLinkIds.length > 0) {
                console.log('VKM links not found in db:', missingLinkIds.join(','));
            } else {
                console.log('All VKM links were found in db.');
            }
        }
    };
    
    /* 
        Final step for lambda. Override and add saveNewAssets and updateAssets logic with your own addition logic per asset type.
        AssetHandler is agnostic about how final data is processed and updated into database. 
     */
    abstract saveChanges(asset_type_id: number, newAssets: AssetWithLinkData[],assetsToUpdate: AssetWithLinkData[],links:RoadLink[]): Promise<void>;

    private getElyPath = async (token: string, ely: string, path: string): Promise<string> => {
        const baseUrl = await getVelhoBaseUrl()
        const response = await fetch(`${baseUrl}/kohdeluokka/${path}`, {
            method: 'GET',
            headers: {
                'Authorization': 'Bearer ' + token,
            },
        });

        if (!response.ok) {
            throw new Error(`HTTP error in list kohdeluokka! Status: ${response.status}`);
        }

        const data = await response.json() as Kohdeluokka
        const elyKey = `ely/ely${ely}`;

        const elyEntry = data.jaottelut["alueet/ely"][elyKey];

        if (!elyEntry) {
            throw new Error(`Ely ${ely} not found in list Kohdeluokka.`);
        }

        return elyEntry.polku;
    }

    fetchSourceFromPath = async (token: string, ely: string, path: string) => {
        const baseUrl = await getVelhoBaseUrl()
        const elyPath = await this.getElyPath(token, ely, path);
        try {
            const response = await fetch(`${baseUrl}/${elyPath}`, {
                method: 'GET',
                headers: {
                    'Authorization': 'Bearer ' + token,
                },
            });

            if (!response.ok) {
                throw new Error(`HTTP error in fetch source data from velho! Status: ${response.status}`);
            }

            const ndjson = await response.text()
            return ndjson
                .split('\n')
                .filter((line: string) => line.trim().length > 0) // Remove any empty lines
                .map((line: string) => JSON.parse(line))
        } catch (err) {
            console.log(err)
            return []
        }
    }

    // the default implementation when all velho assets come from one path
    fetchSource = async (token: string, ely: string, paths: string[]) => {
        return await this.fetchSourceFromPath(token, ely, paths[0])
    }

    fetchDestData = async (typeId: number, municipalities: number[]) => {
        const client = await getClient()
        try {
            await client.connect()
            const sql = `
            select asset.id, asset.external_id, asset.created_by, asset.created_date, asset.modified_by, asset.modified_date, kgv.linkid, lp.start_measure, lp.end_measure, kgv.municipalitycode
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
                text: sql
            }

            const assets: DbAsset[] = (await client.query(query)).rows.map((row: any) => ({
                id: row.id,
                externalId: row.external_id !== null ? row.external_id : null,
                createdBy: row.created_by,
                createdDate: new Date(row.created_date),
                modifiedBy: row.modified_by !== null ? row.modified_by : null,
                modifiedDate: row.modified_date !== null ? new Date(row.modified_date) : null,
                linkid: row.link_id,
                startMeasure: row.start_measure !== null ? row.start_measure : null,
                endMeasure: row.end_measure !== null ? row.end_measure : null,
                municipalitycode: row.municipality_code,
            }));

            return assets
        } catch (err) {
            console.log('err', err)
        } finally {
            await client.end()
        }
        throw '500: something weird happened'
    }
    // exclude assets that have other state than built or unknown
    filterUnnecessary(srcData: VelhoAsset[]): VelhoAsset[] {
        return srcData.filter(src => !src['tiekohteen-tila'] || src['tiekohteen-tila'] === 'tiekohteen-tila/tt03')
    }

    calculateDiff(srcData: VelhoAsset[], currentData: DbAsset[]) {

        const preserved = currentData.filter(curr => srcData.some(src => src.oid === curr.externalId));
        const expired = currentData.filter(curr => !srcData.some(src => src.oid === curr.externalId))
        const added = srcData.filter(src => !preserved.some(p => p.externalId === src.oid));

        // asset is considered updated if velho source is modified later than either the created or modified date of the db asset
        const updatedExternalIds = preserved.filter(p => {
            const correspondingSrcAsset = srcData.find(src => src.oid === p.externalId);
            if (correspondingSrcAsset && correspondingSrcAsset.muokattu) {
                const muokattuDate = new Date(correspondingSrcAsset.muokattu);
                if (p.modifiedDate) {
                    return muokattuDate > p.modifiedDate
                } else {
                    return muokattuDate > p.createdDate
                }
            }
            return false;
        }).map(u => u.externalId);
        const updated = srcData.filter(src => updatedExternalIds.includes(src.oid))
        const notTouched = preserved.filter(p => !updatedExternalIds.includes(p.externalId));

        return { added: added, expired: expired, updated: updated, notTouched: notTouched }
    }

    expireAssets = async (assetsToExpire: DbAsset[]) => {
        if (assetsToExpire.length === 0) {
            console.log("no assets to expire")
            return
        }

        const client = await getClient();
        const idsToExpire = assetsToExpire.map(asset => asset.id)

        try {
            await client.connect();

            await client.query('BEGIN');
            const expireSql = `
            UPDATE asset SET modified_by = 'Tievelho-expire', modified_date = current_timestamp, valid_to = current_timestamp
            WHERE id in (${idsToExpire.join(',')})
            `;

            await client.query(expireSql)

            await client.query('COMMIT');
        } catch (err) {
            console.error('err', err);
            await client.query('ROLLBACK');
            throw new Error('500 during expire assets');
        } finally {
            await client.end();
        }
    };
    fetchMunicipalities = async (ely: string): Promise<number[]> => {
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

    async getPropertyId(publicId: string, typeId: number): Promise<number> {
        const client = await getClient();

        try {
            await client.connect();

            const sql = `
            SELECT id 
            FROM property 
            WHERE public_id = $1 
              AND asset_type_id = $2
        `;
            const query = { text: sql, values: [publicId, typeId] };

            const result = await client.query(query);

            if (result.rows.length === 0) {
                throw new Error(`Property not found for public_id=${publicId} and asset_type_id=${typeId}`);
            }

            return result.rows[0].id;
        } catch (err) {
            console.error('Error fetching property ID:', err);
            throw '500: Error fetching property ID';
        } finally {
            await client.end();
        }
    }


    /**
     *
     * @param assetId Id of the asset for which the property is being created
     * @param typeId Asset type id
     * @param publicId public_id of property to insert
     * @param value Text value to insert
     * @param groupedId Used to group trafficLight properties to correct light, on other asset types use default 0
     */
    async insertTextProperty(assetId: number, typeId: number, publicId: string, value: string, groupedId: number = 0): Promise<void> {
        const propertyId = await this.getPropertyId(publicId, typeId);
        const client = await getClient();

        try {
            await client.connect();

            const insertSql = `
            INSERT INTO text_property_value (id, property_id, asset_id, value_fi, created_date, grouped_id)
            VALUES (nextval('primary_key_seq'), $1, $2, $3, current_timestamp, $4)
        `;
            const insertQuery = { text: insertSql, values: [propertyId, assetId, value, groupedId] };

            await client.query(insertQuery);

        } catch (err) {
            console.error('Error inserting text property value:', err);
            throw '500: Something went wrong during insertTextProperty';
        } finally {
            await client.end();
        }
    }

    async updateTextProperty(assetId: number, typeId: number, publicId: string, value: string, groupedId: number = 0): Promise<void> {
        const propertyId = await this.getPropertyId(publicId, typeId);
        const client = await getClient();

        try {
            await client.connect();

            const updateSql = `
                UPDATE text_property_value
                SET value_fi = $1
                WHERE property_id = $2
                AND asset_id = $3
                AND grouped_id = $4
            `;
            const updateQuery = {text: updateSql, values: [value, propertyId, assetId, groupedId]};

            const result = await client.query(updateQuery);
            if (result.rowCount === 0) {
                throw `404: Text property not found for assetId ${assetId}, publicId ${publicId}, and groupedId ${groupedId}`;
            }

        } catch (err) {
            console.error('Error updating text property value:', err);
            throw '500: Something went wrong during updateTextProperty';
        } finally {
            await client.end();
        }
    }

    async deleteTextProperty(assetId: number, typeId: number, publicId: string): Promise<void> {
        const propertyId = await this.getPropertyId(publicId, typeId);
        const client = await getClient();

        try {
            await client.connect();

            const deleteSql = `
                DELETE
                FROM text_property_value
                WHERE property_id = $1
                AND asset_id = $2
            `;
            const deleteQuery = {text: deleteSql, values: [propertyId, assetId]};

            const result = await client.query(deleteQuery);
            if (result.rowCount === 0) {
                throw `404: Text property not found for assetId ${assetId}, publicId ${publicId}`;
            }

        } catch (err) {
            console.error('Error deleting text property value:', err);
            throw '500: Something went wrong during deleteTextProperty';
        } finally {
            await client.end();
        }
    }

    /**
     *
     * @param assetId Id of the asset for which the property is being created
     * @param typeId Asset type id
     * @param publicId public_id of property to insert
     * @param value Number value to insert
     * @param groupedId Used to group trafficLight properties to correct light, on other asset types use default 0
     */
    async insertNumberProperty(assetId: number, typeId: number, publicId: string, value: number, groupedId: number = 0): Promise<void> {
        const propertyId = await this.getPropertyId(publicId, typeId);
        const client = await getClient();

        try {
            await client.connect();

            const insertSql = `
            INSERT INTO number_property_value (id, asset_id, property_id, value, grouped_id)
            VALUES (nextval('primary_key_seq'), $1, $2, $3, $4)
        `;
            const insertQuery = { text: insertSql, values: [assetId, propertyId, value, groupedId] };

            await client.query(insertQuery);

        } catch (err) {
            console.error('Error inserting number property value:', err);
            throw '500: Something went wrong during insertNumberProperty';
        } finally {
            await client.end();
        }
    }

    async updateNumberProperty(assetId: number, typeId: number, publicId: string, value: number, groupedId: number = 0): Promise<void> {
        const propertyId = await this.getPropertyId(publicId, typeId);
        const client = await getClient();

        try {
            await client.connect();

            const updateSql = `
                UPDATE number_property_value
                SET value = $1
                WHERE asset_id = $2
                AND property_id = $3
                AND grouped_id = $4
            `;
            const updateQuery = {text: updateSql, values: [value, assetId, propertyId, groupedId]};

            const result = await client.query(updateQuery);
            if (result.rowCount === 0) {
                throw `404: Number property not found for assetId ${assetId}, publicId ${publicId}, and groupedId ${groupedId}`;
            }

        } catch (err) {
            console.error('Error updating number property value:', err);
            throw '500: Something went wrong during updateNumberProperty';
        } finally {
            await client.end();
        }
    }

    async deleteNumberProperty(assetId: number, typeId: number, publicId: string): Promise<void> {
        const propertyId = await this.getPropertyId(publicId, typeId);
        const client = await getClient();

        try {
            await client.connect();

            const deleteSql = `
                DELETE
                FROM number_property_value
                WHERE asset_id = $1
                AND property_id = $2
            `;
            const deleteQuery = {text: deleteSql, values: [assetId, propertyId]};

            const result = await client.query(deleteQuery);
            if (result.rowCount === 0) {
                throw `404: Number property not found for assetId ${assetId}, publicId ${publicId}}`;
            }

        } catch (err) {
            console.error('Error deleting number property value:', err);
            throw '500: Something went wrong during deleteNumberProperty';
        } finally {
            await client.end();
        }
    }

    /**
     *
     * @param assetId Id of the asset for which the property is being created
     * @param typeId Asset type id
     * @param publicId public_id of property
     * @param singleChoiceValue value of property using Digiroad enumerations
     * @param groupedId Used to group trafficLight properties to correct light, on other asset types use default 0
     */
    async insertSingleChoicePropertyValue(assetId: number, typeId: number, publicId: string, singleChoiceValue: number, groupedId: number = 0): Promise<void> {
        const propertyId = await this.getPropertyId(publicId, typeId);
        const client = await getClient();

        try {
            await client.connect();

            const insertSql = `
            INSERT INTO single_choice_value(asset_id, enumerated_value_id, property_id, modified_date, grouped_id)
            VALUES ($1,(SELECT id FROM enumerated_value WHERE value = $2 and property_id = $3), $3, current_timestamp, $4)
        `;
            const insertQuery = { text: insertSql, values: [assetId, singleChoiceValue, propertyId, groupedId]};

            await client.query(insertQuery);

        } catch (err) {
            console.error('Error inserting single choice property value:', err);
            throw '500: Something went wrong during insertSingleChoicePropertyValue';
        } finally {
            await client.end();
        }
    }

    async updateSingleChoicePropertyValue(assetId: number, typeId: number, publicId: string, singleChoiceValue: number, groupedId: number = 0): Promise<void> {
        const propertyId = await this.getPropertyId(publicId, typeId);
        const client = await getClient();

        try {
            await client.connect();

            const updateSql = `
                UPDATE single_choice_value
                SET enumerated_value_id = (SELECT id FROM enumerated_value WHERE value = $1 AND property_id = $2),
                    modified_date = current_timestamp
                WHERE asset_id = $3
                AND property_id = $2
                AND grouped_id = $4
            `;
            const updateQuery = {text: updateSql, values: [singleChoiceValue, propertyId, assetId, groupedId]};

            const result = await client.query(updateQuery);
            if (result.rowCount === 0) {
                throw `404: Single choice property not found for assetId ${assetId}, publicId ${publicId}, and groupedId ${groupedId}`;
            }

        } catch (err) {
            console.error('Error updating single choice property value:', err);
            throw '500: Something went wrong during updateSingleChoicePropertyValue';
        } finally {
            await client.end();
        }
    }

    /**
     *
     * @param assetId Id of the asset for which the property is being created
     * @param typeId Asset type id
     * @param publicId public_id of property
     * @param multipleChoiceValue value of property using Digiroad enumerations
     * @param groupedId Used to group trafficLight properties to correct light, on other asset types use default 0
     */
    async insertMultipleChoicePropertyValue(assetId: number, typeId: number, publicId: string, multipleChoiceValue: number, groupedId: number = 0): Promise<void> {
        const propertyId = await this.getPropertyId(publicId, typeId);
        const client = await getClient();

        try {
            await client.connect();

            const insertSql = `
            INSERT INTO multiple_choice_value(id, property_id, asset_id, enumerated_value_id, modified_date, grouped_id)
            VALUES (nextval('primary_key_seq'), $3, $1, (SELECT id FROM enumerated_value WHERE value = $2 and property_id = $3), current_timestamp, $4)
        `;
            const insertQuery = { text: insertSql, values: [assetId, multipleChoiceValue, propertyId, groupedId]};

            await client.query(insertQuery);

        } catch (err) {
            console.error('Error inserting multiple choice property value:', err);
            throw '500: Something went wrong during insertMultipleChoicePropertyValue';
        } finally {
            await client.end();
        }
    }

    async updateMultipleChoicePropertyValue(assetId: number, typeId: number, publicId: string, multipleChoiceValue: number, groupedId: number = 0): Promise<void> {
        const propertyId = await this.getPropertyId(publicId, typeId);
        const client = await getClient();

        try {
            await client.connect();

            const updateSql = `
                UPDATE multiple_choice_value
                SET enumerated_value_id = (SELECT id FROM enumerated_value WHERE value = $1 AND property_id = $2),
                    modified_date = current_timestamp
                WHERE asset_id = $3
                AND property_id = $2
                AND grouped_id = $4
            `;
            const updateQuery = {text: updateSql, values: [multipleChoiceValue, propertyId, assetId, groupedId]};

            const result = await client.query(updateQuery);
            if (result.rowCount === 0) {
                throw `404: Multiple choice property not found for assetId ${assetId}, publicId ${publicId}, and groupedId ${groupedId}`;
            }

        } catch (err) {
            console.error('Error updating multiple choice property value:', err);
            throw '500: Something went wrong during updateMultipleChoicePropertyValue';
        } finally {
            await client.end();
        }
    }

    /**
     *
     * @param mcvId multiple_choice_value.id of the property value to be deleted
     */
    async deleteMultipleChoicePropertyValue(mcvId: number): Promise<void> {
        const client = await getClient();

        try {
            await client.connect();

            const deleteSql = `
                DELETE
                FROM multiple_choice_value
                WHERE id = $1
            `;
            const deleteQuery = {text: deleteSql, values: [mcvId]};

            const result = await client.query(deleteQuery);
            if (result.rowCount === 0) {
                throw `404: Multiple choice property value not found for mcv Id ${mcvId}}`;
            }

        } catch (err) {
            console.error('Error deleting multiple choice property value:', err);
            throw '500: Something went wrong during deleteMultipleChoicePropertyValue';
        } finally {
            await client.end();
        }
    }

}