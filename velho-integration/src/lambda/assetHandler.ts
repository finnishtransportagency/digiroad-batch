import { getClient } from "./fetchAndProcess"

export interface DbAsset {
    externalId: string | null,
    createdBy: string,
    createdDate: Date,
    modifiedBy: string | null,
    modifiedDate: Date | null,
    linkid: string,
    startMeasure: number | null,
    endMeasure: number | null,
    municipalitycode: number
}

export interface VelhoAsset {
    sijainti: {
      osa: number,
      tie: number,
      etaisyys: number,
    },
    'sijainti-oid': string,
    sijaintitarkenne: {
      ajoradat: [
        string
      ]
    },
    oid: string,
    luotu: string,
    muokattu: string,
    'tiekohteen-tila': string | null
}

export abstract class AssetHandler {
    fetchDestData = async (typeId: number, municipalities: number[]) => {
        const client = await getClient()
        try {
            await client.connect()
            const sql = `
            select asset.external_id, asset.created_by, asset.created_date, asset.modified_by, asset.modified_date, kgv.linkid, lp.start_measure, lp.end_measure, kgv.municipalitycode
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
                text: sql,
                rowMode: 'array',
            }
            const result = await client.query(query)
    
            const assets: DbAsset[] = result.rows.map((row: any) => ({
                externalId: row[0] !== null ? row[0] : null,
                createdBy: row[1],
                createdDate: new Date(row[2]),
                modifiedBy: row[3] !== null ? row[3] : null,
                modifiedDate: row[4] !== null ? new Date(row[4]) : null,
                linkid: row[5],
                startMeasure: row[6] !== null ? row[6] : null,
                endMeasure: row[7] !== null ? row[7] : null,
                municipalitycode: row[8],
            }));
            
    
            return assets
        } catch (err){
            console.log('err',err)      
        } finally {
            await client.end()
        }
        throw '500: something weird happened'
    }

    calculateDiff = <T extends VelhoAsset>(srcData: T[], currentData: DbAsset[]) => { 
        //TODO create table for these values and fetch from there, when update code is run
        const lastSuccessfulFetch: Date = new Date(new Date().setMonth(new Date().getMonth() - 6));
    
        // exclude assets that have other state than built or unknown 
        const filteredSrc = srcData.filter(src => src['tiekohteen-tila'] === null || src['tiekohteen-tila'] === 'tiekohteen-tila/tt03')
    
        //TODO implement remove and update later
        const preserved = currentData.filter(curr => filteredSrc.some(src => src.oid === curr.externalId));
        //const removed = currentData.filter(curr => !filteredSrc.some(src => src.oid === curr.externalId))
        const added = filteredSrc.filter(src => !preserved.some(p => p.externalId === src.oid));
        /* const updatedOld = preserved.filter(p => {
            const correspondingSrcAsset = filteredSrc.find(src => src.oid === p.externalId);
            if (correspondingSrcAsset && correspondingSrcAsset.muokattu) {
              const muokattuDate = new Date(correspondingSrcAsset.muokattu);
              return muokattuDate > lastSuccessfulFetch;
            }
            return false;
          });
        const updatedNew = filteredSrc.filter(src => updatedOld.some(u => u.externalId === src.oid))  
        const notTouched = preserved.filter(p => !updatedOld.some(u => u.externalId === p.externalId));   */
    
        //TODO refactor updatedAsset structure to something more handy
        return {added: added, removed: null, updatedOld: null, updatedNew: null, notTouched: null}}
}