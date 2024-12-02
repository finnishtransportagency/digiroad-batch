import {LinearAsset, LinearAssetHandler} from "../src/lambda/linearAssetHandler";
import {DRValue, RoadLink} from "../src/lambda/type/type";

const assetHandler = new LinearAssetHandler();
function createRoadLink(options: Partial<RoadLink> = {}): RoadLink {
    return <RoadLink>{
        linkId: options.linkId ?? `link-${Math.floor(Math.random() * 1000)}`, // Default random linkId
        sideCode: options.sideCode ?? 1, // Default side code
        geometryLength: options.geometryLength ?? 100, // Default geometry length
        shape: options.shape ?? {coordinates: [[0, 0], [1, 1]]} // Default shape
    };
}
describe('Test logic homogenous part to continuous LRM', () => {
    test('should join assets into one LinearAsset correctly, simple case', () => {

        const expectedJoinedAsset3: LinearAsset[] = [
            {
                externalIds: ['7'], 
                LRM: { linkId:"1",mValue: 0, mValueEnd: 40 }, 
                digiroadValue: {value:"finalValue"} as DRValue
            },
            {
                externalIds: ['8'],
                LRM: {linkId:"1", mValue: 40, mValueEnd: 80 },
                digiroadValue: {value:"finalValue"} as DRValue
            }
        ];
        const result: LinearAsset  = assetHandler.merge(expectedJoinedAsset3[1],expectedJoinedAsset3[0] ) as LinearAsset;

        expect(result.externalIds).toStrictEqual(['7','8'])
        expect(result.LRM.mValue).toBe(0)
        expect(result.LRM.mValueEnd).toBe(80)
        expect(result.digiroadValue?.value).toBe("finalValue")
        
        console.log('Asset joining assertion passed successfully!');
    });


    test('should join assets into one LinearAsset correctly, three part', () => {

        const expectedJoinedAsset3: LinearAsset[] = [
            {
                externalIds: ['1'],
                LRM: {
                    linkId: 'link1',                municipalityCode: 123,
                    mValue: 0,                mValueEnd: 30
                },
                digiroadValue: {value:"finalValue"} as DRValue
            },
            {
                externalIds: ['2'],
                LRM: {
                    linkId: 'link1',                municipalityCode: 123,
                    mValue: 30,                mValueEnd: 60
                },
                digiroadValue: {value:"finalValue"} as DRValue
            },
            {
                externalIds: ['3'],
                LRM: {
                    linkId: 'link1',                municipalityCode: 123,
                    mValue: 60,                mValueEnd: 90
                },
                digiroadValue: {value:"finalValue"} as DRValue
            }
        ];

        const result  = assetHandler.handleLink(expectedJoinedAsset3,createRoadLink({linkId:'1',geometryLength:90})).sort((a, b) => { return a.LRM.mValue - b.LRM.mValue});
        expect(result.length).toBe(1)
        expect(result[0].externalIds).toStrictEqual(['1','2','3'])
        expect(result[0].LRM.mValue).toBe(0)
        expect(result[0].LRM.mValueEnd).toBe(90)
        expect(result[0].digiroadValue?.value).toBe("finalValue")
        console.log('Asset joining assertion passed successfully!');
    });


    test('should join assets into one LinearAsset correctly, four part', () => {

        const expectedJoinedAsset3: LinearAsset[] = [
            {
                externalIds: ['9'],
                LRM: {
                    linkId: 'link4',            municipalityCode: 126,
                    mValue: 0,            mValueEnd: 30
                },
                digiroadValue: {value:"finalValue"} as DRValue
            },
            {
                externalIds: ['10'],
                LRM: {
                    linkId: 'link4',            municipalityCode: 126,
                    mValue: 30,                mValueEnd: 70
                },
                digiroadValue: {value:"finalValue"} as DRValue
            },
            {
                externalIds: ['11'],
                LRM: {
                    linkId: 'link4',            municipalityCode: 126,
                    mValue: 70,            mValueEnd: 100
                },
                digiroadValue: {value:"finalValue"} as DRValue
            }
        ];
        const result  = assetHandler.handleLink(expectedJoinedAsset3,createRoadLink({linkId:'link4',geometryLength:100})).sort((a, b) => { return a.LRM.mValue - b.LRM.mValue});
        expect(result.length).toBe(1)
        expect(result[0].externalIds).toStrictEqual(['9','10','11'])
        expect(result[0].LRM.mValue).toBe(0)
        expect(result[0].LRM.mValueEnd).toBe(100)
        expect(result[0].digiroadValue?.value).toBe("finalValue")
        console.log('Asset joining assertion passed successfully!');
    });

    test('Small gap between part', () => {

        const expectedJoinedAsset3: LinearAsset[] = [
            {
                externalIds: ['7'],
                LRM: {
                    linkId: 'link3',            municipalityCode: 125,
                    mValue: 0,            mValueEnd: 40
                },
                digiroadValue: {value:"finalValue"} as DRValue
            },
            {
                externalIds: ['8'],
                LRM: {
                    linkId: 'link3',            municipalityCode: 125,
                    mValue: 50,            mValueEnd: 80
                },
                digiroadValue: {value:"finalValue"} as DRValue
            }
        ];
        const result  = assetHandler.handleLink(expectedJoinedAsset3,createRoadLink({linkId:'link3',geometryLength:80}))
            .sort((a, b) => { return a.LRM.mValue - b.LRM.mValue});
        expect(result.length).toBe(2)
       
        expect(result[0].externalIds).toStrictEqual(['7'])
        expect(result[0].LRM.mValue).toBe(0)
        expect(result[0].LRM.mValueEnd).toBe(40)
        expect(result[0].digiroadValue?.value).toBe("finalValue")

        expect(result[1].externalIds).toStrictEqual(['8'])
        expect(result[1].LRM.mValue).toBe(50)
        expect(result[1].LRM.mValueEnd).toBe(80)
        expect(result[1].digiroadValue?.value).toBe("finalValue")
        console.log('Asset joining assertion passed successfully!');
    });

    test('Join similar part, assets are out of order and two different values', () => {

        const expectedJoinedAsset3: LinearAsset[] = [
            {
                externalIds: ['5'],
                LRM: {
                    linkId: 'link2',            municipalityCode: 124,
                    mValue: 25,            mValueEnd: 55
                },
                digiroadValue: {value:"finalValue2"} as DRValue
            },
            {
                externalIds: ['6'],
                LRM: {
                    linkId: 'link2',            municipalityCode: 124,
                    mValue: 55,            mValueEnd: 80
                },
                digiroadValue: {value:"finalValue2"} as DRValue
            },
            {
                externalIds: ['3'],
                LRM: {
                    linkId: 'link2',            municipalityCode: 124,
                    mValue: 0,            mValueEnd: 20
                },
                digiroadValue: {value:"finalValue"} as DRValue
            },
            {
                externalIds: ['4'],
                LRM: {
                    linkId: 'link2',            municipalityCode: 124,
                    mValue: 20,            mValueEnd: 25
                },
                digiroadValue: {value:"finalValue"} as DRValue
            },
        ];

        const result  = assetHandler.handleLink(expectedJoinedAsset3,createRoadLink({linkId:'link2',geometryLength:80}))
            .sort((a, b) => { return a.LRM.mValue - b.LRM.mValue});
        expect(result.length).toBe(2)
        
        expect(result[0].externalIds).toStrictEqual(['3','4'])
        expect(result[0].LRM.mValue).toBe(0)
        expect(result[0].LRM.mValueEnd).toBe(25)
        expect(result[0].digiroadValue?.value).toBe("finalValue")

        expect(result[1].externalIds).toStrictEqual(['5','6'])
        expect(result[1].LRM.mValue).toBe(25)
        expect(result[1].LRM.mValueEnd).toBe(80)
        expect(result[1].digiroadValue?.value).toBe("finalValue2")
        console.log('Asset joining assertion passed successfully!');
    });
})

