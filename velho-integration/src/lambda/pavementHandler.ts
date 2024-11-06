import { VelhoAsset } from "./assetHandler";
import { LinearAssetHandler } from "./linearAssetHandler";

enum PavementClass {
    Asphalt = 1, //asfaltti
    Cobblestone = 2, //kivi
    UnboundWearLayer = 3, //sitomaton kulutuskerros
    OtherPavementClasses = 4, //muut päällysteluokat
    Unknown = 99 //päällystetty, tyyppi tuntematon
}

export class PavementHandler extends LinearAssetHandler {

    // the original velho source of each pavement is necessary for correct mappings and filterings
    private sourceByOid: { [oid: string]: string } = {};

    // pavements mapped by oid to digiroad pavement types
    private pavementByOid: { [oid: string]: PavementClass } = {}

    override fetchSource = async (token: string, ely: string, paths: string[]): Promise<VelhoAsset[]> => {
        const allVelhoAssets = await Promise.all(
            paths.map(async (path) => {
                const srcData: VelhoAsset[] = await this.fetchSourceFromPath(token, ely, path);
                srcData.forEach((s) => {
                    this.sourceByOid[s.oid] = path.replace('paallyste-ja-pintarakenne/', '');
                });
                return srcData;
            })
        );
        return allVelhoAssets.flat();
    }

    private filterByPavementType = (srcData: VelhoAsset[]): VelhoAsset[] => {
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
                        this.pavementByOid[s.oid] = PavementClass.Cobblestone
                    }
                    break
                case 'muut-pintarakenteet':
                    if (s.ominaisuudet?.materiaali) {
                        if (asphaltSources.includes(s.ominaisuudet.materiaali)) {
                            this.pavementByOid[s.oid] = PavementClass.Asphalt
                        } else if (unboundSources.includes(s.ominaisuudet.materiaali)) {
                            this.pavementByOid[s.oid] = PavementClass.UnboundWearLayer
                        } else if (otherSources.includes(s.ominaisuudet.materiaali)) {
                            this.pavementByOid[s.oid] = PavementClass.OtherPavementClasses
                        } else if (unknownTypeSources.includes(s.ominaisuudet.materiaali)) {
                            this.pavementByOid[s.oid] = PavementClass.Unknown
                        }
                    }
                    break
                case 'pintaukset':
                    if (s.ominaisuudet?.['pintauksen-tyyppi'] && otherSources.includes(s.ominaisuudet['pintauksen-tyyppi'])) {
                        this.pavementByOid[s.oid] = PavementClass.Unknown
                    } else if (s.ominaisuudet?.uusiomateriaali && otherSources.includes(s.ominaisuudet?.uusiomateriaali)) {
                        this.pavementByOid[s.oid] = PavementClass.Unknown
                    }
                    break
                case 'sidotut-paallysrakenteet':
                    if (s.ominaisuudet?.tyyppi && s.ominaisuudet['paallysteen-tyyppi'] && s.ominaisuudet.tyyppi === 'sidotun-paallysrakenteen-tyyppi/spt01') {
                        if (asphaltSources.includes(s.ominaisuudet['paallysteen-tyyppi'])) {
                            this.pavementByOid[s.oid] = PavementClass.Asphalt
                        } else if (otherSources.includes(s.ominaisuudet['paallysteen-tyyppi'])) {
                            this.pavementByOid[s.oid] = PavementClass.OtherPavementClasses
                        } else if (unknownTypeSources.includes(s.ominaisuudet['paallysteen-tyyppi'])) {
                            PavementClass.Unknown
                        }
                    }
                case 'sitomattomat-pintarakenteet':
                    if (s.ominaisuudet?.runkomateriaali && unboundSources.includes(s.ominaisuudet.runkomateriaali)) {
                        this.pavementByOid[s.oid] = PavementClass.UnboundWearLayer
                    }
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
    override filterUnnecessary(srcData: VelhoAsset[]): VelhoAsset[] {
        const mainLanes = ['kaista-numerointi/kanu11', 'kaista-numerointi/kanu21', 'kaista-numerointi/kanu31']
        const mainLanesFromOneSide = ['kaista-numerointi/kanu11', 'kaista-numerointi/kanu31']
        const srcWithValidStatus = super.filterUnnecessary(srcData);
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
