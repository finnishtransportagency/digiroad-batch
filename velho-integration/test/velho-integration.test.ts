import { VelhoAsset } from '../src/lambda/assetHandler';
import { PointAssetHandler } from '../src/lambda/pointAssetHandler';
import { DbAsset } from '../src/lambda/assetHandler';

const srcData: VelhoAsset[] = [
    {
      sijainti: {
        osa: 1,
        tie: 100,
        etaisyys: 500
      },
      keskilinjageometria: {
        coordinates: [0, 0, 0],
        type: "Point"
      },
      'sijainti-oid': '1',
      sijaintitarkenne: {
        ajoradat: ['']
      },
      oid: 'oid1',
      luotu: '2023-01-01T12:00:00Z',
      muokattu: '2023-02-01T12:00:00Z',
      'tiekohteen-tila': 'tiekohteen-tila/tt03'
    },
    {
      sijainti: {
        osa: 2,
        tie: 101,
        etaisyys: 600
      },
      keskilinjageometria: {
        coordinates: [0, 0, 0],
        type: "Point"
      },
      'sijainti-oid': '2',
      sijaintitarkenne: {
        ajoradat: ['']
      },
      oid: 'oid2',
      luotu: '2023-03-01T12:00:00Z',
      muokattu: '2023-04-01T12:00:00Z',
      'tiekohteen-tila': null
    },
    {
      sijainti: {
        osa: 3,
        tie: 102,
        etaisyys: 700
      },
      keskilinjageometria: {
        coordinates: [0, 0, 0],
        type: "Point"
      },
      'sijainti-oid': '3',
      sijaintitarkenne: {
        ajoradat: ['']
      },
      oid: 'oid3',
      luotu: '2023-05-01T12:00:00Z',
      muokattu: '2023-06-01T12:00:00Z',
      'tiekohteen-tila': 'tiekohteen-tila/tt02'
    }
  ];
  
  const currentData: DbAsset[] = [
    {
      externalId: 'oid1',
      createdBy: 'test',
      createdDate: new Date('2022-12-01T12:00:00Z'),
      modifiedBy: 'test',
      modifiedDate: new Date('2023-01-15T12:00:00Z'),
      linkid: 'link_id:1',
      startMeasure: 0,
      endMeasure: 500,
      municipalitycode: 123
    },
    {
      externalId: 'oid3',
      createdBy: 'test',
      createdDate: new Date('2022-11-01T12:00:00Z'),
      modifiedBy: 'test',
      modifiedDate: new Date('2023-03-01T12:00:00Z'),
      linkid: 'link_id:2',
      startMeasure: 100,
      endMeasure: 600,
      municipalitycode: 123
    },
    {
      externalId: 'oid4',
      createdBy: 'test',
      createdDate: new Date('2022-10-01T12:00:00Z'),
      modifiedBy: null,
      modifiedDate: null,
      linkid: 'link_id:3',
      startMeasure: 200,
      endMeasure: 700,
      municipalitycode: 123
    }
  ];

const assetHandler = new PointAssetHandler  

test('calculateDiff sorts as added only assets with valid tiekohteen-tila', () => {
  const result = assetHandler.calculateDiff(srcData, []);
  expect(result.added.map(r => r.oid)).toEqual(['oid1', 'oid2']);
});

test('calculateDiff sorts as added only assets not present in db', () => {
  const result = assetHandler.calculateDiff(srcData, currentData);
  expect(result.added.map(r => r.oid)).toEqual(['oid2']);  
})

