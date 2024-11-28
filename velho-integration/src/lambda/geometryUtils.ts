import {LineString, Point} from 'wkx';
import {SideCode} from "./enumerations";

const DefaultEpsilon = 1e-9;

export function calculateBearing(geom: LineString, pointMValue: number): number {
    const points = geom.points;
    if (points.length < 2) throw new Error("Geometry must have at least 2 points");

    const roadLength = geometryLength(points);
    const startM = Math.max(pointMValue - 5, 0);
    const endM = Math.min(pointMValue + 5, roadLength);

    const startPoint = calculatePointFromMeasure(points, startM) || points[0];
    const endPoint = calculatePointFromMeasure(points, endM) || points[points.length - 1];

    const rad = Math.atan2(startPoint.x - endPoint.x, startPoint.y - endPoint.y);
    return Math.round(180 + rad * (180 / Math.PI));
}

export function getSideCodeByGeometry(assetLocation: Point, roadLinkPoint: Point, linkBearing: number): number {
    const latDifference = assetLocation.y - roadLinkPoint.y;

    const isTowardsDigitizing =
        (latDifference <= 0 && linkBearing <= 90) || (latDifference >= 0 && linkBearing > 270);

    if(isTowardsDigitizing) return SideCode.TowardsDigitizing;
    else return SideCode.AgainstDigitizing;
}


function calculatePointFromMeasure(points: Point[], measure: number): Point | null {
    let remaining = measure;

    for (let i = 1; i < points.length; i++) {
        const segmentLength = distance(points[i - 1], points[i]);
        if (remaining <= segmentLength + DefaultEpsilon) {
            return interpolate(points[i - 1], points[i], remaining / segmentLength);
        }
        remaining -= segmentLength;
    }
    return null;
}

function geometryLength(points: Point[]): number {
    return points.reduce((length, point, i) =>
        i > 0 ? length + distance(points[i - 1], point) : length, 0);
}

function distance(p1: Point, p2: Point): number {
    return Math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2);
}

function interpolate(p1: Point, p2: Point, ratio: number): Point {
    return new Point(
        p1.x + (p2.x - p1.x) * ratio,
        p1.y + (p2.y - p1.y) * ratio
    );
}
