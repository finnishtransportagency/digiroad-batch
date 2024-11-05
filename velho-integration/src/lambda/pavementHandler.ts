import { VelhoAsset, VelhoLinearAsset } from "./assetHandler";
import { LinearAssetHandler } from "./linearAssetHandler";

export class PavementHandler extends LinearAssetHandler {

    // the original source path of each pavement is necessary for correct mappings and filterings
    private pathByOid: { [oid: string]: string } = {};

    override fetchSource = async (token: string, ely: string, paths: string[]): Promise<VelhoAsset[]> => {
        const allVelhoAssets = await Promise.all(
            paths.map(async (path) => {
                const srcData: VelhoAsset[] = await this.fetchSourceFromPath(token, ely, path);
                srcData.forEach((s) => {
                    this.pathByOid[s.oid] = path;
                });
                return srcData;
            })
        );
        return allVelhoAssets.flat();
    }

    private filterByPavementType = (srcData: VelhoLinearAsset[]): VelhoLinearAsset[] => {
        return []
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
    override filterUnnecessary(srcData: VelhoLinearAsset[]): VelhoLinearAsset[] {
        const mainLanes = ['kaista-numerointi/kanu11', 'kaista-numerointi/kanu21', 'kaista-numerointi/kanu31']
        const mainLanesFromOneSide = ['kaista-numerointi/kanu11', 'kaista-numerointi/kanu31']
        const srcWithValidStatus = super.filterUnnecessary(srcData) as VelhoLinearAsset[];
        const necessaryAssets = srcWithValidStatus.filter(s => {
            if (s.sijaintitarkenne.ajoradat && s.sijaintitarkenne.ajoradat.length === 1 && s.sijaintitarkenne.ajoradat[0] === 'ajorata/ajr0') {
                return !s.sijaintitarkenne.kaistat || s.sijaintitarkenne.kaistat.length === 0 || s.sijaintitarkenne.kaistat.some(lane => mainLanesFromOneSide.includes(lane))
            } else {
                return !s.sijaintitarkenne.kaistat || s.sijaintitarkenne.kaistat.length === 0 || s.sijaintitarkenne.kaistat.some(lane => mainLanes.includes(lane))
            }
        })
        return this.filterByPavementType(necessaryAssets)
    };
}
