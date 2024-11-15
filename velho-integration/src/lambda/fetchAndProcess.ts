import { Agent, setGlobalDispatcher } from 'undici';
import { PointAssetHandler } from "./pointAssetHandler";
import { LinearAssetHandler } from "./linearAssetHandler";
import { PavementHandler } from "./pavementHandler";
import { TrafficSignHandler } from "./trafficSignHandler";
import {authenticate, fetchMunicipalities, getVkmApiKey} from "./utils";


const agent = new Agent({
    connect: {
        rejectUnauthorized: false
    }
})

setGlobalDispatcher(agent)



const getAssetHandler = (asset_type_id: number, asset_type: string) => {
    if (asset_type_id === 110) {
        return new PavementHandler
    } else if (asset_type_id === 300) {
        return new TrafficSignHandler
    }else if (asset_type === 'Point') {
        return new PointAssetHandler
    } else {
        return new LinearAssetHandler
    }
}

export const handler = async (event: { ely: string, asset_name: string, asset_type_id: number, asset_type: string, paths: string[] }, ctx: any) => {
    console.log(`Event: ${JSON.stringify(event, null, 2)}`);

    const { ely, asset_name, asset_type_id, asset_type, paths } = event;
    const assetHandler = getAssetHandler(asset_type_id, asset_type)
    const vkmApiKey = await getVkmApiKey()
    if (!vkmApiKey) throw new Error("vkm api key is not defined")
    const authToken = await authenticate()
    const srcData = await assetHandler.fetchSource(authToken, ely, paths)
    console.log(`fetched ${srcData.length} assets from velho`)
    const filteredSrc = assetHandler.filterUnnecessary(srcData)
    if (filteredSrc.length === 0) {
        console.log('No assets to process after filtering.')
        return
    }
    const municipalities = await fetchMunicipalities(ely)
    console.log(`municipalities to process: ${municipalities.join(',')}`)
    const currentData = await assetHandler.fetchDestData(asset_type_id, municipalities)
    console.log(`fetched ${currentData.length} assets from digiroad`)
    const { added, expired, updated, notTouched } = assetHandler.calculateDiff(filteredSrc, currentData)
    console.log(`assets left untouched: ${notTouched.length}`)
    console.log(`assets to expire: ${expired.length}`)
    await assetHandler.expireAssets(expired)
    console.log(`assets to add: ${added.length}`)
    const addedWithLinks = await assetHandler.getRoadLinks(added, vkmApiKey)
    console.log(`assets to update: ${updated.length}`)
    const updatedWithLinks = await assetHandler.getRoadLinks(updated, vkmApiKey)
    console.log('road link data fetched')
    const addedWithDigiroadLinks = await assetHandler.filterRoadLinks(addedWithLinks)
    await assetHandler.saveNewAssets(asset_type_id, addedWithDigiroadLinks)
    const updatedWithDigiroadLinks = await assetHandler.filterRoadLinks(updatedWithLinks)
    await assetHandler.updateAssets(updatedWithDigiroadLinks)
}