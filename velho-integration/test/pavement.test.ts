import { PavementHandler, VelhoPavementAsset, PavementClass } from "../src/lambda/pavementHandler";

const assetHandler = new PavementHandler();

describe('filter by lanes and roadways', () => {

    const oids = ['1', '2', '3', '4', '5', '6'];
    assetHandler.sourceByOid = Object.fromEntries(oids.map(oid => [oid, 'muut-pintarakenteet']));

    test('roadway 0, lanes not specified: asset should be included', () => {
        const srcData: VelhoPavementAsset[] = [
            {
                'sijainti-oid': 's1',
                sijaintitarkenne: { ajoradat: ['ajorata/ajr0'], kaistat: [] },
                oid: '1',
                luotu: '2023-01-01T12:00:00Z',
                muokattu: '2023-02-01T12:00:00Z',
                'tiekohteen-tila': null,
                keskilinjageometria: { coordinates: [[[0, 0, 0]]], type: 'MultiLinestring' },
                ominaisuudet: { materiaali: 'muu-materiaali/mm04' }
            }
        ];

        const result = assetHandler.filterUnnecessary(srcData);
        expect(result).toHaveLength(1);
        expect(result[0].oid).toBe('1');
    });

    test('roadway 0, main lane 11: asset should be included', () => {
        const srcData: VelhoPavementAsset[] = [
            {
                'sijainti-oid': 's2',
                sijaintitarkenne: { ajoradat: ['ajorata/ajr0'], kaistat: ['kaista-numerointi/kanu11'] },
                oid: '2',
                luotu: '2023-01-01T12:00:00Z',
                muokattu: '2023-02-01T12:00:00Z',
                'tiekohteen-tila': null,
                keskilinjageometria: { coordinates: [[[0, 0, 0]]], type: 'MultiLinestring' },
                ominaisuudet: { materiaali: 'muu-materiaali/mm04' }
            }
        ];

        const result = assetHandler.filterUnnecessary(srcData);
        expect(result).toHaveLength(1);
        expect(result[0].oid).toBe('2');
    });

    test('roadway 0, main lane 21: asset should be discarded as redundant', () => {
        const srcData: VelhoPavementAsset[] = [
            {
                'sijainti-oid': 's3',
                sijaintitarkenne: { ajoradat: ['ajorata/ajr0'], kaistat: ['kaista-numerointi/kanu21'] },
                oid: '3',
                luotu: '2023-01-01T12:00:00Z',
                muokattu: '2023-02-01T12:00:00Z',
                'tiekohteen-tila': null,
                keskilinjageometria: { coordinates: [[[0, 0, 0]]], type: 'MultiLinestring' },
                ominaisuudet: { materiaali: 'muu-materiaali/mm04' }
            }
        ];

        const result = assetHandler.filterUnnecessary(srcData);
        expect(result).toHaveLength(0);
    });

    test('roadway 1, sublane 12: asset should be discarded', () => {
        const srcData: VelhoPavementAsset[] = [
            {
                'sijainti-oid': 's4',
                sijaintitarkenne: { ajoradat: ['ajorata/ajr1'], kaistat: ['kaista-numerointi/kanu12'] },
                oid: '4',
                luotu: '2023-01-01T12:00:00Z',
                muokattu: '2023-02-01T12:00:00Z',
                'tiekohteen-tila': null,
                keskilinjageometria: { coordinates: [[[0, 0, 0]]], type: 'MultiLinestring' },
                ominaisuudet: { materiaali: 'muu-materiaali/mm04' }
            }
        ];

        const result = assetHandler.filterUnnecessary(srcData);
        expect(result).toHaveLength(0);
    });

    test('no roadway specified, main lane 11: asset should be included', () => {
        const srcData: VelhoPavementAsset[] = [
            {
                'sijainti-oid': 's5',
                sijaintitarkenne: { ajoradat: [], kaistat: ['kaista-numerointi/kanu11'] },
                oid: '5',
                luotu: '2023-01-01T12:00:00Z',
                muokattu: '2023-02-01T12:00:00Z',
                'tiekohteen-tila': null,
                keskilinjageometria: { coordinates: [[[0, 0, 0]]], type: 'MultiLinestring' },
                ominaisuudet: { materiaali: 'muu-materiaali/mm04' }
            }
        ];

        const result = assetHandler.filterUnnecessary(srcData);
        expect(result).toHaveLength(1);
        expect(result[0].oid).toBe('5');
    });

    test('roadway 0, asset in both main lanes: asset should be included', () => {
        const srcData: VelhoPavementAsset[] = [
            {
                'sijainti-oid': 's6',
                sijaintitarkenne: { ajoradat: ['ajorata/ajr0'], kaistat: ['kaista-numerointi/kanu11', 'kaista-numerointi/kanu21'] },
                oid: '6',
                luotu: '2023-01-01T12:00:00Z',
                muokattu: '2023-02-01T12:00:00Z',
                'tiekohteen-tila': null,
                keskilinjageometria: { coordinates: [[[0, 0, 0]]], type: 'MultiLinestring' },
                ominaisuudet: { materiaali: 'muu-materiaali/mm04' }
            }
        ];

        const result = assetHandler.filterUnnecessary(srcData);
        expect(result).toHaveLength(1);
        expect(result[0].oid).toBe('6');
    })
});

describe('filter by pavement type', () => {
    test('filters asphalt types correctly', () => {
        const srcData: VelhoPavementAsset[] = [
            {
                'sijainti-oid': 's1',
                sijaintitarkenne: { ajoradat: [''] },
                oid: '1',
                luotu: '2023-01-01T12:00:00Z',
                muokattu: '2023-02-01T12:00:00Z',
                'tiekohteen-tila': null,
                keskilinjageometria: { coordinates: [[[0, 0, 0]]], type: 'MultiLinestring' },
                ominaisuudet: { materiaali: 'muu-materiaali/mm04' }
            },
            {
                'sijainti-oid': 's2',
                sijaintitarkenne: { ajoradat: [''] },
                oid: '2',
                luotu: '2023-01-01T12:00:00Z',
                muokattu: '2023-02-01T12:00:00Z',
                'tiekohteen-tila': null,
                keskilinjageometria: { coordinates: [[[0, 0, 0]]], type: "MultiLinestring" },
                ominaisuudet: { tyyppi: 'sidotun-paallysrakenteen-tyyppi/spt01', 'paallysteen-tyyppi': 'paallystetyyppi/pt10' }
            }
        ];
        assetHandler.sourceByOid = { '1': 'muut-pintarakenteet', '2': 'sidotut-paallysrakenteet' };
        const result = assetHandler.filterByPavementType(srcData);
        expect(result.map(r => assetHandler.pavementByOid[r.oid])).toEqual([
            PavementClass.Asphalt, PavementClass.Asphalt,
        ]);
    });

    test('filters cobblestone types correctly', () => {
        const srcData: VelhoPavementAsset[] = [
            {
                'sijainti-oid': 's3',
                sijaintitarkenne: { ajoradat: [''] },
                oid: '3',
                luotu: '2023-01-01T12:00:00Z',
                muokattu: '2023-02-01T12:00:00Z',
                'tiekohteen-tila': 'tt03',
                keskilinjageometria: { coordinates: [[[0, 0, 0]]], type: "MultiLinestring" },
                ominaisuudet: { materiaali: 'kiven-materiaali/km01' }
            },
            {
                'sijainti-oid': 's4',
                sijaintitarkenne: { ajoradat: [''] },
                oid: '4',
                luotu: '2023-01-01T12:00:00Z',
                muokattu: '2023-02-01T12:00:00Z',
                'tiekohteen-tila': null,
                keskilinjageometria: { coordinates: [[[0, 0, 0]]], type: "MultiLinestring" },
                ominaisuudet: { materiaali: 'kiven-materiaali/km02' }
            }
        ];
        assetHandler.sourceByOid = { '3': 'ladottavat-pintarakenteet', '4': 'ladottavat-pintarakenteet' };
        const result = assetHandler.filterByPavementType(srcData);
        expect(result.map(r => assetHandler.pavementByOid[r.oid])).toEqual([
            PavementClass.Cobblestone, PavementClass.Cobblestone,
        ]);
    });

    test('filters unbound pavement types correctly', () => {
        const srcData: VelhoPavementAsset[] = [
            {
                'sijainti-oid': 's5',
                sijaintitarkenne: { ajoradat: [''] },
                oid: '5',
                luotu: '2023-01-01T12:00:00Z',
                muokattu: '2023-02-01T12:00:00Z',
                'tiekohteen-tila': null,
                keskilinjageometria: { coordinates: [[[0, 0, 0]]], type: 'MultiLinestring' },
                ominaisuudet: { materiaali: 'muu-materiaali/mm09' }
            },
            {
                'sijainti-oid': 's6',
                sijaintitarkenne: { ajoradat: [''] },
                oid: '6',
                luotu: '2023-01-01T12:00:00Z',
                muokattu: '2023-02-01T12:00:00Z',
                'tiekohteen-tila': null,
                keskilinjageometria: { coordinates: [[[0, 0, 0]]], type: 'MultiLinestring' },
                ominaisuudet: { runkomateriaali: 'sitomattoman-pintarakenteen-runkomateriaali/spr03' }
            }
        ];
        assetHandler.sourceByOid = { '5': 'muut-pintarakenteet', '6': 'sitomattomat-pintarakenteet' };
        const result = assetHandler.filterByPavementType(srcData);
        expect(result.map(r => assetHandler.pavementByOid[r.oid])).toEqual([
            PavementClass.UnboundWearLayer, PavementClass.UnboundWearLayer,
        ]);
    });

    test('filters other pavement types correctly', () => {
        const srcData: VelhoPavementAsset[] = [
            {
                'sijainti-oid': 's7',
                sijaintitarkenne: { ajoradat: [''] },
                oid: '7',
                luotu: '2023-01-01T12:00:00Z',
                muokattu: '2023-02-01T12:00:00Z',
                'tiekohteen-tila': null,
                keskilinjageometria: { coordinates: [[[0, 0, 0]]], type: 'MultiLinestring' },
                ominaisuudet: { materiaali: 'muu-materiaali/mm01' }
            },
            {
                'sijainti-oid': 's8',
                sijaintitarkenne: { ajoradat: [''] },
                oid: '8',
                luotu: '2023-01-01T12:00:00Z',
                muokattu: '2023-02-01T12:00:00Z',
                'tiekohteen-tila': null,
                keskilinjageometria: { coordinates: [[[0, 0, 0]]], type: 'MultiLinestring' },
                ominaisuudet: { tyyppi: 'sidotun-paallysrakenteen-tyyppi/spt01', 'paallysteen-tyyppi': 'paallystetyyppi/pt07' }
            }
        ];
        assetHandler.sourceByOid = { '7': 'muut-pintarakenteet', '8': 'sidotut-paallysrakenteet' };
        const result = assetHandler.filterByPavementType(srcData);
        expect(result.map(r => assetHandler.pavementByOid[r.oid])).toEqual([
            PavementClass.OtherPavementClasses, PavementClass.OtherPavementClasses,
        ]);
    });

    test('filters unknown pavement types correctly', () => {
        const srcData: VelhoPavementAsset[] = [
            {
                'sijainti-oid': 's9',
                sijaintitarkenne: { ajoradat: [''] },
                oid: '9',
                luotu: '2023-01-01T12:00:00Z',
                muokattu: '2023-02-01T12:00:00Z',
                'tiekohteen-tila': null,
                keskilinjageometria: { coordinates: [[[0, 0, 0]]], type: "MultiLinestring" },
                ominaisuudet: { materiaali: 'muu-materiaali/mm08' }
            },
            {
                'sijainti-oid': 's10',
                sijaintitarkenne: { ajoradat: [''] },
                oid: '10',
                luotu: '2023-01-01T12:00:00Z',
                muokattu: '2023-02-01T12:00:00Z',
                'tiekohteen-tila': null,
                keskilinjageometria: { coordinates: [[[0, 0, 0]]], type: "MultiLinestring" },
                ominaisuudet: { tyyppi: 'sidotun-paallysrakenteen-tyyppi/spt01', 'paallysteen-tyyppi': 'paallystetyyppi/pt21' }
            }
        ];
        assetHandler.sourceByOid = { '9': 'muut-pintarakenteet', '10': 'sidotut-paallysrakenteet' };
        const result = assetHandler.filterByPavementType(srcData);
        expect(result.map(r => assetHandler.pavementByOid[r.oid])).toEqual([
            PavementClass.Unknown, PavementClass.Unknown,
        ]);
    });

    test('throws exception on an unrecognized source', () => {
        const srcData: VelhoPavementAsset[] = [
            {
                'sijainti-oid': 's11',
                sijaintitarkenne: { ajoradat: [''] },
                oid: '11',
                luotu: '2023-01-01T12:00:00Z',
                muokattu: '2023-02-01T12:00:00Z',
                'tiekohteen-tila': null,
                keskilinjageometria: { coordinates: [[[0, 0, 0]]], type: "MultiLinestring" },
                ominaisuudet: { materiaali: 'muu-materiaali/mm04' }
            }
        ];
        assetHandler.sourceByOid = { '11': 'unknown-source' };
        expect(() => assetHandler.filterByPavementType(srcData)).toThrow('unrecognized pavement source');
    });

    test('surfacing 1 is taken, but 2 is ignored', () => {
        const srcData: VelhoPavementAsset[] = [
            {
                'sijainti-oid': 's12',
                sijaintitarkenne: { ajoradat: [''] },
                oid: '12',
                luotu: '2023-01-01T12:00:00Z',
                muokattu: '2023-02-01T12:00:00Z',
                'tiekohteen-tila': null,
                keskilinjageometria: { coordinates: [[[0, 0, 0]]], type: 'MultiLinestring' },
                ominaisuudet: { 'pintauksen-tyyppi': 'pintauksen-tyyppi/pintaus01' }
            },
            {
                'sijainti-oid': 's13',
                sijaintitarkenne: { ajoradat: [''] },
                oid: '13',
                luotu: '2023-01-01T12:00:00Z',
                muokattu: '2023-02-01T12:00:00Z',
                'tiekohteen-tila': null,
                keskilinjageometria: { coordinates: [[[0, 0, 0]]], type: 'MultiLinestring' },
                ominaisuudet: { 'pintauksen-tyyppi': 'pintauksen-tyyppi/pintaus02' }
            }
        ];
        assetHandler.sourceByOid = { '12': 'pintaukset', '13': 'pintaukset' };
        const result = assetHandler.filterByPavementType(srcData);
        expect(result.map(r => r.oid)).toEqual(['12'])
        expect(result.map(r => assetHandler.pavementByOid[r.oid])).toEqual([
            PavementClass.OtherPavementClasses,
        ]);
    });

    test('if bound surface type material is something else than 1, the asset is ignored', () => {
        const srcData: VelhoPavementAsset[] = [
            {
                'sijainti-oid': 's14',
                sijaintitarkenne: { ajoradat: [''] },
                oid: '14',
                luotu: '2023-01-01T12:00:00Z',
                muokattu: '2023-02-01T12:00:00Z',
                'tiekohteen-tila': null,
                keskilinjageometria: { coordinates: [[[0, 0, 0]]], type: "MultiLinestring" },
                ominaisuudet: { tyyppi: 'sidotun-paallysrakenteen-tyyppi/spt02', 'paallysteen-tyyppi': 'paallystetyyppi/pt21' }
            },
            {
                'sijainti-oid': 's15',
                sijaintitarkenne: { ajoradat: [''] },
                oid: '15',
                luotu: '2023-01-01T12:00:00Z',
                muokattu: '2023-02-01T12:00:00Z',
                'tiekohteen-tila': null,
                keskilinjageometria: { coordinates: [[[0, 0, 0]]], type: "MultiLinestring" },
                ominaisuudet: { tyyppi: 'sidotun-paallysrakenteen-tyyppi/spt01', 'paallysteen-tyyppi': 'paallystetyyppi/pt21' }
            }
        ];
        assetHandler.sourceByOid = { '14': 'sidotut-paallysrakenteet', '15': 'sidotut-paallysrakenteet' };
        const result = assetHandler.filterByPavementType(srcData);
        expect(result.map(r => r.oid)).toEqual(['15'])
        expect(result.map(r => assetHandler.pavementByOid[r.oid])).toEqual([
            PavementClass.Unknown,
        ]);
    });

    test('materials not listed are ignored', () => {
        const srcData: VelhoPavementAsset[] = [
            {
                'sijainti-oid': 's16',
                sijaintitarkenne: { ajoradat: [''] },
                oid: '16',
                luotu: '2023-01-01T12:00:00Z',
                muokattu: '2023-02-01T12:00:00Z',
                'tiekohteen-tila': null,
                keskilinjageometria: { coordinates: [[[0, 0, 0]]], type: "MultiLinestring" },
                ominaisuudet: { tyyppi: 'sidotun-paallysrakenteen-tyyppi/spt01', 'paallysteen-tyyppi': 'paallystetyyppi/pt05' }
            },
            {
                'sijainti-oid': 's17',
                sijaintitarkenne: { ajoradat: [''] },
                oid: '17',
                luotu: '2023-01-01T12:00:00Z',
                muokattu: '2023-02-01T12:00:00Z',
                'tiekohteen-tila': null,
                keskilinjageometria: { coordinates: [[[0, 0, 0]]], type: "MultiLinestring" },
                ominaisuudet: { tyyppi: 'sidotun-paallysrakenteen-tyyppi/spt01', 'paallysteen-tyyppi': 'paallystetyyppi/pt06' }
            }
        ];
        assetHandler.sourceByOid = { '16': 'sidotut-paallysrakenteet', '17': 'sidotut-paallysrakenteet' };
        const result = assetHandler.filterByPavementType(srcData);
        expect(result.length === 0)
    });
});
