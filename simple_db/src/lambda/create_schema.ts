import { getClient } from "../util"

export const handler = async (evt:any, ctx:any) => {
    const client = await getClient()
    try {
        await client.connect()
        const user = 'X'
        const sql = `
        CREATE SCHEMA IF NOT EXISTS simple;
        GRANT USAGE ON SCHEMA simple TO ${user};
        GRANT CREATE ON SCHEMA simple TO ${user};
        GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA simple TO ${user};
        `
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