import {AssetHandler} from "./assetHandler";
import {DbAsset, DRValue, LinkInformation, RoadLink} from "./type/type";
import {AssetWithLinkData, VelhoAsset, VelhoLinearAsset} from "./type/velhoAsset";
import {chunkData, retryTimeout, timer} from "./utils/utils";
import {getClient} from "./utils/AWSUtils";
// @ts-ignore
import { log } from "console";

let console = require('console');

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
export interface AssetInLink {
    asset: VelhoAsset;
    linkData: LinkInformation;
}

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

export interface AssetInLinkIndex {
    [index: string]: Set<LinearAsset>;
}
export interface LinearAsset {
    externalIds: string[];
    LRM: {
        linkId:string;
        municipalityCode: number;
        sideCode?: number;
        mValue: number;
        mValueEnd: number;
    };
    roadAddress?: {
        tie: number;
        ajorata: number;
        osa: number;
        etaisyys: number;
        etaisyys_loppu: number;
    };
    velhoValue: VelhoAsset[];
    digiroadValue?: DRValue[];
}


export interface InvalidVKMFeature {
    properties: {
        virheet: string;
    };
}

export type VKMResponseForRoadAddress = {
    features: (ValidVKMFeature | InvalidVKMFeature)[];
};

interface VKMPayload {
        tie: number;
        osa: number;
        etaisyys: number;
        osa_loppu: number;
        etaisyys_loppu: number;
        tunniste: string;
        palautusarvot: string;
        valihaku: boolean;
        ajr?:string;
}

interface ValueAndJoin {
    values: any;
    shouldWeJoin: boolean;
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
                        valihaku: true,
                        
                    } as VKMPayload
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
    // override with your own mapping logic 
    mapVelhoToDR (asset:VelhoAsset):DRValue{
         return  {value:asset.oid } as DRValue
    }
    
    velhoAssetToLinearAssets  (asset_type_id: number, newAssets: AssetWithLinkData[]): AssetInLinkIndex {
        const assetInLinkIndex: AssetInLinkIndex = {}
        newAssets.forEach(a => {
            a.linkData.forEach(a1 => {
                const asset = {
                    externalIds: [a.asset.oid],
                    LRM: {linkId:a1.linkId,municipalityCode:a1.municipalityCode,sideCode:a1.sideCode, mValue: a1.mValue, mValueEnd: a1.mValueEnd},
                    roadAddress: {ajorata: a1.roadadress?.ajorata, etaisyys: a1.roadadress?.etaisyys,
                        etaisyys_loppu: a1.roadadress?.etaisyys_loppu, osa: a1.roadadress?.osa, tie: 0},
                    velhoValue: [a.asset],
                    digiroadValue: [this.mapVelhoToDR(a.asset)]
                } as LinearAsset
                if (assetInLinkIndex[a1.linkId] == undefined || assetInLinkIndex[a1.linkId].size == 0) {
                    const newSet = new Set<LinearAsset>();
                    assetInLinkIndex[a1.linkId] = newSet.add(asset);
                } else assetInLinkIndex[a1.linkId].add(asset) // lopullisesta huomioi duplikaatit
            })
        })
        return assetInLinkIndex
    }
    
    handleLink(assetPerLRM: LinearAsset[]): LinearAsset[] {
        const initialMapping =assetPerLRM
            .sort((a, b) => { return a.LRM.mValue - b.LRM.mValue})
        // Define a series of processing steps
        const steps: ((assets: LinearAsset[]) => LinearAsset[])[] = [
            this.attemptMerge,
            //this.fillLink, // Example - Additional processing step
        ];
        const processPipeline = (start: LinearAsset[], steps: ((assets: LinearAsset[]) => LinearAsset[])[]) => 
            steps.reduce((acc, step) => step(acc), start);
        
        return processPipeline(initialMapping, steps);
    }

    private attemptMerge(assets: LinearAsset[]): LinearAsset[] {
        const [newAssets, somethingChanged] = this.mergeStep(assets);

        // If no changes were made, return the newAssets.
        if (!somethingChanged) return newAssets;

        // Recursively try merging again
        return this.attemptMerge(newAssets);
    }
    private mergeStep(assets: LinearAsset[]): [LinearAsset[], boolean] {
        let somethingChanged = false;

        const newAssets = assets.reduce((accumulator: LinearAsset[], currentItem: LinearAsset, index, array) => {
            if (index < array.length - 1) {
                const nextAsset = array[index + 1];
                if (nextAsset){
                    let merged = this.merge(nextAsset, currentItem);
                    if (merged) {
                        somethingChanged = true;
                        return accumulator.concat(merged)
                    } else return accumulator.concat(currentItem)
                }else return accumulator.concat(currentItem)
            }
            return accumulator.concat(currentItem);
        }, []);

        return [newAssets, somethingChanged];
    }

    merge(nextAsset:LinearAsset, currentItem: LinearAsset):LinearAsset | undefined {
        const isNext = currentItem.LRM.mValueEnd == nextAsset.LRM.mValue && currentItem.LRM.mValue < nextAsset.LRM.mValue
        const {values,shouldWeJoin}= this.getValueAndShouldWeJoin(nextAsset,currentItem)
        if (isNext && shouldWeJoin) {
            if (typeof values !== 'undefined'){
                return {
                    externalIds: currentItem.externalIds.concat(nextAsset.externalIds),
                    LRM: {mValue: currentItem.LRM.mValue, mValueEnd: nextAsset.LRM.mValueEnd},
                    roadAddress: {ajorata: 0, etaisyys: 0, etaisyys_loppu: 0, osa: 0, tie: 0},
                    digiroadValue: values,
                    velhoValue: currentItem.velhoValue.concat(nextAsset.velhoValue)
                } as LinearAsset
            } else return undefined;
        } else return undefined;
    }
    
     fillLink() {
        return (list, currentItem: LinearAsset, currentIndex: number, array: LinearAsset[]): LinearAsset[] => {
            return list;
        };
    }
    /*
        Generic method determinate should we join two asset. Override with your own implementation as needed.
     */
    getValueAndShouldWeJoin (compare:LinearAsset, currentItem: LinearAsset) {
        if (JSON.stringify(compare.digiroadValue) == JSON.stringify(currentItem.digiroadValue)) {
            return {values:currentItem.digiroadValue,shouldWeJoin: true} as ValueAndJoin
        } else return {values:currentItem.digiroadValue,shouldWeJoin: false } as ValueAndJoin
    }


    async saveNewAssets(asset_type_id: number, newAssets: LinearAsset[]) {

        if (newAssets.length === 0) {
            console.log("No assets to save.")
            return
        }

        const client = await getClient();
        const timeStamp = Date.now() - (Date.now() % (24 * 60 * 60 * 1000)) - (5 * 60 * 60 * 1000);

        try {
            await client.connect();

            await client.query('BEGIN');
            const insertPromises = newAssets.map(async (assetWithLinkData) => {
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
                        assetWithLinkData.externalIds,
                        asset_type_id,
                        'Tievelho-import',
                        assetWithLinkData.LRM.municipalityCode,
                        assetWithLinkData.LRM.mValue,
                        assetWithLinkData.LRM.mValueEnd,
                        assetWithLinkData.LRM.linkId,
                        assetWithLinkData.LRM.sideCode,
                        timeStamp,
                        1 // normal link interface
                    ]);
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

    updateAssets(asset_type_id: number, assetsToUpdate: LinearAsset[][]): Promise<void> {
        //Placeholder logic
        return new Promise<void>((resolve, reject) => {resolve();}); 
    }

    async saveChanges(asset_type_id: number, newAssets: AssetWithLinkData[], assetsToUpdate: AssetWithLinkData[],links:RoadLink[]): Promise<void> {
        // muunna linear Asset ja map arvot DR
        const newLinearAssets= this.velhoAssetToLinearAssets(asset_type_id,newAssets)
        const assetsToUpdateLinear =  this.velhoAssetToLinearAssets(asset_type_id,assetsToUpdate)

        const assets =Object.keys(newLinearAssets).flatMap(key => {
            if (newLinearAssets[key].size > 1) {
                return this.handleLink([...newLinearAssets[key]]);
            }
        })
        
        await this.saveNewAssets(asset_type_id, assets)
        //await this.updateAssets(asset_type_id, newAssets)
    }
}