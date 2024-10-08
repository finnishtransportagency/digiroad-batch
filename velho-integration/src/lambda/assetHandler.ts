import { getClient, getVelhoBaseUrl } from "./fetchAndProcess"

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
    'sijainti-oid': string;
    sijaintitarkenne: {
        ajoradat: string[];
    };
    oid: string;
    luotu: string;
    muokattu: string;
    'tiekohteen-tila': string | null | undefined;
    // for point asset
    sijainti?: {
        osa: number;
        tie: number;
        etaisyys: number;
    } | null;
    keskilinjageometria:
    | {  // for point asset
        coordinates: [number, number, number];
        type: "Point";
    }
    | {  // for linear asset
        coordinates: [[number, number, number][]];
        type: "MultiLinestring";
    };
    // for linear asset
    alkusijainti?: {
        osa: number;
        tie: number;
        etaisyys: number;
    } | null;
    loppusijainti?: {
        osa: number;
        tie: number;
        etaisyys: number;
    } | null;
}

export interface EnrichedVelhoAsset extends VelhoAsset {
    linkData: Array<{
        linkId?: string;
        mValue?: number;
        mValueEnd?: number;
        municipalityCode?: number;
        sideCode?: number;
    }>;
}

export abstract class AssetHandler {

    abstract getRoadLinks(srcData: VelhoAsset[], vkmApiKey: string): Promise<VelhoAsset[]>;

    fetchSourceData = async (token: string, path: string) => {
        const baseUrl = await getVelhoBaseUrl()
        try {
            const response = await fetch(`${baseUrl}/${path}`, {
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
                text: sql
            }

            const assets: DbAsset[] = (await client.query(query)).rows.map((row: any) => ({
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

    calculateDiff = (srcData: VelhoAsset[], currentData: DbAsset[]) => {
        //TODO create table for these values and fetch from there, when update code is run
        const lastSuccessfulFetch = null

        // exclude assets that have other state than built or unknown 
        const filteredSrc = srcData.filter(src => !src['tiekohteen-tila'] || src['tiekohteen-tila'] === 'tiekohteen-tila/tt03');

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
        return { added: added, removed: null, updatedOld: null, updatedNew: null, notTouched: null }
    }
}