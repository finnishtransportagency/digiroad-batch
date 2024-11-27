interface TrafficSignTypeValues {
    OTHValue: number;
    VelhoNewLawCode: string | null;
    VelhoOldLawCode: string | null;
}

export function getTrafficSignTypeDigiroadValue(velhoNewLawCode: string | null, velhoOldLawCode: string | null): number | null {
    let match = trafficSignTypeMappings.find(mapping => mapping.VelhoNewLawCode === velhoNewLawCode);

    if (!match && velhoOldLawCode) {
        match = trafficSignTypeMappings.find(mapping => mapping.VelhoOldLawCode === velhoOldLawCode);
    }

    return match ? match.OTHValue : null;
}

export function getLocationSpecifierSideDigiroadValue(velhoSideValue: string | null): number | null {
    switch (velhoSideValue) {
        case "puoli/p01":
            return 1;                           // Oikea
        case "puoli/p02":
            return 2;                           // Vasen
        case "puoli/p03":
            return 4;                           // Välissä
        case null:
            return null;
        default:
            return null;
    }
}

export function getStructureDigiroadValue(velhoStructureValue: string | null): number | null {
    switch (velhoStructureValue) {
        case "liikennemerkki-kiinnitystapa/liikita01":
            return 7;                           // Muu
        case "liikennemerkki-kiinnitystapa/liikita02":
            return 7;                           // Muu
        case null:
            return null;
        default:
            return null;
    }
}

export function getConditionDigiroadValue(velhoConditionValue: string | null): number | null {
    switch (velhoConditionValue) {
        case "kuntoluokka/kl01":
            return 1;
        case "kuntoluokka/kl02":
            return 2;
        case "kuntoluokka/kl03":
            return 3;
        case "kuntoluokka/kl04":
            return 4;
        case "kuntoluokka/kl05":
            return 5;
        case "kuntoluokka/kl09":
            return null;
        case null:
            return null;
        default:
            return null;
    }
}

export function getSizeDigiroadValue(velhoSizeValue: string | null): number | null {
    switch (velhoSizeValue) {
        case "liikennemerkki-koko/liikok03":
            return 1;
        case "liikennemerkki-koko/liikok02":
            return 2;
        case "liikennemerkki-koko/liikok01":
            return 3;
        case null:
            return null;
        default:
            return null;
    }
}

export function getCoatingTypeDigiroadValue(velhoCoatingTypeValue: string | null): number | null {
    switch (velhoCoatingTypeValue) {
        case "liikennemerkki-kalvotyyppi/liikalty02":
            return 1;
        case "liikennemerkki-kalvotyyppi/liikalty03":
            return 2;
        case "liikennemerkki-kalvotyyppi/liikalty04":
            return 3;
        case null:
            return null;
        default:
            return null;
    }
}

export function getSignMaterialDigiroadValue(velhoSignMaterialValue: string | null): number | null {
    switch (velhoSignMaterialValue) {
        case "materiaali/ma02":
            return 1;               // Vaneri
        case "materiaali/ma01":
            return 2;               // Alumiini
        case null:
            return null;
        default:
            return 3;               // ma03 - ma19 muut
    }
}

export function getTypeOfDamageDigiroadValue(velhoTypeOfDamageValue: string | null): number | null {
    switch (velhoTypeOfDamageValue) {
        case "varusteet-vauriotyyppi/vavt33":
            return 1;                           // Ruostunut
        case "varusteet-vauriotyyppi/vavt42":
            return 2;                           // Kolhiintunut
        case "varusteet-vauriotyyppi/vavt30":
            return 3;                           // Maalaus
        case null:
            return null;
        default:
            return 4;                           // Muu vaurio
    }
}

export function getUrgencyOfRepairDigiroadValue(velhoUrgencyOfRepair: string | null): number | null {
    switch (velhoUrgencyOfRepair) {
        case "korjauksen-kiireellisyysluokka/koki01":
            return 1;                           // Erittäin kiireellinen
        case "korjauksen-kiireellisyysluokka/koki02":
            return 2;                           // Kiireellinen
        case "korjauksen-kiireellisyysluokka/koki03":
            return 3;                           // Jokseenkin kiireellinen
        case "korjauksen-kiireellisyysluokka/koki04":
            return 3;                           // Ei kiireellinen
        case null:
            return null;
        default:
            return null;
    }
}

const trafficSignTypeMappings: TrafficSignTypeValues[] = [
    {OTHValue: 147, VelhoNewLawCode: null, VelhoOldLawCode: "liiasnro224"},
    {OTHValue: 36, VelhoNewLawCode: "liilnro1", VelhoOldLawCode: "liiasnro1"},
    {OTHValue: 37, VelhoNewLawCode: "liilnro2", VelhoOldLawCode: "liiasnro2"},
    {OTHValue: 38, VelhoNewLawCode: "liilnro3", VelhoOldLawCode: "liiasnro3"},
    {OTHValue: 39, VelhoNewLawCode: "liilnro4", VelhoOldLawCode: "liiasnro4"},
    {OTHValue: 41, VelhoNewLawCode: "liilnro5", VelhoOldLawCode: "liiasnro6"},
    {OTHValue: 40, VelhoNewLawCode: "liilnro6", VelhoOldLawCode: "liiasnro5"},
    {OTHValue: 82, VelhoNewLawCode: "liilnro7", VelhoOldLawCode: "liiasnro7"},
    {OTHValue: 83, VelhoNewLawCode: "liilnro8", VelhoOldLawCode: "liiasnro8"},
    {OTHValue: 84, VelhoNewLawCode: "liilnro9", VelhoOldLawCode: "liiasnro9"},
    {OTHValue: 200, VelhoNewLawCode: "liilnro10", VelhoOldLawCode: "liiasnro10"},
    {OTHValue: 201, VelhoNewLawCode: "liilnro11", VelhoOldLawCode: "liiasnro11"},
    {OTHValue: 42, VelhoNewLawCode: "liilnro12", VelhoOldLawCode: "liiasnro12"},
    {OTHValue: 202, VelhoNewLawCode: "liilnro13", VelhoOldLawCode: "liiasnro235"},
    {OTHValue: 85, VelhoNewLawCode: "liilnro14", VelhoOldLawCode: "liiasnro13"},
    {OTHValue: 203, VelhoNewLawCode: "liilnro15", VelhoOldLawCode: "liiasnro14"},
    {OTHValue: 86, VelhoNewLawCode: "liilnro16", VelhoOldLawCode: "liiasnro15"},
    {OTHValue: 204, VelhoNewLawCode: "liilnro17", VelhoOldLawCode: "liiasnro16"},
    {OTHValue: 87, VelhoNewLawCode: "liilnro18", VelhoOldLawCode: "liiasnro17"},
    {OTHValue: 205, VelhoNewLawCode: "liilnro19", VelhoOldLawCode: null},
    {OTHValue: 43, VelhoNewLawCode: "liilnro20", VelhoOldLawCode: "liiasnro18"},
    {OTHValue: 88, VelhoNewLawCode: "liilnro21", VelhoOldLawCode: "liiasnro19"},
    {OTHValue: 206, VelhoNewLawCode: "liilnro22", VelhoOldLawCode: "liiasnro20"},
    {OTHValue: 125, VelhoNewLawCode: "liilnro23", VelhoOldLawCode: "liiasnro21"},
    {OTHValue: 126, VelhoNewLawCode: "liilnro24", VelhoOldLawCode: "liiasnro22"},
    {OTHValue: 207, VelhoNewLawCode: "liilnro25", VelhoOldLawCode: null},
    {OTHValue: 89, VelhoNewLawCode: "liilnro26", VelhoOldLawCode: "liiasnro23"},
    {OTHValue: 127, VelhoNewLawCode: "liilnro27", VelhoOldLawCode: "liiasnro24"},
    {OTHValue: 208, VelhoNewLawCode: "liilnro28", VelhoOldLawCode: null},
    {OTHValue: 208, VelhoNewLawCode: "liilnro29", VelhoOldLawCode: null},
    {OTHValue: 128, VelhoNewLawCode: "liilnro30", VelhoOldLawCode: "liiasnro25"},
    {OTHValue: 128, VelhoNewLawCode: "liilnro31", VelhoOldLawCode: "liiasnro25"},
    {OTHValue: 129, VelhoNewLawCode: "liilnro32", VelhoOldLawCode: "liiasnro26"},
    {OTHValue: 129, VelhoNewLawCode: "liilnro33", VelhoOldLawCode: "liiasnro26"},
    {OTHValue: 129, VelhoNewLawCode: "liilnro34", VelhoOldLawCode: "liiasnro26"},
    {OTHValue: 129, VelhoNewLawCode: "liilnro35", VelhoOldLawCode: "liiasnro26"},
    {OTHValue: 90, VelhoNewLawCode: "liilnro36", VelhoOldLawCode: "liiasnro27"},
    {OTHValue: 209, VelhoNewLawCode: "liilnro37", VelhoOldLawCode: "liiasnro28"},
    {OTHValue: 91, VelhoNewLawCode: "liilnro38", VelhoOldLawCode: "liiasnro29"},
    {OTHValue: 130, VelhoNewLawCode: "liilnro39", VelhoOldLawCode: "liiasnro30"},
    {OTHValue: 131, VelhoNewLawCode: "liilnro40", VelhoOldLawCode: "liiasnro31"},
    {OTHValue: 210, VelhoNewLawCode: "liilnro41", VelhoOldLawCode: "liiasnro32"},
    {OTHValue: 210, VelhoNewLawCode: "liilnro42", VelhoOldLawCode: "liiasnro32"},
    {OTHValue: 211, VelhoNewLawCode: "liilnro43", VelhoOldLawCode: "liiasnro33"},
    {OTHValue: 211, VelhoNewLawCode: "liilnro44", VelhoOldLawCode: "liiasnro33"},
    {OTHValue: 212, VelhoNewLawCode: "liilnro45", VelhoOldLawCode: "liiasnro34"},
    {OTHValue: 212, VelhoNewLawCode: "liilnro46", VelhoOldLawCode: "liiasnro34"},
    {OTHValue: 132, VelhoNewLawCode: "liilnro47", VelhoOldLawCode: "liiasnro35"},
    {OTHValue: 133, VelhoNewLawCode: "liilnro48", VelhoOldLawCode: "liiasnro36"},
    {OTHValue: 92, VelhoNewLawCode: "liilnro49", VelhoOldLawCode: "liiasnro37"},
    {OTHValue: 213, VelhoNewLawCode: "liilnro50", VelhoOldLawCode: "liiasnro38"},
    {OTHValue: 93, VelhoNewLawCode: "liilnro51", VelhoOldLawCode: "liiasnro39"},
    {OTHValue: 9, VelhoNewLawCode: "liilnro52", VelhoOldLawCode: "liiasnro40"},
    {OTHValue: 94, VelhoNewLawCode: "liilnro53", VelhoOldLawCode: "liiasnro41"},
    {OTHValue: 95, VelhoNewLawCode: "liilnro54", VelhoOldLawCode: "liiasnro42"},
    {OTHValue: 96, VelhoNewLawCode: "liilnro55", VelhoOldLawCode: "liiasnro43"},
    {OTHValue: 97, VelhoNewLawCode: "liilnro56", VelhoOldLawCode: "liiasnro44"},
    {OTHValue: 98, VelhoNewLawCode: "liilnro57", VelhoOldLawCode: "liiasnro45"},
    {OTHValue: 99, VelhoNewLawCode: "liilnro58", VelhoOldLawCode: "liiasnro46"},
    {OTHValue: 214, VelhoNewLawCode: "liilnro59", VelhoOldLawCode: null},
    {OTHValue: 13, VelhoNewLawCode: "liilnro60", VelhoOldLawCode: "liiasnro47"},
    {OTHValue: 14, VelhoNewLawCode: "liilnro61", VelhoOldLawCode: "liiasnro48"},
    {OTHValue: 15, VelhoNewLawCode: "liilnro62", VelhoOldLawCode: "liiasnro49"},
    {OTHValue: 16, VelhoNewLawCode: "liilnro63", VelhoOldLawCode: "liiasnro50"},
    {OTHValue: 17, VelhoNewLawCode: "liilnro64", VelhoOldLawCode: "liiasnro51"},
    {OTHValue: 18, VelhoNewLawCode: "liilnro65", VelhoOldLawCode: "liiasnro52"},
    {OTHValue: 19, VelhoNewLawCode: "liilnro66", VelhoOldLawCode: "liiasnro53"},
    {OTHValue: 20, VelhoNewLawCode: "liilnro67", VelhoOldLawCode: "liiasnro54"},
    {OTHValue: 21, VelhoNewLawCode: "liilnro68", VelhoOldLawCode: "liiasnro55"},
    {OTHValue: 22, VelhoNewLawCode: "liilnro69", VelhoOldLawCode: "liiasnro56"},
    {OTHValue: 215, VelhoNewLawCode: "liilnro70", VelhoOldLawCode: null},
    {OTHValue: 23, VelhoNewLawCode: "liilnro71", VelhoOldLawCode: "liiasnro57"},
    {OTHValue: 24, VelhoNewLawCode: "liilnro72", VelhoOldLawCode: "liiasnro58"},
    {OTHValue: 216, VelhoNewLawCode: "liilnro73", VelhoOldLawCode: null},
    {OTHValue: 25, VelhoNewLawCode: "liilnro74", VelhoOldLawCode: "liiasnro59"},
    {OTHValue: 26, VelhoNewLawCode: "liilnro75", VelhoOldLawCode: "liiasnro60"},
    {OTHValue: 27, VelhoNewLawCode: "liilnro76", VelhoOldLawCode: "liiasnro61"},
    {OTHValue: 10, VelhoNewLawCode: "liilnro77", VelhoOldLawCode: "liiasnro62"},
    {OTHValue: 11, VelhoNewLawCode: "liilnro78", VelhoOldLawCode: "liiasnro63"},
    {OTHValue: 12, VelhoNewLawCode: "liilnro79", VelhoOldLawCode: "liiasnro64"},
    {OTHValue: 30, VelhoNewLawCode: "liilnro80", VelhoOldLawCode: "liiasnro65"},
    {OTHValue: 31, VelhoNewLawCode: "liilnro81", VelhoOldLawCode: "liiasnro66"},
    {OTHValue: 8, VelhoNewLawCode: "liilnro82", VelhoOldLawCode: "liiasnro67"},
    {OTHValue: 32, VelhoNewLawCode: "liilnro83", VelhoOldLawCode: "liiasnro68"},
    {OTHValue: 33, VelhoNewLawCode: "liilnro84", VelhoOldLawCode: "liiasnro69"},
    {OTHValue: 34, VelhoNewLawCode: "liilnro85", VelhoOldLawCode: "liiasnro70"},
    {OTHValue: 35, VelhoNewLawCode: "liilnro86", VelhoOldLawCode: "liiasnro71"},
    {OTHValue: 28, VelhoNewLawCode: "liilnro87", VelhoOldLawCode: "liiasnro72"},
    {OTHValue: 29, VelhoNewLawCode: "liilnro88", VelhoOldLawCode: "liiasnro73"},
    {OTHValue: 217, VelhoNewLawCode: "liilnro89", VelhoOldLawCode: "liiasnro74"},
    {OTHValue: 218, VelhoNewLawCode: "liilnro90", VelhoOldLawCode: "liiasnro75"},
    {OTHValue: 1, VelhoNewLawCode: "liilnro91", VelhoOldLawCode: "liiasnro76"},
    {OTHValue: 2, VelhoNewLawCode: "liilnro92", VelhoOldLawCode: "liiasnro77"},
    {OTHValue: 3, VelhoNewLawCode: "liilnro93", VelhoOldLawCode: "liiasnro78"},
    {OTHValue: 4, VelhoNewLawCode: "liilnro94", VelhoOldLawCode: "liiasnro79"},
    {OTHValue: 219, VelhoNewLawCode: "liilnro95", VelhoOldLawCode: "liiasnro80"},
    {OTHValue: 100, VelhoNewLawCode: "liilnro96", VelhoOldLawCode: "liiasnro81"},
    {OTHValue: 101, VelhoNewLawCode: "liilnro97", VelhoOldLawCode: "liiasnro82"},
    {OTHValue: 102, VelhoNewLawCode: "liilnro98", VelhoOldLawCode: "liiasnro83"},
    {OTHValue: 103, VelhoNewLawCode: "liilnro99", VelhoOldLawCode: "liiasnro84"},
    {OTHValue: 80, VelhoNewLawCode: "liilnro100", VelhoOldLawCode: "liiasnro85"},
    {OTHValue: 81, VelhoNewLawCode: "liilnro101", VelhoOldLawCode: "liiasnro86"},
    {OTHValue: 220, VelhoNewLawCode: "liilnro102", VelhoOldLawCode: null},
    {OTHValue: 104, VelhoNewLawCode: "liilnro103", VelhoOldLawCode: "liiasnro87"},
    {OTHValue: 134, VelhoNewLawCode: "liilnro104", VelhoOldLawCode: "liiasnro88"},
    {OTHValue: 221, VelhoNewLawCode: "liilnro105", VelhoOldLawCode: "liiasnro89"},
    {OTHValue: 221, VelhoNewLawCode: "liilnro106", VelhoOldLawCode: "liiasnro89"},
    {OTHValue: 221, VelhoNewLawCode: "liilnro107", VelhoOldLawCode: "liiasnro89"},
    {OTHValue: 222, VelhoNewLawCode: "liilnro108", VelhoOldLawCode: "liiasnro90"},
    {OTHValue: 222, VelhoNewLawCode: "liilnro109", VelhoOldLawCode: "liiasnro90"},
    {OTHValue: 222, VelhoNewLawCode: "liilnro110", VelhoOldLawCode: "liiasnro90"},
    {OTHValue: 222, VelhoNewLawCode: "liilnro111", VelhoOldLawCode: "liiasnro90"},
    {OTHValue: 222, VelhoNewLawCode: "liilnro112", VelhoOldLawCode: "liiasnro90"},
    {OTHValue: 223, VelhoNewLawCode: "liilnro113", VelhoOldLawCode: "liiasnro91"},
    {OTHValue: 224, VelhoNewLawCode: "liilnro114", VelhoOldLawCode: null},
    {OTHValue: 225, VelhoNewLawCode: "liilnro115", VelhoOldLawCode: "liiasnro92"},
    {OTHValue: 226, VelhoNewLawCode: "liilnro116", VelhoOldLawCode: null},
    {OTHValue: 227, VelhoNewLawCode: "liilnro117", VelhoOldLawCode: "liiasnro93"},
    {OTHValue: 74, VelhoNewLawCode: "liilnro118", VelhoOldLawCode: "liiasnro94"},
    {OTHValue: 74, VelhoNewLawCode: "liilnro119", VelhoOldLawCode: "liiasnro94"},
    {OTHValue: 74, VelhoNewLawCode: "liilnro120", VelhoOldLawCode: "liiasnro94"},
    {OTHValue: 228, VelhoNewLawCode: "liilnro121", VelhoOldLawCode: null},
    {OTHValue: 228, VelhoNewLawCode: "liilnro122", VelhoOldLawCode: null},
    {OTHValue: 228, VelhoNewLawCode: "liilnro123", VelhoOldLawCode: null},
    {OTHValue: 229, VelhoNewLawCode: "liilnro124", VelhoOldLawCode: "liiasnro95"},
    {OTHValue: 229, VelhoNewLawCode: "liilnro125", VelhoOldLawCode: "liiasnro95"},
    {OTHValue: 229, VelhoNewLawCode: "liilnro126", VelhoOldLawCode: "liiasnro95"},
    {OTHValue: 230, VelhoNewLawCode: "liilnro127", VelhoOldLawCode: null},
    {OTHValue: 230, VelhoNewLawCode: "liilnro128", VelhoOldLawCode: null},
    {OTHValue: 230, VelhoNewLawCode: "liilnro129", VelhoOldLawCode: null},
    {OTHValue: 231, VelhoNewLawCode: "liilnro130", VelhoOldLawCode: "liiasnro96"},
    {OTHValue: 232, VelhoNewLawCode: "liilnro131", VelhoOldLawCode: null},
    {OTHValue: 77, VelhoNewLawCode: "liilnro132", VelhoOldLawCode: "liiasnro97"},
    {OTHValue: 78, VelhoNewLawCode: "liilnro133", VelhoOldLawCode: "liiasnro98"},
    {OTHValue: 233, VelhoNewLawCode: "liilnro134", VelhoOldLawCode: null},
    {OTHValue: 234, VelhoNewLawCode: "liilnro135", VelhoOldLawCode: "liiasnro99"},
    {OTHValue: 70, VelhoNewLawCode: "liilnro136", VelhoOldLawCode: "liiasnro100"},
    {OTHValue: 71, VelhoNewLawCode: "liilnro137", VelhoOldLawCode: "liiasnro101"},
    {OTHValue: 72, VelhoNewLawCode: "liilnro138", VelhoOldLawCode: "liiasnro102"},
    {OTHValue: 235, VelhoNewLawCode: "liilnro139", VelhoOldLawCode: "liiasnro103"},
    {OTHValue: 236, VelhoNewLawCode: "liilnro140", VelhoOldLawCode: "liiasnro104"},
    {OTHValue: 135, VelhoNewLawCode: "liilnro141", VelhoOldLawCode: "liiasnro105"},
    {OTHValue: 136, VelhoNewLawCode: "liilnro142", VelhoOldLawCode: "liiasnro106"},
    {OTHValue: 237, VelhoNewLawCode: "liilnro143", VelhoOldLawCode: null},
    {OTHValue: 238, VelhoNewLawCode: "liilnro144", VelhoOldLawCode: null},
    {OTHValue: 44, VelhoNewLawCode: "liilnro145", VelhoOldLawCode: "liiasnro107"},
    {OTHValue: 105, VelhoNewLawCode: "liilnro146", VelhoOldLawCode: "liiasnro113"},
    {OTHValue: 137, VelhoNewLawCode: "liilnro147", VelhoOldLawCode: "liiasnro109"},
    {OTHValue: 239, VelhoNewLawCode: "liilnro148", VelhoOldLawCode: null},
    {OTHValue: 240, VelhoNewLawCode: "liilnro149", VelhoOldLawCode: null},
    {OTHValue: 241, VelhoNewLawCode: "liilnro150", VelhoOldLawCode: null},
    {OTHValue: 242, VelhoNewLawCode: "liilnro414", VelhoOldLawCode: null},
    {OTHValue: 243, VelhoNewLawCode: "liilnro151", VelhoOldLawCode: "liiasnro237"},
    {OTHValue: 244, VelhoNewLawCode: "liilnro152", VelhoOldLawCode: "liiasnro238"},
    {OTHValue: 245, VelhoNewLawCode: "liilnro153", VelhoOldLawCode: "liiasnro239"},
    {OTHValue: 246, VelhoNewLawCode: "liilnro154", VelhoOldLawCode: "liiasnro114"},
    {OTHValue: 247, VelhoNewLawCode: "liilnro154", VelhoOldLawCode: "liiasnro309"},
    {OTHValue: 66, VelhoNewLawCode: "liilnro155", VelhoOldLawCode: "liiasnro308"},
    {OTHValue: 68, VelhoNewLawCode: "liilnro156", VelhoOldLawCode: "liiasnro115"},
    {OTHValue: 69, VelhoNewLawCode: "liilnro157", VelhoOldLawCode: "liiasnro116"},
    {OTHValue: 63, VelhoNewLawCode: "liilnro158", VelhoOldLawCode: "liiasnro240"},
    {OTHValue: 248, VelhoNewLawCode: "liilnro159", VelhoOldLawCode: "liiasnro241"},
    {OTHValue: 64, VelhoNewLawCode: "liilnro160", VelhoOldLawCode: "liiasnro242"},
    {OTHValue: 249, VelhoNewLawCode: "liilnro161", VelhoOldLawCode: "liiasnro243"},
    {OTHValue: 65, VelhoNewLawCode: "liilnro162", VelhoOldLawCode: "liiasnro244"},
    {OTHValue: 250, VelhoNewLawCode: "liilnro163", VelhoOldLawCode: "liiasnro245"},
    {OTHValue: 251, VelhoNewLawCode: "liilnro164", VelhoOldLawCode: "liiasnro246"},
    {OTHValue: 252, VelhoNewLawCode: "liilnro165", VelhoOldLawCode: "liiasnro247"},
    {OTHValue: 253, VelhoNewLawCode: "liilnro166", VelhoOldLawCode: null},
    {OTHValue: 254, VelhoNewLawCode: "liilnro167", VelhoOldLawCode: null},
    {OTHValue: 106, VelhoNewLawCode: "liilnro168", VelhoOldLawCode: null},
    {OTHValue: 255, VelhoNewLawCode: "liilnro169", VelhoOldLawCode: "liiasnro117"},
    {OTHValue: 107, VelhoNewLawCode: "liilnro170", VelhoOldLawCode: "liiasnro118"},
    {OTHValue: 108, VelhoNewLawCode: "liilnro171", VelhoOldLawCode: "liiasnro119"},
    {OTHValue: 256, VelhoNewLawCode: "liilnro172", VelhoOldLawCode: "liiasnro120"},
    {OTHValue: 257, VelhoNewLawCode: "liilnro173", VelhoOldLawCode: "liiasnro121"},
    {OTHValue: 258, VelhoNewLawCode: "liilnro174", VelhoOldLawCode: "liiasnro122"},
    {OTHValue: 259, VelhoNewLawCode: "liilnro175", VelhoOldLawCode: "liiasnro123"},
    {OTHValue: 260, VelhoNewLawCode: "liilnro176", VelhoOldLawCode: "liiasnro124"},
    {OTHValue: 5, VelhoNewLawCode: "liilnro177", VelhoOldLawCode: "liiasnro125"},
    {OTHValue: 6, VelhoNewLawCode: "liilnro178", VelhoOldLawCode: "liiasnro126"},
    {OTHValue: 109, VelhoNewLawCode: "liilnro179", VelhoOldLawCode: "liiasnro127"},
    {OTHValue: 110, VelhoNewLawCode: "liilnro180", VelhoOldLawCode: "liiasnro128"},
    {OTHValue: 110, VelhoNewLawCode: "liilnro181", VelhoOldLawCode: "liiasnro129"},
    {OTHValue: 112, VelhoNewLawCode: "liilnro182", VelhoOldLawCode: "liiasnro130"},
    {OTHValue: 261, VelhoNewLawCode: "liilnro183", VelhoOldLawCode: null},
    {OTHValue: 262, VelhoNewLawCode: "liilnro184", VelhoOldLawCode: null},
    {OTHValue: 263, VelhoNewLawCode: "liilnro185", VelhoOldLawCode: null},
    {OTHValue: 192, VelhoNewLawCode: "liilnro186", VelhoOldLawCode: "liiasnro131"},
    {OTHValue: 264, VelhoNewLawCode: "liilnro187", VelhoOldLawCode: null},
    {OTHValue: 265, VelhoNewLawCode: "liilnro188", VelhoOldLawCode: null},
    {OTHValue: 178, VelhoNewLawCode: "liilnro189", VelhoOldLawCode: "liiasnro132"},
    {OTHValue: 266, VelhoNewLawCode: "liilnro190", VelhoOldLawCode: null},
    {OTHValue: 267, VelhoNewLawCode: "liilnro191", VelhoOldLawCode: null},
    {OTHValue: 268, VelhoNewLawCode: "liilnro192", VelhoOldLawCode: null},
    {OTHValue: 152, VelhoNewLawCode: "liilnro193", VelhoOldLawCode: "liiasnro134"},
    {OTHValue: 193, VelhoNewLawCode: "liilnro194", VelhoOldLawCode: "liiasnro133"},
    {OTHValue: 153, VelhoNewLawCode: "liilnro195", VelhoOldLawCode: "liiasnro135"},
    {OTHValue: 154, VelhoNewLawCode: "liilnro196", VelhoOldLawCode: "liiasnro136"},
    {OTHValue: 155, VelhoNewLawCode: "liilnro197", VelhoOldLawCode: "liiasnro137"},
    {OTHValue: 156, VelhoNewLawCode: "liilnro198", VelhoOldLawCode: "liiasnro138"},
    {OTHValue: 269, VelhoNewLawCode: "liilnro199", VelhoOldLawCode: "liiasnro249"},
    {OTHValue: 270, VelhoNewLawCode: "liilnro200", VelhoOldLawCode: null},
    {OTHValue: 271, VelhoNewLawCode: "liilnro201", VelhoOldLawCode: null},
    {OTHValue: 272, VelhoNewLawCode: "liilnro202", VelhoOldLawCode: null},
    {OTHValue: 157, VelhoNewLawCode: "liilnro203", VelhoOldLawCode: "liiasnro139"},
    {OTHValue: 399, VelhoNewLawCode: "liilnro204", VelhoOldLawCode: null},
    {OTHValue: 273, VelhoNewLawCode: "liilnro205", VelhoOldLawCode: null},
    {OTHValue: 158, VelhoNewLawCode: "liilnro206", VelhoOldLawCode: "liiasnro140"},
    {OTHValue: 191, VelhoNewLawCode: "liilnro207", VelhoOldLawCode: "liiasnro141"},
    {OTHValue: 159, VelhoNewLawCode: "liilnro208", VelhoOldLawCode: "liiasnro142"},
    {OTHValue: 160, VelhoNewLawCode: "liilnro209", VelhoOldLawCode: "liiasnro314"},
    {OTHValue: 160, VelhoNewLawCode: "liilnro209", VelhoOldLawCode: "liiasnro313"},
    {OTHValue: 160, VelhoNewLawCode: "liilnro209", VelhoOldLawCode: "liiasnro311"},
    {OTHValue: 160, VelhoNewLawCode: "liilnro209", VelhoOldLawCode: "liiasnro312"},
    {OTHValue: 160, VelhoNewLawCode: "liilnro209", VelhoOldLawCode: "liiasnro310"},
    {OTHValue: 161, VelhoNewLawCode: "liilnro210", VelhoOldLawCode: "liiasnro143"},
    {OTHValue: 274, VelhoNewLawCode: "liilnro211", VelhoOldLawCode: "liiasnro316"},
    {OTHValue: 166, VelhoNewLawCode: "liilnro211", VelhoOldLawCode: "liiasnro315"},
    {OTHValue: 163, VelhoNewLawCode: "liilnro212", VelhoOldLawCode: "liiasnro144"},
    {OTHValue: 275, VelhoNewLawCode: "liilnro213", VelhoOldLawCode: "liiasnro250"},
    {OTHValue: 169, VelhoNewLawCode: "liilnro214", VelhoOldLawCode: "liiasnro146"},
    {OTHValue: 276, VelhoNewLawCode: "liilnro215", VelhoOldLawCode: null},
    {OTHValue: 277, VelhoNewLawCode: "liilnro216", VelhoOldLawCode: null},
    {OTHValue: 278, VelhoNewLawCode: "liilnro217", VelhoOldLawCode: null},
    {OTHValue: 279, VelhoNewLawCode: "liilnro218", VelhoOldLawCode: null},
    {OTHValue: 164, VelhoNewLawCode: "liilnro219", VelhoOldLawCode: "liiasnro145"},
    {OTHValue: 280, VelhoNewLawCode: "liilnro220", VelhoOldLawCode: null},
    {OTHValue: 281, VelhoNewLawCode: "liilnro221", VelhoOldLawCode: null},
    {OTHValue: 282, VelhoNewLawCode: "liilnro222", VelhoOldLawCode: null},
    {OTHValue: 283, VelhoNewLawCode: "liilnro223", VelhoOldLawCode: null},
    {OTHValue: 284, VelhoNewLawCode: "liilnro224", VelhoOldLawCode: null},
    {OTHValue: 285, VelhoNewLawCode: "liilnro225", VelhoOldLawCode: null},
    {OTHValue: 113, VelhoNewLawCode: "liilnro226", VelhoOldLawCode: "liiasnro147"},
    {OTHValue: 114, VelhoNewLawCode: "liilnro227", VelhoOldLawCode: "liiasnro148"},
    {OTHValue: 286, VelhoNewLawCode: "liilnro228", VelhoOldLawCode: null},
    {OTHValue: 170, VelhoNewLawCode: "liilnro229", VelhoOldLawCode: "liiasnro149"},
    {OTHValue: 171, VelhoNewLawCode: "liilnro230", VelhoOldLawCode: "liiasnro150"},
    {OTHValue: 172, VelhoNewLawCode: "liilnro231", VelhoOldLawCode: "liiasnro307"},
    {OTHValue: 287, VelhoNewLawCode: "liilnro231", VelhoOldLawCode: "liiasnro305"},
    {OTHValue: 288, VelhoNewLawCode: "liilnro231", VelhoOldLawCode: "liiasnro306"},
    {OTHValue: 289, VelhoNewLawCode: "liilnro232", VelhoOldLawCode: null},
    {OTHValue: 173, VelhoNewLawCode: "liilnro233", VelhoOldLawCode: "liiasnro151"},
    {OTHValue: 175, VelhoNewLawCode: "liilnro234", VelhoOldLawCode: "liiasnro152"},
    {OTHValue: 176, VelhoNewLawCode: "liilnro235", VelhoOldLawCode: "liiasnro153"},
    {OTHValue: 400, VelhoNewLawCode: "liilnro236", VelhoOldLawCode: "liiasnro251"},
    {OTHValue: 177, VelhoNewLawCode: "liilnro237", VelhoOldLawCode: "liiasnro154"},
    {OTHValue: 290, VelhoNewLawCode: "liilnro238", VelhoOldLawCode: null},
    {OTHValue: 291, VelhoNewLawCode: "liilnro239", VelhoOldLawCode: "liiasnro252"},
    {OTHValue: 174, VelhoNewLawCode: "liilnro240", VelhoOldLawCode: "liiasnro155"},
    {OTHValue: 292, VelhoNewLawCode: "liilnro241", VelhoOldLawCode: null},
    {OTHValue: 115, VelhoNewLawCode: "liilnro242", VelhoOldLawCode: "liiasnro156"},
    {OTHValue: 179, VelhoNewLawCode: "liilnro243", VelhoOldLawCode: "liiasnro157"},
    {OTHValue: 180, VelhoNewLawCode: "liilnro244", VelhoOldLawCode: "liiasnro158"},
    {OTHValue: 181, VelhoNewLawCode: "liilnro245", VelhoOldLawCode: "liiasnro159"},
    {OTHValue: 293, VelhoNewLawCode: "liilnro246", VelhoOldLawCode: null},
    {OTHValue: 182, VelhoNewLawCode: "liilnro247", VelhoOldLawCode: "liiasnro160"},
    {OTHValue: 294, VelhoNewLawCode: "liilnro248", VelhoOldLawCode: null},
    {OTHValue: 183, VelhoNewLawCode: "liilnro249", VelhoOldLawCode: "liiasnro161"},
    {OTHValue: 295, VelhoNewLawCode: "liilnro250", VelhoOldLawCode: null},
    {OTHValue: 116, VelhoNewLawCode: "liilnro251", VelhoOldLawCode: "liiasnro162"},
    {OTHValue: 296, VelhoNewLawCode: "liilnro252", VelhoOldLawCode: "liiasnro253"},
    {OTHValue: 184, VelhoNewLawCode: "liilnro253", VelhoOldLawCode: "liiasnro163"},
    {OTHValue: 185, VelhoNewLawCode: "liilnro254", VelhoOldLawCode: "liiasnro164"},
    {OTHValue: 299, VelhoNewLawCode: "liilnro255", VelhoOldLawCode: null},
    {OTHValue: 117, VelhoNewLawCode: "liilnro257", VelhoOldLawCode: "liiasnro165"},
    {OTHValue: 390, VelhoNewLawCode: "liilnro257", VelhoOldLawCode: "liiasnro254"},
    {OTHValue: 391, VelhoNewLawCode: "liilnro258", VelhoOldLawCode: "liiasnro255"},
    {OTHValue: 392, VelhoNewLawCode: "liilnro259", VelhoOldLawCode: "liiasnro256"},
    {OTHValue: 393, VelhoNewLawCode: "liilnro260", VelhoOldLawCode: "liiasnro257"},
    {OTHValue: 394, VelhoNewLawCode: "liilnro262", VelhoOldLawCode: "liiasnro258"},
    {OTHValue: 395, VelhoNewLawCode: "liilnro263", VelhoOldLawCode: "liiasnro259"},
    {OTHValue: 396, VelhoNewLawCode: "liilnro266", VelhoOldLawCode: "liiasnro260"},
    {OTHValue: 397, VelhoNewLawCode: "liilnro261", VelhoOldLawCode: "liiasnro261"},
    {OTHValue: 398, VelhoNewLawCode: "liilnro264", VelhoOldLawCode: "liiasnro262"},
    {OTHValue: 186, VelhoNewLawCode: "liilnro267", VelhoOldLawCode: "liiasnro168"},
    {OTHValue: 118, VelhoNewLawCode: "liilnro268", VelhoOldLawCode: "liiasnro166"},
    {OTHValue: 119, VelhoNewLawCode: "liilnro269", VelhoOldLawCode: "liiasnro167"},
    {OTHValue: 187, VelhoNewLawCode: "liilnro270", VelhoOldLawCode: "liiasnro169"},
    {OTHValue: 298, VelhoNewLawCode: "liilnro271", VelhoOldLawCode: null},
    {OTHValue: 188, VelhoNewLawCode: "liilnro272", VelhoOldLawCode: "liiasnro170"},
    {OTHValue: 299, VelhoNewLawCode: "liilnro273", VelhoOldLawCode: null},
    {OTHValue: 300, VelhoNewLawCode: "liilnro274", VelhoOldLawCode: null},
    {OTHValue: 301, VelhoNewLawCode: "liilnro275", VelhoOldLawCode: null},
    {OTHValue: 189, VelhoNewLawCode: "liilnro276", VelhoOldLawCode: "liiasnro171"},
    {OTHValue: 302, VelhoNewLawCode: "liilnro277", VelhoOldLawCode: null},
    {OTHValue: 190, VelhoNewLawCode: "liilnro278", VelhoOldLawCode: "liiasnro172"},
    {OTHValue: 303, VelhoNewLawCode: "liilnro279", VelhoOldLawCode: null},
    {OTHValue: 304, VelhoNewLawCode: "liilnro280", VelhoOldLawCode: "liiasnro173"},
    {OTHValue: 305, VelhoNewLawCode: "liilnro281", VelhoOldLawCode: "liiasnro174"},
    {OTHValue: 306, VelhoNewLawCode: "liilnro282", VelhoOldLawCode: "liiasnro175"},
    {OTHValue: 120, VelhoNewLawCode: "liilnro283", VelhoOldLawCode: "liiasnro176"},
    {OTHValue: 307, VelhoNewLawCode: "liilnro284", VelhoOldLawCode: "liiasnro263"},
    {OTHValue: 308, VelhoNewLawCode: "liilnro285", VelhoOldLawCode: "liiasnro177"},
    {OTHValue: 309, VelhoNewLawCode: "liilnro286", VelhoOldLawCode: "liiasnro178"},
    {OTHValue: 310, VelhoNewLawCode: "liilnro287", VelhoOldLawCode: "liiasnro179"},
    {OTHValue: 121, VelhoNewLawCode: "liilnro288", VelhoOldLawCode: "liiasnro180"},
    {OTHValue: 311, VelhoNewLawCode: "liilnro289", VelhoOldLawCode: "liiasnro182"},
    {OTHValue: 122, VelhoNewLawCode: "liilnro290", VelhoOldLawCode: "liiasnro183"},
    {OTHValue: 312, VelhoNewLawCode: "liilnro291", VelhoOldLawCode: null},
    {OTHValue: 313, VelhoNewLawCode: "liilnro292", VelhoOldLawCode: null},
    {OTHValue: 314, VelhoNewLawCode: "liilnro293", VelhoOldLawCode: null},
    {OTHValue: 315, VelhoNewLawCode: "liilnro294", VelhoOldLawCode: "liiasnro184"},
    {OTHValue: 123, VelhoNewLawCode: "liilnro295", VelhoOldLawCode: "liiasnro185"},
    {OTHValue: 316, VelhoNewLawCode: "liilnro296", VelhoOldLawCode: "liiasnro186"},
    {OTHValue: 124, VelhoNewLawCode: "liilnro297", VelhoOldLawCode: "liiasnro187"},
    {OTHValue: 317, VelhoNewLawCode: "liilnro298", VelhoOldLawCode: "liiasnro188"},
    {OTHValue: 318, VelhoNewLawCode: "liilnro299", VelhoOldLawCode: "liiasnro189"},
    {OTHValue: 319, VelhoNewLawCode: "liilnro300", VelhoOldLawCode: "liiasnro190"},
    {OTHValue: 320, VelhoNewLawCode: "liilnro301", VelhoOldLawCode: "liiasnro191"},
    {OTHValue: 321, VelhoNewLawCode: "liilnro302", VelhoOldLawCode: "liiasnro192"},
    {OTHValue: 322, VelhoNewLawCode: "liilnro303", VelhoOldLawCode: "liiasnro193"},
    {OTHValue: 323, VelhoNewLawCode: "liilnro304", VelhoOldLawCode: "liiasnro194"},
    {OTHValue: 324, VelhoNewLawCode: "liilnro305", VelhoOldLawCode: "liiasnro266"},
    {OTHValue: 325, VelhoNewLawCode: "liilnro306", VelhoOldLawCode: "liiasnro268"},
    {OTHValue: 326, VelhoNewLawCode: "liilnro307", VelhoOldLawCode: "liiasnro267"},
    {OTHValue: 327, VelhoNewLawCode: "liilnro308", VelhoOldLawCode: "liiasnro269"},
    {OTHValue: 328, VelhoNewLawCode: "liilnro309", VelhoOldLawCode: "liiasnro270"},
    {OTHValue: 329, VelhoNewLawCode: "liilnro310", VelhoOldLawCode: "liiasnro271"},
    {OTHValue: 330, VelhoNewLawCode: "liilnro311", VelhoOldLawCode: "liiasnro272"},
    {OTHValue: 331, VelhoNewLawCode: "liilnro312", VelhoOldLawCode: "liiasnro273"},
    {OTHValue: 332, VelhoNewLawCode: "liilnro313", VelhoOldLawCode: "liiasnro274"},
    {OTHValue: 333, VelhoNewLawCode: "liilnro314", VelhoOldLawCode: null},
    {OTHValue: 334, VelhoNewLawCode: "liilnro315", VelhoOldLawCode: "liiasnro275"},
    {OTHValue: 335, VelhoNewLawCode: "liilnro316", VelhoOldLawCode: "liiasnro276"},
    {OTHValue: 336, VelhoNewLawCode: "liilnro317", VelhoOldLawCode: "liiasnro277"},
    {OTHValue: 337, VelhoNewLawCode: "liilnro318", VelhoOldLawCode: "liiasnro278"},
    {OTHValue: 338, VelhoNewLawCode: "liilnro319", VelhoOldLawCode: "liiasnro279"},
    {OTHValue: 339, VelhoNewLawCode: "liilnro320", VelhoOldLawCode: "liiasnro280"},
    {OTHValue: 340, VelhoNewLawCode: "liilnro321", VelhoOldLawCode: "liiasnro281"},
    {OTHValue: 341, VelhoNewLawCode: "liilnro322", VelhoOldLawCode: "liiasnro282"},
    {OTHValue: 342, VelhoNewLawCode: "liilnro323", VelhoOldLawCode: "liiasnro264"},
    {OTHValue: 343, VelhoNewLawCode: "liilnro324", VelhoOldLawCode: "liiasnro265"},
    {OTHValue: 344, VelhoNewLawCode: "liilnro325", VelhoOldLawCode: null},
    {OTHValue: 345, VelhoNewLawCode: "liilnro326", VelhoOldLawCode: "liiasnro195"},
    {OTHValue: 345, VelhoNewLawCode: "liilnro327", VelhoOldLawCode: "liiasnro195"},
    {OTHValue: 345, VelhoNewLawCode: "liilnro328", VelhoOldLawCode: "liiasnro195"},
    {OTHValue: 345, VelhoNewLawCode: "liilnro329", VelhoOldLawCode: "liiasnro195"},
    {OTHValue: 345, VelhoNewLawCode: "liilnro330", VelhoOldLawCode: "liiasnro195"},
    {OTHValue: 345, VelhoNewLawCode: "liilnro331", VelhoOldLawCode: "liiasnro195"},
    {OTHValue: 345, VelhoNewLawCode: "liilnro332", VelhoOldLawCode: "liiasnro195"},
    {OTHValue: 345, VelhoNewLawCode: "liilnro333", VelhoOldLawCode: "liiasnro195"},
    {OTHValue: 345, VelhoNewLawCode: "liilnro334", VelhoOldLawCode: "liiasnro195"},
    {OTHValue: 345, VelhoNewLawCode: "liilnro335", VelhoOldLawCode: "liiasnro195"},
    {OTHValue: 345, VelhoNewLawCode: "liilnro336", VelhoOldLawCode: "liiasnro195"},
    {OTHValue: 345, VelhoNewLawCode: "liilnro337", VelhoOldLawCode: "liiasnro195"},
    {OTHValue: 345, VelhoNewLawCode: "liilnro338", VelhoOldLawCode: "liiasnro195"},
    {OTHValue: 346, VelhoNewLawCode: "liilnro339", VelhoOldLawCode: "liiasnro196"},
    {OTHValue: 347, VelhoNewLawCode: "liilnro340", VelhoOldLawCode: "liiasnro197"},
    {OTHValue: 348, VelhoNewLawCode: "liilnro341", VelhoOldLawCode: null},
    {OTHValue: 348, VelhoNewLawCode: "liilnro342", VelhoOldLawCode: null},
    {OTHValue: 148, VelhoNewLawCode: "liilnro343", VelhoOldLawCode: "liiasnro198"},
    {OTHValue: 149, VelhoNewLawCode: "liilnro344", VelhoOldLawCode: "liiasnro199"},
    {OTHValue: 138, VelhoNewLawCode: "liilnro345", VelhoOldLawCode: "liiasnro200"},
    {OTHValue: 45, VelhoNewLawCode: "liilnro346", VelhoOldLawCode: "liiasnro201"},
    {OTHValue: 46, VelhoNewLawCode: "liilnro347", VelhoOldLawCode: "liiasnro202"},
    {OTHValue: 139, VelhoNewLawCode: "liilnro348", VelhoOldLawCode: "liiasnro203"},
    {OTHValue: 140, VelhoNewLawCode: "liilnro349", VelhoOldLawCode: "liiasnro204"},
    {OTHValue: 141, VelhoNewLawCode: "liilnro350", VelhoOldLawCode: "liiasnro205"},
    {OTHValue: 142, VelhoNewLawCode: "liilnro351", VelhoOldLawCode: "liiasnro317"},
    {OTHValue: 143, VelhoNewLawCode: "liilnro351", VelhoOldLawCode: "liiasnro318"},
    {OTHValue: 144, VelhoNewLawCode: "liilnro352", VelhoOldLawCode: "liiasnro206"},
    {OTHValue: 52, VelhoNewLawCode: "liilnro353", VelhoOldLawCode: "liiasnro207"},
    {OTHValue: 53, VelhoNewLawCode: "liilnro354", VelhoOldLawCode: "liiasnro208"},
    {OTHValue: 54, VelhoNewLawCode: "liilnro355", VelhoOldLawCode: "liiasnro209"},
    {OTHValue: 55, VelhoNewLawCode: "liilnro356", VelhoOldLawCode: "liiasnro210"},
    {OTHValue: 150, VelhoNewLawCode: "liilnro357", VelhoOldLawCode: "liiasnro211"},
    {OTHValue: 349, VelhoNewLawCode: "liilnro358", VelhoOldLawCode: null},
    {OTHValue: 56, VelhoNewLawCode: "liilnro359", VelhoOldLawCode: "liiasnro212"},
    {OTHValue: 57, VelhoNewLawCode: "liilnro360", VelhoOldLawCode: "liiasnro213"},
    {OTHValue: 151, VelhoNewLawCode: "liilnro361", VelhoOldLawCode: "liiasnro214"},
    {OTHValue: 58, VelhoNewLawCode: "liilnro362", VelhoOldLawCode: "liiasnro215"},
    {OTHValue: 350, VelhoNewLawCode: "liilnro363", VelhoOldLawCode: null},
    {OTHValue: 351, VelhoNewLawCode: "liilnro364", VelhoOldLawCode: null},
    {OTHValue: 352, VelhoNewLawCode: "liilnro365", VelhoOldLawCode: null},
    {OTHValue: 353, VelhoNewLawCode: "liilnro366", VelhoOldLawCode: "liiasnro217"},
    {OTHValue: 354, VelhoNewLawCode: "liilnro367", VelhoOldLawCode: "liiasnro216"},
    {OTHValue: 47, VelhoNewLawCode: "liilnro368", VelhoOldLawCode: "liiasnro218"},
    {OTHValue: 48, VelhoNewLawCode: "liilnro369", VelhoOldLawCode: "liiasnro219"},
    {OTHValue: 355, VelhoNewLawCode: "liilnro370", VelhoOldLawCode: null},
    {OTHValue: 49, VelhoNewLawCode: "liilnro371", VelhoOldLawCode: "liiasnro220"},
    {OTHValue: 50, VelhoNewLawCode: "liilnro372", VelhoOldLawCode: "liiasnro221"},
    {OTHValue: 145, VelhoNewLawCode: "liilnro373", VelhoOldLawCode: "liiasnro222"},
    {OTHValue: 51, VelhoNewLawCode: "liilnro374", VelhoOldLawCode: "liiasnro223"},
    {OTHValue: 51, VelhoNewLawCode: "liilnro375", VelhoOldLawCode: "liiasnro223"},
    {OTHValue: 60, VelhoNewLawCode: "liilnro376", VelhoOldLawCode: "liiasnro283"},
    {OTHValue: 60, VelhoNewLawCode: "liilnro377", VelhoOldLawCode: "liiasnro283"},
    {OTHValue: 356, VelhoNewLawCode: "liilnro378", VelhoOldLawCode: "liiasnro284"},
    {OTHValue: 59, VelhoNewLawCode: "liilnro379", VelhoOldLawCode: "liiasnro319"},
    {OTHValue: 357, VelhoNewLawCode: "liilnro379", VelhoOldLawCode: "liiasnro320"},
    {OTHValue: 358, VelhoNewLawCode: "liilnro380", VelhoOldLawCode: null},
    {OTHValue: 146, VelhoNewLawCode: "liilnro381", VelhoOldLawCode: "liiasnro861"},
    {OTHValue: 359, VelhoNewLawCode: "liilnro381", VelhoOldLawCode: "liiasnro322"},
    {OTHValue: 360, VelhoNewLawCode: "liilnro382", VelhoOldLawCode: "liiasnro285"},
    {OTHValue: 361, VelhoNewLawCode: "liilnro383", VelhoOldLawCode: "liiasnro225"},
    {OTHValue: 362, VelhoNewLawCode: "liilnro384", VelhoOldLawCode: null},
    {OTHValue: 61, VelhoNewLawCode: "liilnro385", VelhoOldLawCode: "liiasnro226"},
    {OTHValue: 62, VelhoNewLawCode: "liilnro386", VelhoOldLawCode: "liiasnro227"},
    {OTHValue: 363, VelhoNewLawCode: "liilnro387", VelhoOldLawCode: "liiasnro228"},
    {OTHValue: 371, VelhoNewLawCode: "liilnro395", VelhoOldLawCode: "liiasnro328"},
    {OTHValue: 372, VelhoNewLawCode: "liilnro396", VelhoOldLawCode: "liiasnro230"},
    {OTHValue: 373, VelhoNewLawCode: "liilnro397", VelhoOldLawCode: null},
    {OTHValue: 374, VelhoNewLawCode: "liilnro398", VelhoOldLawCode: "liiasnro231"},
    {OTHValue: 375, VelhoNewLawCode: "liilnro399", VelhoOldLawCode: "liiasnro233"},
    {OTHValue: 376, VelhoNewLawCode: "liilnro400", VelhoOldLawCode: "liiasnro234"},
    {OTHValue: 377, VelhoNewLawCode: "liilnro401", VelhoOldLawCode: "liiasnro232"},
    {OTHValue: 378, VelhoNewLawCode: "liilnro402", VelhoOldLawCode: null},
    {OTHValue: 379, VelhoNewLawCode: "liilnro403", VelhoOldLawCode: "liiasnro229"},
    {OTHValue: 382, VelhoNewLawCode: "liilnro406", VelhoOldLawCode: null},
    {OTHValue: 383, VelhoNewLawCode: "liilnro407", VelhoOldLawCode: null},
    {OTHValue: 384, VelhoNewLawCode: "liilnro408", VelhoOldLawCode: "liiasnro301"},
    {OTHValue: 385, VelhoNewLawCode: "liilnro409", VelhoOldLawCode: null},
    {OTHValue: 386, VelhoNewLawCode: "liilnro410", VelhoOldLawCode: "liiasnro294"},
    {OTHValue: 387, VelhoNewLawCode: "liilnro411", VelhoOldLawCode: "liiasnro295"},
    {OTHValue: 388, VelhoNewLawCode: "liilnro412", VelhoOldLawCode: "liiasnro288"},
    {OTHValue: 389, VelhoNewLawCode: "liilnro413", VelhoOldLawCode: "liiasnro196"}
];