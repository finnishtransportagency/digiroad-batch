import { AssetWithLinkData, VelhoAsset, VelhoLinearAsset } from "./assetHandler";
import { getClient } from "./fetchAndProcess";
import { LinearAssetHandler } from "./linearAssetHandler";

export enum PavementClass {
    Asphalt = 1, //asfaltti
    Cobblestone = 2, //kivi
    UnboundWearLayer = 3, //sitomaton kulutuskerros
    OtherPavementClasses = 4, //muut päällysteluokat
    Unknown = 99 //päällystetty, tyyppi tuntematon
}

export interface VelhoPavementAsset extends VelhoLinearAsset {
    ominaisuudet?: {
        materiaali?: string;
        'pintauksen-tyyppi'?: string;
        uusiomateriaali?: string;
        tyyppi?: string;
        'paallysteen-tyyppi'?: string;
        runkomateriaali?: string;
        'velhoSource'?:string;
        drProperty?:PavementClass;
    }
}

export class PavementHandler extends LinearAssetHandler {

    // the original velho source of each pavement is necessary for correct mappings and filterings
    sourceByOid: { [oid: string]: string } = {};

    // pavements mapped by oid to digiroad pavement types
    pavementByOid: { [oid: string]: PavementClass } = {}

    sourcesWithVersioning = ['ladottavat-pintarakenteet', 'muut-pintarakenteet']

    override fetchSource = async (token: string, ely: string, paths: string[]): Promise<VelhoAsset[]> => {
        const allVelhoAssets = await Promise.all(
            paths.map(async (path) => {
                const srcData: VelhoAsset[] = await this.fetchSourceFromPath(token, ely, path);
                srcData.forEach((s) => {
                    (s as VelhoPavementAsset ).ominaisuudet.velhoSource =path.replace('paallyste-ja-pintarakenne/', '');
                    this.sourceByOid[s.oid] = path.replace('paallyste-ja-pintarakenne/', '');
                });
                return srcData;
            })
        );
        return allVelhoAssets.flat();
    }

    filterByPavementType = (srcData: VelhoPavementAsset[]): VelhoPavementAsset[] => { // TODO ei tehdä hash index vaan lisätään tämä tieto suoraan
        const asphaltSources = ['muu-materiaali/mm04', 'paallystetyyppi/pt01', 'paallystetyyppi/pt02', 'paallystetyyppi/pt03', 'paallystetyyppi/pt04',
            'paallystetyyppi/pt08', 'paallystetyyppi/pt09', 'paallystetyyppi/pt10', 'paallystetyyppi/pt11', 'paallystetyyppi/pt12', 'paallystetyyppi/pt13',
            'paallystetyyppi/pt14', 'paallystetyyppi/pt15', 'paallystetyyppi/pt16', 'paallystetyyppi/pt17', 'paallystetyyppi/pt18'
        ]
        const cobblestoneSources = ['kiven-materiaali/km01', 'kiven-materiaali/km02', 'kiven-materiaali/km03']
        const unboundSources = ['muu-materiaali/mm03', 'muu-materiaali/mm09', 'sitomattoman-pintarakenteen-runkomateriaali/spr01',
            'sitomattoman-pintarakenteen-runkomateriaali/spr02', 'sitomattoman-pintarakenteen-runkomateriaali/spr03']
        const otherSources = ['muu-materiaali/mm01', 'muu-materiaali/mm02', 'muu-materiaali/mm05', 'muu-materiaali/mm06', 'muu-materiaali/mm07',
            'pintauksen-tyyppi/pintaus01', 'pintauksen-tyyppi/pintaus03', 'pintauksen-uusiomateriaali/pu', 'paallystetyyppi/pt07'
        ]
        const unknownTypeSources = ['muu-materiaali/mm08', 'paallystetyyppi/pt21']
        srcData.forEach(s => {
            const velhoSource = this.sourceByOid[s.oid]
            switch (velhoSource) {
                case 'ladottavat-pintarakenteet':
                    if (s.ominaisuudet?.materiaali && cobblestoneSources.includes(s.ominaisuudet.materiaali)) {
                        this.pavementByOid[s.oid] = PavementClass.Cobblestone;
                        s.ominaisuudet.drProperty =PavementClass.Cobblestone;
                    }
                    break
                case 'muut-pintarakenteet':
                    if (s.ominaisuudet?.materiaali) {
                        if (asphaltSources.includes(s.ominaisuudet.materiaali)) {
                            this.pavementByOid[s.oid] = PavementClass.Asphalt;
                            s.ominaisuudet.drProperty =PavementClass.Asphalt;
                        } else if (unboundSources.includes(s.ominaisuudet.materiaali)) {
                            this.pavementByOid[s.oid] = PavementClass.UnboundWearLayer
                            s.ominaisuudet.drProperty =PavementClass.UnboundWearLayer;
                        } else if (otherSources.includes(s.ominaisuudet.materiaali)) {
                            this.pavementByOid[s.oid] = PavementClass.OtherPavementClasses
                            s.ominaisuudet.drProperty =PavementClass.OtherPavementClasses;
                        } else if (unknownTypeSources.includes(s.ominaisuudet.materiaali)) {
                            this.pavementByOid[s.oid] = PavementClass.Unknown
                            s.ominaisuudet.drProperty =PavementClass.Unknown;
                        }
                    }
                    break
                case 'pintaukset':
                    if (s.ominaisuudet?.['pintauksen-tyyppi'] && otherSources.includes(s.ominaisuudet['pintauksen-tyyppi'])) {
                        this.pavementByOid[s.oid] = PavementClass.OtherPavementClasses
                        s.ominaisuudet.drProperty =PavementClass.OtherPavementClasses;
                    } else if (s.ominaisuudet?.uusiomateriaali && otherSources.includes(s.ominaisuudet?.uusiomateriaali)) {
                        this.pavementByOid[s.oid] = PavementClass.OtherPavementClasses
                        s.ominaisuudet.drProperty =PavementClass.OtherPavementClasses;
                    }
                    break
                case 'sidotut-paallysrakenteet':
                    if (s.ominaisuudet?.tyyppi && s.ominaisuudet['paallysteen-tyyppi'] && s.ominaisuudet.tyyppi === 'sidotun-paallysrakenteen-tyyppi/spt01') {
                        if (asphaltSources.includes(s.ominaisuudet['paallysteen-tyyppi'])) {
                            this.pavementByOid[s.oid] = PavementClass.Asphalt
                            s.ominaisuudet.drProperty =PavementClass.Asphalt;
                        } else if (otherSources.includes(s.ominaisuudet['paallysteen-tyyppi'])) {
                            this.pavementByOid[s.oid] = PavementClass.OtherPavementClasses
                            s.ominaisuudet.drProperty =PavementClass.OtherPavementClasses;
                        } else if (unknownTypeSources.includes(s.ominaisuudet['paallysteen-tyyppi'])) {
                            this.pavementByOid[s.oid] = PavementClass.Unknown
                            s.ominaisuudet.drProperty =PavementClass.Unknown;
                        }
                    }
                    break
                case 'sitomattomat-pintarakenteet':
                    if (s.ominaisuudet?.runkomateriaali && unboundSources.includes(s.ominaisuudet.runkomateriaali)) {
                        this.pavementByOid[s.oid] = PavementClass.UnboundWearLayer
                    }
                    break
                default:
                    throw new Error('unrecognized pavement source')
            }
        })

        return srcData.filter(s => Object.keys(this.pavementByOid).includes(s.oid))
    }

    /**
     * This method performs first the parent class filter. Then it filters the velho assets on main lanes. 
     * If the roadway has lanes to both directions the other side lane (kanu21) is discarded to avoid duplicates
     * as it's expected that the pavement is the same to both directions. Moreover, this method filters out 
     * the pavement types not imported to Digiroad
     * @param srcData all velho assets for ely
     * @param asset_name asset_name as defined in lambda
     * @returns 
     */
    override filterUnnecessary(srcData: VelhoPavementAsset[]): VelhoPavementAsset[] {
        const mainLanes = ['kaista-numerointi/kanu11', 'kaista-numerointi/kanu21', 'kaista-numerointi/kanu31']
        const mainLanesFromOneSide = ['kaista-numerointi/kanu11', 'kaista-numerointi/kanu31']
        const srcWithValidStatus = super.filterUnnecessary(srcData) as VelhoPavementAsset[];
        const necessaryAssets = srcWithValidStatus.filter(s => {
            if (s.sijaintitarkenne.ajoradat && s.sijaintitarkenne.ajoradat.length === 1 && s.sijaintitarkenne.ajoradat[0] === 'ajorata/ajr0') {
                return !s.sijaintitarkenne.kaistat || s.sijaintitarkenne.kaistat.length === 0 || s.sijaintitarkenne.kaistat.some(lane => mainLanesFromOneSide.includes(lane))
            } else {
                return !s.sijaintitarkenne.kaistat || s.sijaintitarkenne.kaistat.length === 0 || s.sijaintitarkenne.kaistat.some(lane => mainLanes.includes(lane))
            }
        })
        return this.filterByPavementType(necessaryAssets)
    };

    override async saveNewAssets(asset_type_id: number, newAssets: AssetWithLinkData[]) {

        if (newAssets.length === 0) {
            console.log("No assets to save.");
            return;
        }

        const client = await getClient();
        const timeStamp = Date.now() - (Date.now() % (24 * 60 * 60 * 1000)) - (5 * 60 * 60 * 1000);

        try {
            await client.connect();
            await client.query('BEGIN');

            // read property id and enumerated value ids once instead of subquerying them for every asset
            const propertyResult = await client.query(
                `SELECT id as property_id 
                 FROM property 
                 WHERE asset_type_id = $1 AND public_id = 'paallysteluokka'`,
                [asset_type_id]
            );

            const propertyId = propertyResult.rows[0]?.property_id;
            if (!propertyId) {
                throw new Error('Property id not found.');
            }

            const enumeratedValueResult = await client.query(
                `SELECT id, value 
                 FROM enumerated_value 
                 WHERE property_id = $1`,
                [propertyId]
            );

            const enumeratedValueMap = new Map<number, number>();
            enumeratedValueResult.rows.forEach(row => {
                enumeratedValueMap.set(Number(row.value), Number(row.id));
            });

            const insertPromises = newAssets.map((assetWithLinkData) => {
                return Promise.all((assetWithLinkData.linkData || []).map(async (linkData) => {
                    const pavementType = this.pavementByOid[assetWithLinkData.asset.oid];
                    const enumeratedValueId = enumeratedValueMap.get(pavementType);
                    if (!enumeratedValueId) {
                        throw new Error(`No enumerated value ID found for value: ${pavementType}`);
                    }

                    const insertSql = `
                        WITH asset_insert AS (
                            INSERT INTO asset (id, external_id, asset_type_id, created_by, created_date, municipality_code)
                            VALUES (nextval('primary_key_seq'), $1, $2, $3, current_timestamp, $4)
                            RETURNING id
                        ),
                        position_insert AS (
                            INSERT INTO lrm_position (id, start_measure, end_measure, link_id, side_code, adjusted_timestamp, link_source, modified_date)
                            VALUES (nextval('lrm_position_primary_key_seq'), $5, $6, $7, $8, $9, $10, current_timestamp)
                            RETURNING id
                        ),
                        asset_link_insert AS (
                            INSERT INTO asset_link (asset_id, position_id)
                            VALUES ((SELECT id FROM asset_insert), (SELECT id FROM position_insert))
                            RETURNING asset_id
                        )
                        INSERT INTO single_choice_value (asset_id, enumerated_value_id, property_id, modified_date, modified_by)
                        VALUES ((SELECT asset_id FROM asset_link_insert), $11, $12, current_timestamp, $3);
                    `;

                    await client.query(insertSql, [
                        assetWithLinkData.asset.oid,
                        asset_type_id,
                        'Tievelho-import',
                        linkData.municipalityCode,
                        linkData.mValue,
                        linkData.mValueEnd,
                        linkData.linkId,
                        linkData.sideCode,
                        timeStamp,
                        1, //normal link interface
                        enumeratedValueId,
                        propertyId
                    ]);
                }));
            });

            await Promise.all(insertPromises);
            await client.query('COMMIT');
        } catch (err) {
            console.error('err', err);
            await client.query('ROLLBACK');
            throw new Error('500 during saving');
        } finally {
            await client.end();
        }
    };

    override async updateAssets(asset_type_id: number, assetsToUpdate: AssetWithLinkData[]) {

        const assetsWithVersioning = assetsToUpdate.filter(a => this.sourcesWithVersioning.includes(this.sourceByOid[a.asset.oid]));

        if (assetsWithVersioning.length !== assetsToUpdate.length) {
            console.log('There were non-versioned assets in assets to update:', assetsToUpdate.filter(atu => !assetsWithVersioning.includes(atu)).map(a => a.asset.oid));
        }

        if (assetsWithVersioning.length === 0) {
            console.log("No assets to update.");
            return;
        }

        const client = await getClient();
        const timeStamp = Date.now() - (Date.now() % (24 * 60 * 60 * 1000)) - (5 * 60 * 60 * 1000);

        try {
            await client.connect();
            await client.query('BEGIN');

            const propertyResult = await client.query(
                `SELECT id as property_id 
                 FROM property 
                 WHERE asset_type_id = $1 AND public_id = 'paallysteluokka'`,
                [asset_type_id]
            );

            const propertyId = propertyResult.rows[0]?.property_id;
            if (!propertyId) {
                throw new Error('Property id not found for the given asset type and public id.');
            }

            const enumeratedValuesResult = await client.query(
                `SELECT id, value 
                 FROM enumerated_value 
                 WHERE property_id = $1`,
                [propertyId]
            );

            const enumeratedValueMap = new Map<number, number>();
            enumeratedValuesResult.rows.forEach(row => {
                enumeratedValueMap.set(Number(row.value), Number(row.id));
            });

            const oidsToExpire = assetsWithVersioning.map(asset => asset.asset.oid);

            const expiredAssetsSql = `
                WITH expired_assets AS (
                    UPDATE asset
                    SET valid_to = current_timestamp, modified_by = 'Tievelho-update', modified_date = current_timestamp
                    WHERE external_id = ANY($1::text[])
                    RETURNING external_id, created_by, created_date
                )
                SELECT external_id, created_by, created_date FROM expired_assets;
            `;
            const expiredAssetsResult = await client.query(expiredAssetsSql, [oidsToExpire]);

            const originalCreationData = new Map<string, { created_by: string; created_date: Date }>();
            expiredAssetsResult.rows.forEach(row => {
                originalCreationData.set(row.external_id, { created_by: row.created_by, created_date: row.created_date });
            });

            const insertPromises = assetsWithVersioning.map(assetWithLinkData => {
                return Promise.all((assetWithLinkData.linkData || []).map(async (linkData) => {
                    const pavementType = this.pavementByOid[assetWithLinkData.asset.oid];
                    const enumeratedValueId = enumeratedValueMap.get(pavementType);
                    if (!enumeratedValueId) {
                        throw new Error(`No enumerated value id found for value: ${pavementType}`);
                    }

                    const { created_by, created_date } = originalCreationData.get(assetWithLinkData.asset.oid) || {
                        created_by: 'Tievelho-import',
                        created_date: new Date()
                    };

                    const insertSql = `
                        WITH asset_insert AS (
                            INSERT INTO asset (id, external_id, asset_type_id, created_by, created_date, modified_by, modified_date, municipality_code)
                            VALUES (nextval('primary_key_seq'), $1, $2, $3, $4, 'Tievelho-update', current_timestamp, $5)
                            RETURNING id
                        ),
                        position_insert AS (
                            INSERT INTO lrm_position (id, start_measure, end_measure, link_id, side_code, adjusted_timestamp, modified_date)
                            VALUES (nextval('lrm_position_primary_key_seq'), $6, $7, $8, $9, $10, current_timestamp)
                            RETURNING id
                        ),
                        asset_link_insert AS (
                            INSERT INTO asset_link (asset_id, position_id)
                            VALUES ((SELECT id FROM asset_insert), (SELECT id FROM position_insert))
                            RETURNING asset_id
                        )
                        INSERT INTO single_choice_value (asset_id, enumerated_value_id, property_id, modified_date)
                        VALUES ((SELECT asset_id FROM asset_link_insert), $11, $12, current_timestamp);
                    `;

                    await client.query(insertSql, [
                        assetWithLinkData.asset.oid,
                        asset_type_id,
                        created_by,
                        created_date,
                        linkData.municipalityCode,
                        linkData.mValue,
                        linkData.mValueEnd,
                        linkData.linkId,
                        linkData.sideCode,
                        timeStamp,
                        enumeratedValueId,
                        propertyId
                    ]);
                }));
            });

            await Promise.all(insertPromises);
            await client.query('COMMIT');
        } catch (err) {
            console.error('Error:', err);
            await client.query('ROLLBACK');
            throw new Error('500: Transaction failed');
        } finally {
            await client.end();
        }
    };

}
