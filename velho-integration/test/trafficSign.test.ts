import {TrafficSignHandler, VelhoTrafficSignAsset} from "../src/lambda/trafficSignHandler";
import {SideCode} from "../src/lambda/type/type";
import {VelhoRoadSide, VelhoValidityDirection} from "../src/lambda/type/velhoAsset";


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

test("should filter out assets with `tiekohteen-tila` not equal to 'tiekohteen-tila/tt03'", () => {
    // normal valid traffic sign
    const validVelhoTrafficSign1: VelhoTrafficSignAsset = {
        'tiekohteen-tila': 'tiekohteen-tila/tt03',
        sijaintitarkenne: {ajoradat: [], puoli: 'puoli/p01'},
        oid: "1",
        luotu: "2022-01-01",
        muokattu: "2022-01-01",
        'sijainti-oid': "s1",
        ominaisuudet: {
            sijaintipoikkeus: null,
            "kunto-ja-vauriotiedot": {
                "varustevauriot": null,
                "yleinen-kuntoluokka": null,
                "arvioitu-jaljella-oleva-kayttoika": null,
            },
            "rakenteelliset-ominaisuudet": {
                arvo: null,
                koko: null,
                suunta: null,
                materiaali: null,
                kalvotyyppi: null,
                korkeusasema: null,
                kiinnitystapa: null,
            },
            "toiminnalliset-ominaisuudet": {
                lakinumero: null,
                lisatietoja: null,
                asetusnumero: null,
                vaikutussuunta: "liikennemerkki-vaikutussuunta/liivasu01",
                "voimassaolo-alkaa": null,
                "voimassaolo-paattyy": null,
            }
        },
        mitattugeometria: null,
        sijainti: null,
        keskilinjageometria: {coordinates: [0, 0, 0], type: "Point"}
    }

    // puoli is puoli/p03 but suunta is defined
    const validVelhoTrafficSign2: VelhoTrafficSignAsset = {
        'tiekohteen-tila': 'tiekohteen-tila/tt03',
        sijaintitarkenne: {ajoradat: [], puoli: 'puoli/p03'},
        oid: "2",
        luotu: "2022-01-01",
        muokattu: "2022-01-01",
        'sijainti-oid': "s1",
        ominaisuudet: {
            sijaintipoikkeus: null,
            "kunto-ja-vauriotiedot": {
                "varustevauriot": null,
                "yleinen-kuntoluokka": null,
                "arvioitu-jaljella-oleva-kayttoika": null,
            },
            "rakenteelliset-ominaisuudet": {
                arvo: null,
                koko: null,
                suunta: '235',
                materiaali: null,
                kalvotyyppi: null,
                korkeusasema: null,
                kiinnitystapa: null,
            },
            "toiminnalliset-ominaisuudet": {
                lakinumero: null,
                lisatietoja: null,
                asetusnumero: null,
                vaikutussuunta: "liikennemerkki-vaikutussuunta/liivasu01",
                "voimassaolo-alkaa": null,
                "voimassaolo-paattyy": null,
            }
        },
        mitattugeometria: null,
        sijainti: null,
        keskilinjageometria: {coordinates: [0, 0, 0], type: "Point"}
    }

    // Invalid 'tiekohteen-tila'
    const invalidVelhoTrafficSign1: VelhoTrafficSignAsset = {
        'tiekohteen-tila': 'tiekohteen-tila/tt01',
        sijaintitarkenne: {ajoradat: [], puoli: 'puoli/p01'},
        oid: "3",
        luotu: "2022-01-01",
        muokattu: "2022-01-01",
        'sijainti-oid': "s1",
        ominaisuudet: {
            sijaintipoikkeus: null,
            "kunto-ja-vauriotiedot": {
                "varustevauriot": null,
                "yleinen-kuntoluokka": null,
                "arvioitu-jaljella-oleva-kayttoika": null,
            },
            "rakenteelliset-ominaisuudet": {
                arvo: null,
                koko: null,
                suunta: null,
                materiaali: null,
                kalvotyyppi: null,
                korkeusasema: null,
                kiinnitystapa: null,
            },
            "toiminnalliset-ominaisuudet": {
                lakinumero: null,
                lisatietoja: null,
                asetusnumero: null,
                vaikutussuunta: "liikennemerkki-vaikutussuunta/liivasu01",
                "voimassaolo-alkaa": null,
                "voimassaolo-paattyy": null,
            }
        },
        mitattugeometria: null,
        sijainti: null,
        keskilinjageometria: {coordinates: [0, 0, 0], type: "Point"}
    }

    // Invalid 'sijaintipoikkeus'
    const invalidVelhoTrafficSign2: VelhoTrafficSignAsset = {
        'tiekohteen-tila': 'tiekohteen-tila/tt03',
        sijaintitarkenne: {ajoradat: [], puoli: 'puoli/p01'},
        oid: "4",
        luotu: "2022-01-01",
        muokattu: "2022-01-01",
        'sijainti-oid': "s1",
        ominaisuudet: {
            sijaintipoikkeus: 'sijaintipoikkeus/sp02',
            "kunto-ja-vauriotiedot": {
                "varustevauriot": null,
                "yleinen-kuntoluokka": null,
                "arvioitu-jaljella-oleva-kayttoika": null,
            },
            "rakenteelliset-ominaisuudet": {
                arvo: null,
                koko: null,
                suunta: null,
                materiaali: null,
                kalvotyyppi: null,
                korkeusasema: null,
                kiinnitystapa: null,
            },
            "toiminnalliset-ominaisuudet": {
                lakinumero: null,
                lisatietoja: null,
                asetusnumero: null,
                vaikutussuunta: "liikennemerkki-vaikutussuunta/liivasu01",
                "voimassaolo-alkaa": null,
                "voimassaolo-paattyy": null,
            }
        },
        mitattugeometria: null,
        sijainti: null,
        keskilinjageometria: {coordinates: [0, 0, 0], type: "Point"}
    }

    // Invalid vaikutussuunta
    const invalidVelhoTrafficSign3: VelhoTrafficSignAsset = {
        'tiekohteen-tila': 'tiekohteen-tila/tt03',
        sijaintitarkenne: {ajoradat: [], puoli: 'puoli/p03'},
        oid: "5",
        luotu: "2022-01-01",
        muokattu: "2022-01-01",
        'sijainti-oid': "s1",
        ominaisuudet: {
            sijaintipoikkeus: null,
            "kunto-ja-vauriotiedot": {
                "varustevauriot": null,
                "yleinen-kuntoluokka": null,
                "arvioitu-jaljella-oleva-kayttoika": null,
            },
            "rakenteelliset-ominaisuudet": {
                arvo: null,
                koko: null,
                suunta: null,
                materiaali: null,
                kalvotyyppi: null,
                korkeusasema: null,
                kiinnitystapa: null,
            },
            "toiminnalliset-ominaisuudet": {
                lakinumero: null,
                lisatietoja: null,
                asetusnumero: null,
                vaikutussuunta: "liikennemerkki-vaikutussuunta/liivasu03",
                "voimassaolo-alkaa": null,
                "voimassaolo-paattyy": null,
            }
        },
        mitattugeometria: null,
        sijainti: null,
        keskilinjageometria: {coordinates: [0, 0, 0], type: "Point"}
    }

    const velhoTrafficSigns: VelhoTrafficSignAsset[] = [validVelhoTrafficSign1, validVelhoTrafficSign2,
        invalidVelhoTrafficSign1, invalidVelhoTrafficSign2, invalidVelhoTrafficSign3]

    const result = assetHandler.filterUnnecessary(velhoTrafficSigns);
    const resultOids = result.map(validSign => validSign.oid);
    expect(result.length).toBe(2);
    expect(resultOids).toContainEqual("1");
    expect(resultOids).toContainEqual("2");

});

