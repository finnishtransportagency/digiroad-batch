import {getClient} from "./fetchAndProcess";
import {
    RoadLink,
    AssetHandler,
    AssetInLink,
    AssetInLinkIndex,
    AssetWithLinkData,
    DbAsset,
    VelhoAsset,
    VelhoLinearAsset
} from "./assetHandler";
import { getClient } from "./fetchAndProcess";
import {AssetHandler, VelhoAsset, DbAsset, AssetWithLinkData, VelhoLinearAsset} from "./assetHandler";
import { VelhoLinearAsset } from "./assetHandler";
import {chunkData, retryTimeout, timer} from "./utils";
import {VelhoPavementAsset} from "./pavementHandler";
import {performance} from "perf_hooks";

export interface ValidVKMFeature {
    properties: {
        tunniste: string;
        link_id: string;
        link_id_loppu: string;
        m_arvo: number;
        m_arvo_loppu: number;
        kuntakoodi: number;
        tie_loppu: number;
        ajorata_loppu: number;
        osa_loppu: number;
        etaisyys_loppu: number;
        tie: number;
        ajorata: number;
        osa: number;
        etaisyys: number;
    };
}

export interface InvalidVKMFeature {
    properties: {
        virheet: string;
    };
}

export type VKMResponseForRoadAddress = {
    features: (ValidVKMFeature | InvalidVKMFeature)[];
};

interface LinkData {
    tie: number | undefined;
    tunniste: string;
    link_id: string;
    link_id_loppu: string;
    m_arvo: number;
    m_arvo_loppu: number;
    kuntakoodi: number;
    ajorata: number;
    osa: number;
    etaisyys: number;
    tie_loppu: number;
    ajorata_loppu: number;
    osa_loppu: number;
    etaisyys_loppu: number;
}

export interface LinearAsset {
    externalIds: string[]; // or specify a more precise type if known
    LRM: {
        mValue: number;
        mValueEnd: number;
    };
    roadaddress?: {
        tie: number;
        ajorata: number;
        osa: number;
        etaisyys: number;
        etaisyys_loppu: number;
    };
    value: any;
}

export class LinearAssetHandler extends AssetHandler {

    override calculateDiff(srcData: VelhoAsset[], currentData: DbAsset[]) {
        const diff = super.calculateDiff(srcData, currentData);

        return {
            added: diff.added as VelhoLinearAsset[],
            expired: diff.expired,
            updated: diff.updated as VelhoLinearAsset[],
            notTouched: diff.notTouched
        };
    }

    filterNonCerterlineAssetsAway(srcData: VelhoLinearAsset[]): VelhoLinearAsset[] {
        const allowed =  ["kaistat","ajoradat"]
        return srcData.filter(s => {
            return Object.keys(s.sijaintitarkenne).some(key => allowed.includes(key))
        })
    };


    private isValidVKMFeature = (feature: ValidVKMFeature | InvalidVKMFeature): feature is ValidVKMFeature => {
        return !('virheet' in feature.properties)
    }
    
    private fetchVKM = async (body: string,vkmApiKey:string): Promise<VKMResponseForRoadAddress> => {
        const begin = performance.now();
        const response= await fetch('https://api.vaylapilvi.fi/viitekehysmuunnin/muunna', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                'X-API-KEY': `${vkmApiKey}`
            },
            body: `json=${body}`,
        })
        const duration = performance.now() - begin;
        console.log("By using this",body)
        console.log(`Call to fetchVKM call took: ${(duration / 1000).toFixed(4)} s.`)
        if (!response.ok) {
            throw new Error(`Error: ${response.statusText}`);
        }

        const vkmResponse: VKMResponseForRoadAddress = await response.json();

        vkmResponse.features = vkmResponse.features.filter(f => this.isValidVKMFeature(f))

        return vkmResponse
    };
    
    getRoadLinks = async (srcData: VelhoAsset[], vkmApiKey: string): Promise<AssetWithLinkData[]> => {
        const sourceLinearAssets = srcData as VelhoLinearAsset[]
        if (sourceLinearAssets.length === 0) {
            console.log("No velho assets to fetch roadlinks for")
            return []
        }
        try {
            const batchSize = 20
            const firstResults = await this.firstResult(sourceLinearAssets, batchSize,vkmApiKey);
            console.log(`fetched ${firstResults.length} start and end links from vkm`)
            const secondResultsIndexed=  await this.secondResult(firstResults, batchSize,vkmApiKey);
            
            console.log(`Start mapping ${sourceLinearAssets.length} to links ${Object.keys(secondResultsIndexed).length}`);
            // VelhoLinearAsset matches 0 to many LinkData
           const mappedResults = timer("mappedResults", ()=> {
                const mappedResults: AssetWithLinkData[] = []
                sourceLinearAssets.forEach(asset => {
                    if (secondResultsIndexed[asset.oid] != undefined && secondResultsIndexed[asset.oid].length !=0) {
                        const linkInfo = secondResultsIndexed[asset.oid]
                        //console.log('for oid: '+asset.oid)
                        //console.log(linkInfo.map(a=>JSON.stringify(a)).join(","))
                        mappedResults.push({
                            asset: asset,
                            linkData: linkInfo.map(link => ({
                                linkId: link.link_id,
                                mValue: link.m_arvo,
                                mValueEnd: link.m_arvo_loppu,
                                municipalityCode: link.kuntakoodi,
                                roadadress:{
                                    ajorata: link.ajorata,
                                    osa: link.osa,
                                    etaisyys: link.etaisyys,
                                    ajorata_loppu: link.ajorata_loppu,
                                    osa_loppu: link.osa_loppu,
                                    etaisyys_loppu: link.etaisyys_loppu,
                                }
                                
                            }))
                        });
                    }
                });
               return  mappedResults;
            })
            console.log(`Mapped ${mappedResults.length}`);
            return mappedResults;
        } catch (err) {
            console.error(err);
            throw new Error("Error during vkm fetch.")
        }
    }

    private async secondResult<T>(firstResults: LinkData[], batchSize: number,vkmApiKey: string) {
        const begin = performance.now();
        const chunkedLinkData = chunkData(firstResults, 50)
        const secondResultsIndexed: { [index: string]: LinkData[] } = {};
        for (let i = 0; i < chunkedLinkData.length; i += batchSize) {
            const batch = chunkedLinkData.slice(i, i + batchSize)
            const batchPromises = batch.map(async chunk => {
                const locationAndReturnValue = chunk.map(c => ({
                    tie: c.tie, link_id: c.link_id, link_id_loppu: c.link_id_loppu,
                    tunniste: c.tunniste, palautusarvot: '2,4,6', valihaku: "true"
                }));
                const encodedBody = encodeURIComponent(JSON.stringify(locationAndReturnValue));
                const data = await retryTimeout(async () => await this.fetchVKM(encodedBody,vkmApiKey), 10, 5000);

                return data.features
                    .filter(f => this.isValidVKMFeature(f))
                    .map(f => ({...f.properties}))
            })
            const batchResults = (await Promise.all(batchPromises)).flat()

            batchResults.forEach(a => {
                if (secondResultsIndexed[a.tunniste] == undefined || secondResultsIndexed[a.tunniste].length == 0)
                    secondResultsIndexed[a.tunniste] = [a]
                else secondResultsIndexed[a.tunniste].push(a)
            })
        }
        const duration = performance.now() - begin;
        console.log(`Call to secondResult call took: ${(duration / 1000).toFixed(4)} s.`)
        return secondResultsIndexed;
    }

    private async firstResult<T>(sourceLinearAssets: VelhoLinearAsset[], batchSize: number,vkmApiKey: string) {
        const begin = performance.now();
        const chunkedVelhoAssets = chunkData(sourceLinearAssets, 50);
        const firstResults: LinkData[] = []
        for (let i = 0; i < chunkedVelhoAssets.length; i += batchSize) {
            const batch = chunkedVelhoAssets.slice(i, i + batchSize)
            const batchPromises = batch.map(async (chunk) => {
                const locationAndReturnValue = chunk.map(c => {
                    const payload = {
                        tie: c.alkusijainti?.tie,
                        osa: c.alkusijainti?.osa,
                        etaisyys: c.alkusijainti?.etaisyys,
                        osa_loppu: c.loppusijainti?.osa,
                        etaisyys_loppu: c.loppusijainti?.etaisyys,
                        tunniste: c.oid,
                        palautusarvot: '4,6',
                        valihaku: true
                    }
                    const roadways = c.sijaintitarkenne.ajoradat || [];
                    const roadwayNumbers = roadways.map(ajorata => ajorata.match(/\d+/)).filter(match => match !== null).map(match => match[0])
                    if (roadwayNumbers.length > 0) {
                        payload['ajr'] = roadwayNumbers.join(',');
                    }
                    return payload
                    }
                );
                
                const encodedBody = encodeURIComponent(JSON.stringify(locationAndReturnValue));
                const data = await retryTimeout(async () => await this.fetchVKM(encodedBody,vkmApiKey), 10, 5000);
                return data.features
                    .filter(f => this.isValidVKMFeature(f))
                    .map(f => {
                        const originalAsset = locationAndReturnValue.find(a => a.tunniste === f.properties.tunniste);
                        return {
                            ...f.properties,
                            tie: originalAsset?.tie
                        };
                    });
            });
            const batchResults = (await Promise.all(batchPromises)).flat();
            firstResults.push(...batchResults);
        }
        const duration = performance.now() - begin;
        console.log(`Call to firstResult call took: ${(duration / 1000).toFixed(4)} s.`)
        return firstResults;
    }

    override filterRoadLinks(assetsWithLinkData: AssetWithLinkData[],links:RoadLink[]): AssetWithLinkData[] {
        if (assetsWithLinkData.length === 0) {
            console.log("No velho assets to filter")
            return []
        }
        return assetsWithLinkData.map(asset => {
            const filteredLinkData = asset.linkData.map(ld => {
                const match = links.find(link => link.linkId === ld.linkId);
                if (match) {
                    return {
                        ...ld,
                        sideCode: match.sideCode
                    };
                } else {return null}
            })
                .filter(ld => ld !== null);

            return {
                ...asset,
                linkData: filteredLinkData
            };
        }).filter(asset => asset.linkData.length > 0) as AssetWithLinkData[];
    };

    jointAssetsByCommonDenominator  (asset_type_id: number, newAssets: AssetWithLinkData[]) {
        const assetInLinkIndex: AssetInLinkIndex = {}
        newAssets.forEach(a => {
            a.linkData.forEach(a1 => {
                if (assetInLinkIndex[a1.linkId] == undefined || assetInLinkIndex[a1.linkId].size == 0) {
                    const newSet = new Set<AssetInLink>();
                    assetInLinkIndex[a1.linkId] = newSet.add({linkData: a1, asset: a.asset} as AssetInLink);
                } else assetInLinkIndex[a1.linkId].add({linkData: a1, asset: a.asset} as AssetInLink) // lopullisesta huomioi duplikaatit
            })
        })

        Object.keys(assetInLinkIndex).forEach(key => {
            if (assetInLinkIndex[key].size > 1) {
                this.jointAssets(assetInLinkIndex, key);
            }
        })
    }
    private jointAssets(assetInLinkIndex: AssetInLinkIndex, key: string) {
        const assetPerLRM = [...assetInLinkIndex[key]];
        this.handleLink(assetPerLRM);
    }

    handleLink(assetPerLRM: AssetInLink[]):LinearAsset[] {
        const sortedByLink = assetPerLRM.sort((a, b) => {
            return a.linkData.mValue - b.linkData.mValue
        })
        sortedByLink.forEach(a => {
                // tässä tarvittan jokin metodi joka hakee leikkaus ehdon per tietolaji
                const p = a.asset as VelhoPavementAsset
                const link = a.linkData
                const nextAsset = sortedByLink.find(a1 => link.mValueEnd == a1.linkData.mValue && link.mValue < a1.linkData.mValue && a1.asset.oid != p.oid)
                const beforeAsset = sortedByLink.find(a1 => link.mValue == a1.linkData.mValueEnd && a1.linkData.mValue > link.mValue && a1.asset.oid != p.oid)
                const overlap = sortedByLink.find(a1 => a1.linkData.mValue <= link.mValue || a1.linkData.mValueEnd >= link.mValueEnd && a1.asset.oid != p.oid)

                const newAsset: LinearAsset = {
                    externalIds: [p.oid],
                    LRM: {mValue: 0, mValueEnd: 0},
                    roadaddress: {ajorata: 0, etaisyys: 0, etaisyys_loppu: 0, osa: 0, tie: 0},
                    value: ""
                }

                if (nextAsset || beforeAsset) {
                    if (nextAsset) {
                        console.log("assets create continues part, can be joined on " + nextAsset.asset.oid)
                        console.log(`${p.oid} : ${p.ominaisuudet?.velhoSource} : ${p.ominaisuudet?.tyyppi} : ${JSON.stringify(p.alkusijainti)}: ${JSON.stringify(p.loppusijainti)} : ${JSON.stringify(p.sijaintitarkenne)} : ${JSON.stringify(link)}`)
                    }
                    if (beforeAsset) {
                        console.log("assets create continues part, can be joined on " + beforeAsset.asset.oid)
                        console.log(`${p.oid} : ${p.ominaisuudet?.velhoSource} : ${p.ominaisuudet?.tyyppi} : ${JSON.stringify(p.alkusijainti)}: ${JSON.stringify(p.loppusijainti)} : ${JSON.stringify(p.sijaintitarkenne)} : ${JSON.stringify(link)}`)
                    }
                }
                if (overlap) {
                    console.log("asset create overlapping part with " + overlap.asset.oid)
                    console.log(`${p.oid} : ${p.ominaisuudet?.velhoSource} : ${p.ominaisuudet?.tyyppi} : ${JSON.stringify(p.alkusijainti)}: ${JSON.stringify(p.loppusijainti)} : ${JSON.stringify(p.sijaintitarkenne)} : ${JSON.stringify(link)}`)
                } else {
                    console.log("no overlapping or continues")
                    console.log(`${p.oid} : ${p.ominaisuudet?.velhoSource} : ${p.ominaisuudet?.tyyppi} : ${JSON.stringify(p.alkusijainti)}: ${JSON.stringify(p.loppusijainti)} : ${JSON.stringify(p.sijaintitarkenne)} : ${JSON.stringify(link)}`)
                }
            }
        )
        const newAsset: LinearAsset = {
            externalIds: ["1"],
            LRM: {mValue: 0, mValueEnd: 0},
            roadaddress: {ajorata: 0, etaisyys: 0, etaisyys_loppu: 0, osa: 0, tie: 0},
            value: ""
        }
        return [newAsset]
    }

    async saveNewAssets(asset_type_id: number, newAssets: AssetWithLinkData[]) {

        if (newAssets.length === 0) {
            console.log("No assets to save.")
            return
        }

        const client = await getClient();
        const timeStamp = Date.now() - (Date.now() % (24 * 60 * 60 * 1000)) - (5 * 60 * 60 * 1000);

        try {
            await client.connect();

            await client.query('BEGIN');
            const insertPromises = newAssets.map((assetWithLinkData) => {
                (assetWithLinkData.linkData || []).map(async (linkData) => {
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
                    )
                    INSERT INTO asset_link (asset_id, position_id)
                    VALUES ((SELECT id FROM asset_insert), (SELECT id FROM position_insert));
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
                        1 // normal link interface
                    ]);
                })
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

    updateAssets(asset_type_id: number, assetsToUpdate: AssetWithLinkData[]): Promise<void> {
        //Placeholder logic
        return new Promise<void>((resolve, reject) => {resolve();}); 
    };

    async saveChanges(asset_type_id: number, newAssets: AssetWithLinkData[], assetsToUpdate: AssetWithLinkData[],links:RoadLink[]): Promise<void> {
        
        
        //await this.saveNewAssets(asset_type_id, newAssets)
        //await this.updateAssets(asset_type_id, newAssets)
    }
}