import { getClient } from "../util"

export const handler = async (evt:any, ctx:any) => {
    const client = await getClient()
    try {
        await client.connect()
        
        const sql = `
        drop table if simple.properties;
        create table simple.properties (
            id INT PRIMARY KEY AUTO_INCREMENT,
            table VARCHAR(128), -- table name of where property is used
            column VARCHAR(128), -- column name 
            code int(8),
            lang_fi VARCHAR(128),
            lang_sv VARCHAR(128)
        );`
        console.log(sql)
        const query = {
            text: sql,
            rowMode: 'array',
        }
        const result = await client.query(query)
    } catch (err){
        console.log('err',err)      
    } finally {
        console.log('finally')
        await client.end()
    }

}