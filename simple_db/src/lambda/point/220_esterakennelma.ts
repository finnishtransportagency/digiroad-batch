import { getClient } from "../../util";

export const handler = async (event:any, ctx:any) => {
    console.log(`Event: ${JSON.stringify(event, null, 2)}`);

    const client = await getClient()
    try {
        await client.connect()

        {
            const sql = `
            drop table if exists simple.obstacles;
            create table simple.obstacles (
                id SERIAL PRIMARY KEY,
                external_id VARCHAR(128),

                -- object attributes
                suggest_box smallint,
                esterakennelma smallint,

                -- validity attributes
                valid_from timestamp,
                valid_to timestamp,

                -- creation attributes
                created_by VARCHAR(128),
                created_date timestamp,
                modified_by VARCHAR(128),
                modified_date timestamp,

                -- position things
                link_id VARCHAR(40),
                m_value numeric(1000,3),
                geometry geometry,
                floating bool,
                bearing smallint
            )
            ;`
            console.log(sql)
            const query = {
                text: sql,
                rowMode: 'array',
            }
            const result = await client.query(query)
        }


        const sql = `
        INSERT INTO simple.obstacles (
            external_id,
            suggest_box,
            esterakennelma,
            valid_from,
            valid_to,
            created_by,
            created_date,
            modified_by,
            modified_date,
            link_id,
            m_value,
            geometry,
            floating,
            bearing
        )
        SELECT
            asset.external_id AS external_id,
            (
                SELECT ev.value 
                FROM multiple_choice_value scv
                    LEFT JOIN enumerated_value ev ON ev.id = scv.enumerated_value_id
                    LEFT JOIN property p ON p.id = scv.property_id
                WHERE scv.asset_id = asset.id AND p.public_id = 'suggest_box'
            )::SMALLINT AS suggest_box,
            (
                SELECT ev.value 
                FROM single_choice_value scv
                    LEFT JOIN enumerated_value ev ON ev.id = scv.enumerated_value_id
                    LEFT JOIN property p ON p.id = scv.property_id
                WHERE scv.asset_id = asset.id AND p.public_id = 'esterakennelma'
            )::SMALLINT AS esterakennelma,
            asset.valid_from AS valid_from,
            asset.valid_to AS valid_to,
            asset.created_by AS created_by,
            asset.created_date AS created_date,
            asset.modified_by AS modified_by,
            asset.modified_date AS modified_date,
            lp.link_id,
            lp.start_measure::NUMERIC(1000,3) AS m_value,
            asset.geometry,
            asset.floating AS floating, 
            asset.bearing AS bearing
        FROM asset
            LEFT JOIN asset_link 
                ON asset.id = asset_link.asset_id
            LEFT JOIN lrm_position lp 
                ON asset_link.position_id = lp.id
            LEFT JOIN kgv_roadlink kgv 
                ON kgv.linkid = lp.link_id
        WHERE asset.asset_type_id = 220;`
        console.log(sql)
        const query = {
            text: sql,
            rowMode: 'array',
        }
        const result = await client.query(query)
    } catch (err){
        console.log('err',err)
        return {
            statusCode: 400,
            body: err
        }     
    } finally {
        console.log('finally')
        await client.end()
    }

    
}
