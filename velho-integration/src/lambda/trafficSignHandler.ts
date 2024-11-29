import { PointAssetHandler } from './pointAssetHandler';
import {
    getCoatingTypeDigiroadValue,
    getConditionDigiroadValue,
    getLocationSpecifierSideDigiroadValue, getSignMaterialDigiroadValue, getSizeDigiroadValue,
    getStructureDigiroadValue,
    getTrafficSignTypeDigiroadValue, getTypeOfDamageDigiroadValue, getUrgencyOfRepairDigiroadValue
} from "./trafficSignValueMappings";
import {VelhoPointAsset, VelhoRoadSide, VelhoValidityDirection} from "./type/velhoAsset";
import {SideCode, ValidityDirectionRoadAddress} from "./type/type";

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

    override filterUnnecessary(srcData: VelhoTrafficSignAsset[]): VelhoTrafficSignAsset[] {
        return srcData.filter(src => {
            const tiekohteenTilaFilter = !src['tiekohteen-tila'] || src['tiekohteen-tila'] === 'tiekohteen-tila/tt03'
            const sijaintiPoikkeusFilter = src.ominaisuudet.sijaintipoikkeus != 'sijaintipoikkeus/sp01' && src.ominaisuudet.sijaintipoikkeus != 'sijaintipoikkeus/sp02'
            const validityDirectionFilter = src.ominaisuudet['toiminnalliset-ominaisuudet'].vaikutussuunta != "liikennemerkki-vaikutussuunta/liivasu03"
            const sideFilter = (
                src.sijaintitarkenne?.puoli === "puoli/p01" || 
                src.sijaintitarkenne?.puoli === "puoli/p02" || 
                (src.sijaintitarkenne?.puoli === "puoli/p03" && src.ominaisuudet?.['rakenteelliset-ominaisuudet']?.suunta != null)
              );

            return tiekohteenTilaFilter && sijaintiPoikkeusFilter && validityDirectionFilter && sideFilter;
        })
    }

    calculateTrafficSignValidityDirection(roadAddressSideCode: SideCode, velhoAssetRoadSide: VelhoRoadSide,
        velhoAssetValidityDirection: VelhoValidityDirection): SideCode {

           let validityDirectionRoadAddressGrowth: ValidityDirectionRoadAddress;

           // Determine the validity direction in relation to road address growth
            switch(velhoAssetRoadSide) {
               case VelhoRoadSide.Right:
                   if(velhoAssetValidityDirection == VelhoValidityDirection.TowardsTrafficDirection) {
                       validityDirectionRoadAddressGrowth = ValidityDirectionRoadAddress.TowardsRoadAddressGrowth;
                   } else if(velhoAssetValidityDirection == VelhoValidityDirection.AgainstTrafficDirection) {
                       validityDirectionRoadAddressGrowth =  ValidityDirectionRoadAddress.AgainstRoadAddressGrowth;
                   }
               case VelhoRoadSide.Left:
                   if(velhoAssetValidityDirection == VelhoValidityDirection.TowardsTrafficDirection) {
                       validityDirectionRoadAddressGrowth =  ValidityDirectionRoadAddress.AgainstRoadAddressGrowth;
                   } else if(velhoAssetValidityDirection == VelhoValidityDirection.AgainstTrafficDirection) {
                       validityDirectionRoadAddressGrowth =  ValidityDirectionRoadAddress.TowardsRoadAddressGrowth;
                   }
                   //Placeholder default handling
               default:
                   validityDirectionRoadAddressGrowth = ValidityDirectionRoadAddress.TowardsRoadAddressGrowth
           }

           // Use road address side code to determine the validity direction in relation to digitizing direction
           switch(roadAddressSideCode) {
               case SideCode.AgainstDigitizing:
                   if(validityDirectionRoadAddressGrowth == ValidityDirectionRoadAddress.TowardsRoadAddressGrowth) {
                       return SideCode.AgainstDigitizing;
                   } else if (validityDirectionRoadAddressGrowth == ValidityDirectionRoadAddress.AgainstRoadAddressGrowth) {
                       return SideCode.TowardsDigitizing;
                   }
               case SideCode.TowardsDigitizing:
                   if(validityDirectionRoadAddressGrowth == ValidityDirectionRoadAddress.TowardsRoadAddressGrowth) {
                       return SideCode.TowardsDigitizing;
                   } else if (validityDirectionRoadAddressGrowth == ValidityDirectionRoadAddress.AgainstRoadAddressGrowth) {
                       return SideCode.AgainstDigitizing;
                   }
                   //Placeholder default handling
               default:
                   return SideCode.TowardsDigitizing;
           }
  }


    velhoAssetToDigiroadAsset(velhoTrafficSignAsset: VelhoTrafficSignAsset, assetTypeId: number) {
        const externalId = velhoTrafficSignAsset.oid;
        const geometry = velhoTrafficSignAsset.keskilinjageometria;
        const velhoBearing = velhoTrafficSignAsset.ominaisuudet["rakenteelliset-ominaisuudet"].suunta;

        //TODO Save road link bearing to asset.bearing
        //const bearingDigiroadValue =

        //Todo Add calculating sideCode
        // const sideCodeDigiroadValue =

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
    

