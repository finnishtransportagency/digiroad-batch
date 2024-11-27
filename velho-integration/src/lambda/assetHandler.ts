import { getClient, getVelhoBaseUrl } from "./fetchAndProcess"

export interface DbAsset {
    id: number
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
        kaistat?: string[];
        erotusalueet?: string[];
        keskialue?: string[];
        luiskat?: string[];
        pientareet?: string[];
        puoli?: string[];
    };
    oid: string;
    luotu: string;
    muokattu: string;
    'tiekohteen-tila': string | null | undefined;
}

export interface VelhoPointAsset extends VelhoAsset {
    sijainti?: {
        osa: number;
        tie: number;
        etaisyys: number;
    } | null;
    keskilinjageometria: {
        coordinates: [number, number, number];
        type: "Point";
    }
}

export interface VelhoLinearAsset extends VelhoAsset {
    keskilinjageometria: {
        coordinates: [[number, number, number][]];
        type: "MultiLinestring";
    };
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

interface LinkInformation {
    linkId: string;
    mValue: number;
    mValueEnd?: number;
    municipalityCode: number;
    sideCode?: number;
    linkTotalLength?:number;
    roadadress?: {
        ajorata: number;
        osa: number;
        etaisyys: number;
        ajorata_loppu: number;
        osa_loppu: number;
        etaisyys_loppu: number;
    }
}

export interface AssetWithLinkData {
    asset: VelhoAsset;
    linkData: Array<LinkInformation>;
}

export interface AssetInLinkIndex {
     [index: string]:  Set<AssetInLink>;
}

export interface AssetInLink {
    asset: VelhoAsset;
    linkData: LinkInformation;
}

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
 AssetHandler duty is to provide generic base logic for lambda.
 It implements the lowest common denominator logic only.
 */
export abstract class AssetHandler {

    abstract getRoadLinks(srcData: VelhoAsset[], vkmApiKey: string): Promise<AssetWithLinkData[]>;

    abstract filterRoadLinks(src: AssetWithLinkData[]): Promise<AssetWithLinkData[]>;
    /* 
        Final step for lambda. Override and add saveNewAssets and updateAssets logic with your own addition logic per asset type.
        AssetHandler is agnostic about how final data is processed and updated into database. 
     */
    abstract saveChanges(asset_type_id: number, newAssets: AssetWithLinkData[],assetsToUpdate: AssetWithLinkData[]): Promise<void>;

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

}