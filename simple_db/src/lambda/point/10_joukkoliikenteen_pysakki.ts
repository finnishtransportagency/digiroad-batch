import { getClient } from "../../util";


export const handler = async (event:any, ctx:any) => {
    console.log(`Event: ${JSON.stringify(event, null, 2)}`);

    const client = await getClient()
    try {
        await client.connect()

        {
            const sql = `
            drop table if exists simple.mass_transit_stop;
            create table simple.mass_transit_stop (
                id SERIAL PRIMARY KEY,
                external_id VARCHAR(128),

                -- object attributes
                suggest_box smallint,

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

