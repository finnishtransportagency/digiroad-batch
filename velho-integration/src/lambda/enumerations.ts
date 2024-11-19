// Road address track
export enum Track {
    Combined = 0,
    RightSide = 1,
    LeftSide = 2,
    Unknown = 99
}

// VelhoRoadSide describes the location in relation to the road and it's road address's direction of growth
export enum VelhoRoadSide {
    Right = 1,      // p01
    Left = 2,       // p02
    Between = 3,    // p03
    Across = 6      // p06
}

// VelhoValidityDirection describes the validity direction in relation to lane's traffic direction
export enum VelhoValidityDirection {
    TowardsTrafficDirection = 1,      // liivasu01 
    AgainstTrafficDirection = 2,       // liivasu02 
    LengthwiseTrafficDirection = 3,    // liivasu03 
}

export enum ValidityDirectionRoadAddress {
    TowardsRoadAddressGrowth = 1,      
    AgainstRoadAddressGrowth = 2,       
    LengthwiseRoadAddressGrowth = 3,    
}

// SideCode describes the location or validity direction in relation to RoadLink digitzing direction
export enum SideCode {
    BothDirections = 1,
    TowardsDigitizing = 2,
    AgainstDigitizing = 3,
    Unknown = 99
}