import { PointAssetHandler } from './pointAssetHandler';
import { Track, VelhoRoadSide, SideCode, VelhoValidityDirection, ValidityDirectionRoadAddress } from './enumerations';

export class TrafficSignHandler extends PointAssetHandler {

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
    

