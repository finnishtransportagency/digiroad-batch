import {PointAssetHandler} from './pointAssetHandler';
import {
    getCoatingTypeDigiroadValue,
    getConditionDigiroadValue,
    getLocationSpecifierSideDigiroadValue,
    getSignMaterialDigiroadValue,
    getSizeDigiroadValue,
    getStructureDigiroadValue,
    getTrafficSignTypeDigiroadValue,
    getTypeOfDamageDigiroadValue,
    getUrgencyOfRepairDigiroadValue,
} from "./trafficSignValueMappings";
import {AssetWithLinkData, VelhoPointAsset, VelhoRoadSide, VelhoValidityDirection} from "./type/velhoAsset";
import {
    RoadAddressGrowthDirection,
    RoadLink,
    RoadLinkAddressGrowth,
    SideCode,
    ValidityDirectionRoadAddress
} from "./type/type";
import {calculateRoadLinkBearing, getAssetSideCodeByBearing} from "./utils/geometryUtils";
import {getVkmApiKey} from "./utils/AWSUtils";

interface VKMResponseForRoadAddressGrowthPoint {
    features: {
        properties: {
            tunniste: string,
            link_id: string,
            m_arvo: number,
            etaisyys: number
        };
    }[];
}

export interface VelhoTrafficSignAsset extends VelhoPointAsset {
    ominaisuudet: {
        sijaintipoikkeus: string | null;
        "kunto-ja-vauriotiedot": {
            "varustevauriot": {
                "vauriotyyppi": string | null;
                "korjauksen-kiireellisyysluokka": string | null;
            } | null;
            "yleinen-kuntoluokka": string | null;
            "arvioitu-jaljella-oleva-kayttoika": string | null;
        };
        "rakenteelliset-ominaisuudet": {
            arvo: number | null;
            koko: string | null;
            suunta: number | null;
            materiaali: string | null;
            kalvotyyppi: string | null;
            korkeusasema: string | null;
            kiinnitystapa: string | null;
        };
        "toiminnalliset-ominaisuudet": {
            lakinumero: string | null;
            lisatietoja: string | null;
            asetusnumero: string | null;
            vaikutussuunta: string | null;
            "voimassaolo-alkaa": string | null;
            "voimassaolo-paattyy": string | null;
        };
    };
    mitattugeometria: {
        geometria?: {
            type: string;
            coordinates: [number, number, number];
        };
        "geometria-wgs84"?: {
            type: string;
            coordinates: [number, number, number];
        };
    } | null;
}

export class TrafficSignHandler extends PointAssetHandler {

    getRoadLinkRoadAddressGrowthDirections = async (roadLinks: RoadLink[], vkmApiKey: string): Promise <RoadLinkAddressGrowth[]>  => {
        const chunkSize = 500; // 2x transformations for roadlink, VKM maximum transformations for 1 POST request is 1000
        const chunkData = (array: RoadLink[], size: number): RoadLink[][] => {
            const chunks: RoadLink[][] = [];
            for (let i = 0; i < array.length; i += size) {
                chunks.push(array.slice(i, i + size));
            }
            return chunks;
        };

        const fetchStartAndEndVKM = async (roadLinksToTransform: RoadLink[]) => {

            const parametersContent = roadLinksToTransform.flatMap(roadLink => {

                const mValueStartParams: {link_id: string, m_arvo: number, tunniste: string, palautusarvot: string} = {
                    link_id: roadLink.linkId,
                    m_arvo: 0.0,
                    tunniste: "DigitizingStart",
                    palautusarvot: '2,6'
                };

                const mValueEndParams: {link_id: string, m_arvo: number, tunniste: string, palautusarvot: string} = {
                    link_id: roadLink.linkId,
                    m_arvo: roadLink.geometryLength,
                    tunniste: "DigitizingEnd",
                    palautusarvot: '2,6'
                };

                return [mValueStartParams, mValueEndParams];
            });
            const encodedBody = encodeURIComponent(JSON.stringify(parametersContent));
            const response = await fetch('https://api.vaylapilvi.fi/viitekehysmuunnin/muunna', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                    'X-API-KEY': `${vkmApiKey}`
                },
                body: `json=${encodedBody}`,
            });

            if (!response.ok) {
                throw new Error(`Error: ${response.statusText}`);
            }

            const data: VKMResponseForRoadAddressGrowthPoint = await response.json();

            return data.features.map(f => f.properties);
        };

        const chunkedData = chunkData(roadLinks, chunkSize);
        const promises = chunkedData.map(chunk => fetchStartAndEndVKM(chunk));

        try {
            const results = await Promise.all(promises);
            const flatResults = results.flat();

            return roadLinks.flatMap(roadLink => {
                const digitizingStartAddress = flatResults.find(r => r.link_id === roadLink.linkId && r.tunniste === "DigitizingStart").etaisyys;
                const digitizingEndAddress = flatResults.find(r => r.link_id === roadLink.linkId && r.tunniste === "DigitizingEnd").etaisyys;

                let roadAddressGrowthDirection: RoadAddressGrowthDirection;
                if (digitizingStartAddress < digitizingEndAddress) roadAddressGrowthDirection = RoadAddressGrowthDirection.TowardsDigitizing;
                else roadAddressGrowthDirection = RoadAddressGrowthDirection.AgainstDigitizing;

                return {linkId: roadLink.linkId, roadAddressGrowth: roadAddressGrowthDirection}
            });
        } catch (err) {
            console.error(err);
            throw new Error("Error during calculating road link road address growth using VKM")
        }
    }


    async saveChanges(asset_type_id: number, newAssets: AssetWithLinkData[], assetsToUpdate: AssetWithLinkData[],links:RoadLink[]): Promise<void> {
        const roadLinkRoadAddressGrowths = await this.getRoadLinkRoadAddressGrowthDirections(links, await getVkmApiKey());
        const newTrafficSignsWithDigiroadValues = newAssets.map(asset => {
            const roadLink = links.find(rl => rl.linkId === asset.linkData[0].linkId);

            if (roadLink) {
                const roadAddressGrowthDirection = roadLinkRoadAddressGrowths.find(roadAddressGrowth => roadAddressGrowth.linkId === roadLink.linkId)?.roadAddressGrowth
                if (roadAddressGrowthDirection) {
                    this.velhoAssetToDigiroadAsset(asset, roadLink, roadAddressGrowthDirection);
                    //TODO Add insert and update
                } else {
                    console.log(`No road link road address growth found for asset with linkId: ${asset.linkData[0].linkId}`);
                }

            } else {
                console.log(`No road link found for asset with linkId: ${asset.linkData[0].linkId}`);
            }
        });

    }

    override filterUnnecessary(srcData: VelhoTrafficSignAsset[]): VelhoTrafficSignAsset[] {
        return srcData.filter(src => {
            const tiekohteenTilaFilter = !src['tiekohteen-tila'] || src['tiekohteen-tila'] === 'tiekohteen-tila/tt03'
            const sijaintiPoikkeusFilter = src.ominaisuudet.sijaintipoikkeus != 'sijaintipoikkeus/sp01' && src.ominaisuudet.sijaintipoikkeus != 'sijaintipoikkeus/sp02'
            const validityDirectionFilter = src.ominaisuudet['toiminnalliset-ominaisuudet'].vaikutussuunta === VelhoValidityDirection.TowardsTrafficDirection ||
                src.ominaisuudet['toiminnalliset-ominaisuudet'].vaikutussuunta === VelhoValidityDirection.AgainstTrafficDirection;
            const sideFilter = (
                src.sijaintitarkenne?.puoli === VelhoRoadSide.Right ||
                src.sijaintitarkenne?.puoli === VelhoRoadSide.Left ||
                (src.sijaintitarkenne?.puoli === VelhoRoadSide.Between && src.ominaisuudet?.['rakenteelliset-ominaisuudet']?.suunta != null)
              );

            return tiekohteenTilaFilter && sijaintiPoikkeusFilter && validityDirectionFilter && sideFilter;
        })
    }

    calculateTrafficSignValidityDirection(roadAddressSideCode: RoadAddressGrowthDirection, velhoAssetRoadSide: VelhoRoadSide,
                                          velhoAssetValidityDirection: VelhoValidityDirection): SideCode {

        let validityDirectionRoadAddressGrowth: ValidityDirectionRoadAddress;

        // Determine the validity direction in relation to road address growth
        switch (velhoAssetRoadSide) {
            case VelhoRoadSide.Right: {
                if (velhoAssetValidityDirection === VelhoValidityDirection.TowardsTrafficDirection) {
                    validityDirectionRoadAddressGrowth = ValidityDirectionRoadAddress.TowardsRoadAddressGrowth;
                } else if (velhoAssetValidityDirection === VelhoValidityDirection.AgainstTrafficDirection) {
                    validityDirectionRoadAddressGrowth = ValidityDirectionRoadAddress.AgainstRoadAddressGrowth;
                } else {
                    throw new Error("Invalid Velho validity direction");
                }
                break;
            }
            case VelhoRoadSide.Left: {
                if (velhoAssetValidityDirection === VelhoValidityDirection.TowardsTrafficDirection) {
                    validityDirectionRoadAddressGrowth = ValidityDirectionRoadAddress.AgainstRoadAddressGrowth;
                } else if (velhoAssetValidityDirection === VelhoValidityDirection.AgainstTrafficDirection) {
                    validityDirectionRoadAddressGrowth = ValidityDirectionRoadAddress.TowardsRoadAddressGrowth;
                } else {
                    throw new Error("Invalid Velho validity direction");
                }
                break;
            }
            default:
                throw new Error("Invalid Velho road side");
        }

        // Use road address side code to determine the validity direction in relation to digitizing direction
        switch (roadAddressSideCode) {
            case RoadAddressGrowthDirection.AgainstDigitizing: {
                if (validityDirectionRoadAddressGrowth === ValidityDirectionRoadAddress.TowardsRoadAddressGrowth) {
                    return SideCode.AgainstDigitizing;
                } else if (validityDirectionRoadAddressGrowth === ValidityDirectionRoadAddress.AgainstRoadAddressGrowth) {
                    return SideCode.TowardsDigitizing;
                }
                break;
            }
            case RoadAddressGrowthDirection.TowardsDigitizing: {
                if (validityDirectionRoadAddressGrowth === ValidityDirectionRoadAddress.TowardsRoadAddressGrowth) {
                    return SideCode.TowardsDigitizing;
                } else if (validityDirectionRoadAddressGrowth === ValidityDirectionRoadAddress.AgainstRoadAddressGrowth) {
                    return SideCode.AgainstDigitizing;
                }
                break;
            }
        }

    }


    velhoAssetToDigiroadAsset(assetWithLinkData: AssetWithLinkData, roadLink: RoadLink, roadAddressGrowthDirection: RoadAddressGrowthDirection) {
        const velhoTrafficSignAsset = assetWithLinkData.asset as VelhoTrafficSignAsset;
        const externalId = velhoTrafficSignAsset.oid;

        const geometry = velhoTrafficSignAsset.keskilinjageometria;
        const trafficSignBearing = velhoTrafficSignAsset.ominaisuudet["rakenteelliset-ominaisuudet"].suunta;
        const roadLinkBearing = calculateRoadLinkBearing(roadLink.shape, assetWithLinkData.linkData[0].mValue)

        let sideCodeDigiroadValue: number;
        if(trafficSignBearing) {
            sideCodeDigiroadValue = getAssetSideCodeByBearing(trafficSignBearing, roadLinkBearing)
        } else {
            let velhoRoadSideValue: VelhoRoadSide;
            let velhoValidityDirectionValue: VelhoValidityDirection;
            if(velhoTrafficSignAsset.sijaintitarkenne.puoli && velhoTrafficSignAsset.ominaisuudet["toiminnalliset-ominaisuudet"].vaikutussuunta) {
                velhoRoadSideValue = velhoTrafficSignAsset.sijaintitarkenne.puoli as VelhoRoadSide;
                velhoValidityDirectionValue = velhoTrafficSignAsset.ominaisuudet["toiminnalliset-ominaisuudet"].vaikutussuunta as VelhoValidityDirection;
            }
            else {
                throw new Error(`Asset OID: ${externalId} has invalid Velho puoli or vaikutussuunta value`)
            }
            sideCodeDigiroadValue = this.calculateTrafficSignValidityDirection(roadAddressGrowthDirection, velhoRoadSideValue,velhoValidityDirectionValue)
        }

        const terrainCoordinates = velhoTrafficSignAsset.mitattugeometria?.geometria

        const trafficSignStartDate = velhoTrafficSignAsset.ominaisuudet["toiminnalliset-ominaisuudet"]["voimassaolo-alkaa"];
        const trafficSignEndDate = velhoTrafficSignAsset.ominaisuudet["toiminnalliset-ominaisuudet"]["voimassaolo-paattyy"];

        const velhoNewLawCode = velhoTrafficSignAsset.ominaisuudet["toiminnalliset-ominaisuudet"].lakinumero
        const velhoOldLawCode = velhoTrafficSignAsset.ominaisuudet["toiminnalliset-ominaisuudet"].asetusnumero
        const trafficSignTypeDigiroadValue = getTrafficSignTypeDigiroadValue(velhoNewLawCode, velhoOldLawCode)

        const locationSpecifierSideDigiroadValue = getLocationSpecifierSideDigiroadValue(velhoTrafficSignAsset.sijaintitarkenne.puoli ?? null);
        const structureDigiroadValue = getStructureDigiroadValue(velhoTrafficSignAsset.ominaisuudet["rakenteelliset-ominaisuudet"].kiinnitystapa);
        const conditionDigiroadValue = getConditionDigiroadValue(velhoTrafficSignAsset.ominaisuudet["kunto-ja-vauriotiedot"]["yleinen-kuntoluokka"]);
        const sizeDigiroadValue = getSizeDigiroadValue(velhoTrafficSignAsset.ominaisuudet["rakenteelliset-ominaisuudet"].koko);
        const heightDigiroadValue = velhoTrafficSignAsset.ominaisuudet["rakenteelliset-ominaisuudet"].korkeusasema;
        const coatingTypeDigiroadValue = getCoatingTypeDigiroadValue(velhoTrafficSignAsset.ominaisuudet["rakenteelliset-ominaisuudet"].kalvotyyppi);
        const lifeCycleDigiroadValue = 3
        const signMaterialDigiroadValue = getSignMaterialDigiroadValue(velhoTrafficSignAsset.ominaisuudet["rakenteelliset-ominaisuudet"].materiaali)

        // If Velho traffic sign asset has only the old law code, set old_traffic_code value to true, else false
        const oldTrafficCodeDigiroadValue = velhoNewLawCode === null && velhoOldLawCode != null;

        const typeOfDamageDigiroadValue = getTypeOfDamageDigiroadValue(velhoTrafficSignAsset
            .ominaisuudet["kunto-ja-vauriotiedot"].varustevauriot?.vauriotyyppi ?? null);

        //TODO Selvitä Velhovastauksen todellinen rakenne, kaikissa vastauksissa kenttä oli null
        const urgencyOfRepairDigiroadValue = getUrgencyOfRepairDigiroadValue(velhoTrafficSignAsset
            .ominaisuudet["kunto-ja-vauriotiedot"].varustevauriot?.["korjauksen-kiireellisyysluokka"] ?? null)
    }




}
    

