import { getClient } from "../../util";

export const handler = async (event:any, ctx:any) => {
    console.log(`Event: ${JSON.stringify(event, null, 2)}`);

    const client = await getClient()
    try {
        await client.connect()

        {
            const sql = `
            drop table if exists simple.road_width;
            create table simple.road_width (
                id SERIAL PRIMARY KEY,
                external_id VARCHAR(128),

                -- object attributes
                suggest_box smallint,
                width smallint,

                -- validity attributes
                valid_from timestamp,
                valid_to timestamp,
                verified_by VARCHAR(128),
                verified_date timestamp,

                -- creation attributes
                created_by VARCHAR(128),
                created_date timestamp,
                modified_by VARCHAR(128),
                modified_date timestamp,

                -- position things
                link_id VARCHAR(40),
                m_start numeric(1000,3),
                m_end numeric(1000,3),
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
        INSERT INTO simple.road_width (
            external_id,
            suggest_box,
            width,
            valid_from,
            valid_to,
            verified_by,
            verified_date,
            created_by,
            created_date,
            modified_by,
            modified_date,
            link_id,
            m_start,
            m_end,
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
            (select npv.value 
                from number_property_value npv 
                    left join property p 
                        on p.id = npv.property_id
                where npv.asset_id = asset.id and p.public_id = 'width'
            )::SMALLINT as width,
            asset.valid_from AS valid_from,
            asset.valid_to AS valid_to,
            asset.verified_by AS verified_by,
            asset.verified_date AS verified_date,
            asset.created_by AS created_by,
            asset.created_date AS created_date,
            asset.modified_by AS modified_by,
            asset.modified_date AS modified_date,
            lp.link_id,
            lp.start_measure::NUMERIC(1000,3) AS m_start,
            lp.end_measure::NUMERIC(1000,3) AS m_end,
            (ST_LineMerge(ST_LocateBetween(kgv.shape ,lp.start_measure,lp.end_measure))) as geometry,
            asset.floating AS floating, 
            asset.bearing AS bearing
        FROM asset
            LEFT JOIN asset_link 
                ON asset.id = asset_link.asset_id
            LEFT JOIN lrm_position lp 
                ON asset_link.position_id = lp.id
            LEFT JOIN kgv_roadlink kgv 
                ON kgv.linkid = lp.link_id
        WHERE asset.asset_type_id = 120;`
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
