import {LinkInformation} from "./type";


// VelhoRoadSide describes the location in relation to the road and it's road address's direction of growth
export enum VelhoRoadSide {
    Right = "puoli/p01",
    Left = "puoli/p02",
    Between = "puoli/p03",
    Across = "puoli/p06"
}

// VelhoValidityDirection describes the validity direction in relation to lane's traffic direction
export enum VelhoValidityDirection {
    TowardsTrafficDirection = "liikennemerkki-vaikutussuunta/liivasu01",      // liivasu01
    AgainstTrafficDirection = "liikennemerkki-vaikutussuunta/liivasu02",       // liivasu02
    LengthwiseTrafficDirection = "liikennemerkki-vaikutussuunta/liivasu03",    // liivasu03
}

export interface VelhoAsset {
    'sijainti-oid': string;
    sijaintitarkenne: {
        ajoradat: string[];
        kaistat?: string[];
        erotusalueet?: string[];
        keskialue?: string[];
        luiskat?: string[];
        pientareet?: string[];
        puoli?: string;
    };
    oid: string;
    luotu: string;
    muokattu: string;
    'tiekohteen-tila': string | null | undefined;
}

export interface VelhoLinearAsset extends VelhoAsset {
    keskilinjageometria: {
        coordinates: [[number, number, number][]];
        type: "MultiLinestring";
    };
    alkusijainti?: {
        osa: number;
        tie: number;
        etaisyys: number;
    } | null;
    loppusijainti?: {
        osa: number;
        tie: number;
        etaisyys: number;
    } | null;
}

export interface VelhoPointAsset extends VelhoAsset {
    sijainti?: {
        osa: number;
        tie: number;
        etaisyys: number;
    } | null;
    keskilinjageometria: {
        coordinates: [number, number, number];
        type: "Point";
    }
}

export interface AssetWithLinkData {
    asset: VelhoAsset;
    linkData: Array<LinkInformation>;
}

