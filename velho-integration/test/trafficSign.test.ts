import { Track, VelhoRoadSide, SideCode, VelhoValidityDirection} from '../src/lambda/enumerations';
import { TrafficSignHandler } from '../src/lambda/trafficSignHandler';

const assetHandler = new TrafficSignHandler

test("Right side with validity direction towards traffic should return AgainstDigitizing", () => {
    const result = assetHandler.calculateTrafficSignValidityDirection(
        SideCode.AgainstDigitizing,
        VelhoRoadSide.Right,
        VelhoValidityDirection.TowardsTrafficDirection
    );
    expect(result).toBe(SideCode.AgainstDigitizing);
  });
  
  test("Right side with validity direction against traffic should return TowardsDigitizing", () => {
    const result = assetHandler.calculateTrafficSignValidityDirection(
        SideCode.AgainstDigitizing,
        VelhoRoadSide.Right,
        VelhoValidityDirection.AgainstTrafficDirection
    );
    expect(result).toBe(SideCode.AgainstDigitizing);
  });
  
  test("Left side with validity direction towards traffic should return TowardsDigitizing", () => {
    const result = assetHandler.calculateTrafficSignValidityDirection(
        SideCode.AgainstDigitizing,
        VelhoRoadSide.Left,
        VelhoValidityDirection.TowardsTrafficDirection
    );
    expect(result).toBe(SideCode.AgainstDigitizing);
  });