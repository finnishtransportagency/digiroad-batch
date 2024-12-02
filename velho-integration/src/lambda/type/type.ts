import {LineString} from "wkx";

export interface DbAsset {
    id: number
    externalId: string | null,
    createdBy: string,
    createdDate: Date,
    modifiedBy: string | null,
    modifiedDate: Date | null,
    linkid: string,
    startMeasure: number | null,
    endMeasure: number | null,
    municipalitycode: number
}

export interface DRValue {
    value:string
}
export interface LinkInformation {
    linkId: string;
    mValue: number;
    mValueEnd?: number;
    municipalityCode: number;
    sideCode?: number;
    linkTotalLength?:number;
    roadadress?: {
        tie:number;
        ajorata: number;
        osa: number;
        etaisyys: number;
        ajorata_loppu: number;
        osa_loppu: number;
        etaisyys_loppu: number;
    }
}

export interface RoadLink {
    linkId: string;
    sideCode: number;
    geometryLength: number;
    shape:LineString;
}

// SideCode describes the location or validity direction in relation to RoadLink digitzing direction
export enum SideCode {
    BothDirections = 1,
    TowardsDigitizing = 2,
    AgainstDigitizing = 3,
    Unknown = 99
}

export enum ValidityDirectionRoadAddress {
    TowardsRoadAddressGrowth = 1,
    AgainstRoadAddressGrowth = 2,
    LengthwiseRoadAddressGrowth = 3,
}

// Road address track
export enum Track {
    Combined = 0,
    RightSide = 1,
    LeftSide = 2,
    Unknown = 99
}