export type Point2D = { x: number; y: number };
export type Line2D = { type: "LINE"; layer: string; start: Point2D; end: Point2D };
export type Polyline2D = { type: "LWPOLYLINE"; layer: string; closed: boolean; points: Point2D[] };
export type DxfUnit = "mm" | "cm" | "m" | "unknown";
export type SiteBoundary = {
  layer: string;
  points: Point2D[];
  areaSquareMeters: number;
  perimeterMeters: number;
  sideLengthsMeters: number[];
  majorDimensionsMeters: { width: number; height: number };
};

export type DxfModel = {
  schemaVersion: "0.2";
  sourceUnit: DxfUnit;
  normalizedUnit: "mm";
  origin: Point2D;
  bounds: { min: Point2D; max: Point2D; width: number; height: number };
  layers: Array<{ name: string; entityCount: number }>;
  lines: Line2D[];
  polylines: Polyline2D[];
  stats: { entityCount: number; lineCount: number; polylineCount: number };
  boundary: SiteBoundary;
  previewSvg: string;
};

type Pair = [number, string];

export function parseDxf(source: string, options: { unit?: Exclude<DxfUnit, "unknown"> } = {}): DxfModel {
  if (!source.includes("SECTION") || !source.includes("ENTITIES") || !source.includes("EOF")) {
    throw new Error("DXF_INVALID_STRUCTURE");
  }
  const pairs = readPairs(source);
  const detectedUnit = readUnit(pairs);
  const sourceUnit = options.unit ?? detectedUnit;
  if (sourceUnit === "unknown") throw new Error("DXF_UNIT_REQUIRED");
  const scale = sourceUnit === "m" ? 1000 : sourceUnit === "cm" ? 10 : 1;
  const rawLines: Line2D[] = [];
  const rawPolylines: Polyline2D[] = [];
  let inEntities = false;

  for (let index = 0; index < pairs.length;) {
    const [code, value] = pairs[index];
    if (code === 0 && value === "SECTION" && pairs[index + 1]?.[1] === "ENTITIES") {
      inEntities = true;
      index += 2;
      continue;
    }
    if (inEntities && code === 0 && value === "ENDSEC") {
      inEntities = false;
      index += 1;
      continue;
    }
    if (!inEntities || code !== 0) {
      index += 1;
      continue;
    }

    if (value === "LINE") {
      const entity = collectEntity(pairs, index + 1);
      rawLines.push({
        type: "LINE",
        layer: findString(entity.pairs, 8) ?? "0",
        start: { x: findNumber(entity.pairs, 10) ?? 0, y: findNumber(entity.pairs, 20) ?? 0 },
        end: { x: findNumber(entity.pairs, 11) ?? 0, y: findNumber(entity.pairs, 21) ?? 0 },
      });
      index = entity.next;
      continue;
    }

    if (value === "LWPOLYLINE") {
      const entity = collectEntity(pairs, index + 1);
      const points: Point2D[] = [];
      let pendingX: number | null = null;
      for (const [pairCode, pairValue] of entity.pairs) {
        if (pairCode === 10) pendingX = finite(pairValue);
        if (pairCode === 20 && pendingX !== null) {
          points.push({ x: pendingX, y: finite(pairValue) });
          pendingX = null;
        }
      }
      rawPolylines.push({
        type: "LWPOLYLINE",
        layer: findString(entity.pairs, 8) ?? "0",
        closed: Boolean((findNumber(entity.pairs, 70) ?? 0) & 1),
        points,
      });
      index = entity.next;
      continue;
    }
    index += 1;
  }

  if (!rawLines.length && !rawPolylines.length) throw new Error("DXF_NO_SUPPORTED_ENTITIES");
  const allPoints = [
    ...rawLines.flatMap((line) => [line.start, line.end]),
    ...rawPolylines.flatMap((polyline) => polyline.points),
  ];
  const minX = Math.min(...allPoints.map((point) => point.x));
  const minY = Math.min(...allPoints.map((point) => point.y));
  const maxX = Math.max(...allPoints.map((point) => point.x));
  const maxY = Math.max(...allPoints.map((point) => point.y));
  const normalize = (point: Point2D): Point2D => ({
    x: round((point.x - minX) * scale),
    y: round((point.y - minY) * scale),
  });
  const lines = rawLines.map((line) => ({ ...line, start: normalize(line.start), end: normalize(line.end) }));
  const polylines = rawPolylines.map((polyline) => ({ ...polyline, points: polyline.points.map(normalize) }));
  const closed = polylines.filter((polyline) => polyline.closed && polyline.points.length >= 3);
  const namedBoundaries = closed.filter((polyline) => polyline.layer.toUpperCase() === "SITE_BOUNDARY");
  const candidates = namedBoundaries.length ? namedBoundaries : closed;
  if (!candidates.length) throw new Error("DXF_BOUNDARY_NOT_CLOSED");
  if (candidates.length > 1) throw new Error("DXF_MULTIPLE_BOUNDARIES");
  const boundaryPolyline = candidates[0];
  const areaMm2 = polygonArea(boundaryPolyline.points);
  const sideLengthsMm = polygonSideLengths(boundaryPolyline.points);
  const perimeterMm = sideLengthsMm.reduce((sum, length) => sum + length, 0);
  const boundaryBounds = getBounds(boundaryPolyline.points);
  if (areaMm2 < 4_000_000 || areaMm2 > 1_000_000_000_000 || sideLengthsMm.some((length) => length < 500 || length > 500_000)) {
    throw new Error("DXF_SCALE_OUT_OF_RANGE");
  }
  const boundary: SiteBoundary = {
    layer: boundaryPolyline.layer,
    points: boundaryPolyline.points,
    areaSquareMeters: round(areaMm2 / 1_000_000),
    perimeterMeters: round(perimeterMm / 1000),
    sideLengthsMeters: sideLengthsMm.map((length) => round(length / 1000)),
    majorDimensionsMeters: {
      width: round(boundaryBounds.width / 1000),
      height: round(boundaryBounds.height / 1000),
    },
  };
  const layerMap = new Map<string, number>();
  for (const entity of [...lines, ...polylines]) {
    layerMap.set(entity.layer, (layerMap.get(entity.layer) ?? 0) + 1);
  }

  return {
    schemaVersion: "0.2",
    sourceUnit,
    normalizedUnit: "mm",
    origin: { x: minX, y: minY },
    bounds: {
      min: { x: 0, y: 0 },
      max: { x: round((maxX - minX) * scale), y: round((maxY - minY) * scale) },
      width: round((maxX - minX) * scale),
      height: round((maxY - minY) * scale),
    },
    layers: [...layerMap].map(([name, entityCount]) => ({ name, entityCount })),
    lines,
    polylines,
    stats: {
      entityCount: lines.length + polylines.length,
      lineCount: lines.length,
      polylineCount: polylines.length,
    },
    boundary,
    previewSvg: renderBoundarySvg(boundary),
  };
}

function readPairs(source: string): Pair[] {
  const lines = source.replace(/^\uFEFF/, "").split(/\r?\n/);
  if (lines.at(-1) === "") lines.pop();
  if (lines.length % 2 !== 0) throw new Error("DXF_GROUP_PAIR_MISMATCH");
  const pairs: Pair[] = [];
  for (let index = 0; index < lines.length; index += 2) {
    const code = Number.parseInt(lines[index].trim(), 10);
    if (!Number.isFinite(code)) throw new Error("DXF_INVALID_GROUP_CODE");
    pairs.push([code, lines[index + 1].trim()]);
  }
  return pairs;
}

function readUnit(pairs: Pair[]): DxfUnit {
  const index = pairs.findIndex(([code, value]) => code === 9 && value === "$INSUNITS");
  const unit = index >= 0 ? Number.parseInt(pairs[index + 1]?.[1] ?? "", 10) : 0;
  return unit === 4 ? "mm" : unit === 5 ? "cm" : unit === 6 ? "m" : "unknown";
}

function getBounds(points: Point2D[]) {
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const maxX = Math.max(...xs);
  const maxY = Math.max(...ys);
  return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
}

function polygonArea(points: Point2D[]): number {
  return Math.abs(points.reduce((sum, point, index) => {
    const next = points[(index + 1) % points.length];
    return sum + point.x * next.y - next.x * point.y;
  }, 0) / 2);
}

function polygonSideLengths(points: Point2D[]): number[] {
  return points.map((point, index) => {
    const next = points[(index + 1) % points.length];
    return Math.hypot(next.x - point.x, next.y - point.y);
  });
}

function renderBoundarySvg(boundary: SiteBoundary): string {
  const box = getBounds(boundary.points);
  const padding = Math.max(box.width, box.height) * 0.12 || 1;
  const viewWidth = box.width + padding * 2;
  const viewHeight = box.height + padding * 2;
  const points = boundary.points.map((point) => `${round(point.x - box.minX + padding)},${round(box.maxY - point.y + padding)}`).join(" ");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${round(viewWidth)} ${round(viewHeight)}" role="img" aria-label="场地边界预览"><rect width="100%" height="100%" fill="#f5f1e8"/><polygon points="${points}" fill="#d8e4d2" stroke="#153b32" stroke-width="${round(Math.max(viewWidth, viewHeight) / 180)}"/><text x="${round(padding)}" y="${round(padding * 0.75)}" fill="#9e5435" font-size="${round(Math.max(viewWidth, viewHeight) / 28)}" font-family="Arial">N ↑</text></svg>`;
}

function collectEntity(pairs: Pair[], start: number): { pairs: Pair[]; next: number } {
  let next = start;
  while (next < pairs.length && pairs[next][0] !== 0) next += 1;
  return { pairs: pairs.slice(start, next), next };
}

function findString(pairs: Pair[], code: number): string | null {
  return pairs.find(([pairCode]) => pairCode === code)?.[1] ?? null;
}

function findNumber(pairs: Pair[], code: number): number | null {
  const value = findString(pairs, code);
  return value === null ? null : finite(value);
}

function finite(value: string): number {
  const number = Number.parseFloat(value);
  if (!Number.isFinite(number)) throw new Error("DXF_INVALID_COORDINATE");
  return number;
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}
