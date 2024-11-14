import { PointAssetHandler } from "./pointAssetHandler";
import { VelhoPointAsset } from "./assetHandler";
import { Track, VelhoRoadSide, SideCode, VelhoValidityDirection, ValidityDirectionRoadAddress } from './enumerations';


export interface VelhoTrafficSignAsset extends VelhoPointAsset {
    ominaisuudet: {
        sijaintipoikkeus: string | null;
        "kunto-ja-vauriotiedot": {
            "varustevauriot": string[] | null;
            "yleinen-kuntoluokka": string | null;
            "arvioitu-jaljella-oleva-kayttoika": string | null;
        };
        "rakenteelliset-ominaisuudet": {
            arvo: string | null;
            koko: string | null;
            suunta: string | null;
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
    mitattugeometria: string | null;
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
}
    

