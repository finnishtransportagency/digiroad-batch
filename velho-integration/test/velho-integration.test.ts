import {VelhoPointAsset} from "../src/lambda/type/velhoAsset";
import {DbAsset} from "../src/lambda/type/type";
import {PointAssetHandler} from "../src/lambda/pointAssetHandler";


const srcData: VelhoPointAsset[] = [
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
  },
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
    'sijainti-oid': '5',
    sijaintitarkenne: {
      ajoradat: ['']
    },
    oid: 'oid5',
    luotu: '2023-01-01T12:00:00Z',
    muokattu: '2023-02-01T12:00:00Z',
    'tiekohteen-tila': 'tiekohteen-tila/tt03'
  },
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
    'sijainti-oid': '6',
    sijaintitarkenne: {
      ajoradat: ['']
    },
    oid: 'oid6',
    luotu: '2023-01-01T12:00:00Z',
    muokattu: '2023-02-01T12:00:00Z',
    'tiekohteen-tila': 'tiekohteen-tila/tt03'
  },
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
    'sijainti-oid': '7',
    sijaintitarkenne: {
      ajoradat: ['']
    },
    oid: 'oid7',
    luotu: '2023-01-01T12:00:00Z',
    muokattu: '2023-02-01T12:00:00Z',
    'tiekohteen-tila': 'tiekohteen-tila/tt03'
  },
];

const currentData: DbAsset[] = [
  {
    id: 1,
    externalId: 'oid1',
    createdBy: 'test',
    createdDate: new Date('2022-12-01T12:00:00Z'),
    modifiedBy: null,
    modifiedDate: null,
    linkid: 'link_id:1',
    startMeasure: 0,
    endMeasure: 500,
    municipalitycode: 123
  },
  {
    id: 3,
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
    id: 4,
    externalId: 'oid4',
    createdBy: 'test',
    createdDate: new Date('2022-10-01T12:00:00Z'),
    modifiedBy: null,
    modifiedDate: null,
    linkid: 'link_id:3',
    startMeasure: 200,
    endMeasure: 700,
    municipalitycode: 123
  },
  {
    id: 5,
    externalId: 'oid5',
    createdBy: 'test',
    createdDate: new Date('2023-01-03T12:00:00Z'),
    modifiedBy: 'test',
    modifiedDate: new Date('2023-01-15T12:00:00Z'),
    linkid: 'link_id:1',
    startMeasure: 0,
    endMeasure: 500,
    municipalitycode: 123
  },
  {
    id: 6,
    externalId: 'oid6',
    createdBy: 'test',
    createdDate: new Date('2024-01-03T12:00:00Z'),
    modifiedBy: null,
    modifiedDate: null,
    linkid: 'link_id:1',
    startMeasure: 0,
    endMeasure: 500,
    municipalitycode: 123
  }, {
    id: 7,
    externalId: 'oid7',
    createdBy: 'test',
    createdDate: new Date('2023-01-03T12:00:00Z'),
    modifiedBy: 'test',
    modifiedDate: new Date('2024-02-15T12:00:00Z'),
    linkid: 'link_id:1',
    startMeasure: 0,
    endMeasure: 500,
    municipalitycode: 123
  },
];

const assetHandler = new PointAssetHandler

test('calculateDiff sorts as added only assets with valid tiekohteen-tila, no previous assets in db', () => {
  const filteredSrc = assetHandler.filterUnnecessary(srcData)
  const result = assetHandler.calculateDiff(filteredSrc, []);
  expect(result.added.map(r => r.oid)).toEqual(['oid1', 'oid2', 'oid5', 'oid6', 'oid7']);
});

test('calculateDiff sorts as added only assets not present in db', () => {
  const filteredSrc = assetHandler.filterUnnecessary(srcData)
  const result = assetHandler.calculateDiff(filteredSrc, currentData);
  expect(result.added.map(r => r.oid)).toEqual(['oid2']);
});

test('calculateDiff sorts as expired if an asset is not in srcData or has invalid tiekohteen-tila', () => {
  const filteredSrc = assetHandler.filterUnnecessary(srcData)
  const result = assetHandler.calculateDiff(filteredSrc, currentData);
  expect(result.expired.map(r => r.externalId)).toEqual(['oid3', 'oid4']);
});

test('calculateDiff sorts as updated if a src asset has a later modified date than created or modified date of a db asset', () => {
  const filteredSrc = assetHandler.filterUnnecessary(srcData)
  const result = assetHandler.calculateDiff(filteredSrc, currentData);
  expect(result.updated.map(r => r.oid)).toEqual(['oid1', 'oid5']);
});

test('calculateDiff sorts as notTouched if a db asset has a later created modified date than the modified date of a src asset', () => {
  const filteredSrc = assetHandler.filterUnnecessary(srcData)
  const result = assetHandler.calculateDiff(filteredSrc, currentData);
  expect(result.notTouched.map(r => r.externalId)).toEqual(['oid6', 'oid7']);
});

