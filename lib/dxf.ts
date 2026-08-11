export type Point2D = { x: number; y: number };
export type Line2D = { type: "LINE"; layer: string; start: Point2D; end: Point2D };
export type Polyline2D = { type: "LWPOLYLINE" | "POLYLINE"; layer: string; closed: boolean; points: Point2D[] };
export type DxfUnit = "mm" | "cm" | "m" | "unknown";
export type CardinalSide = "north" | "east" | "south" | "west";
export type SiteBoundary = {
  layer: string;
  points: Point2D[];
  areaSquareMeters: number;
  perimeterMeters: number;
  sideLengthsMeters: number[];
  majorDimensionsMeters: { width: number; height: number };
};

export type DxfModel = {
  schemaVersion: "0.3";
  sourceUnit: DxfUnit;
  normalizedUnit: "mm";
  origin: Point2D;
  bounds: { min: Point2D; max: Point2D; width: number; height: number };
  layers: Array<{ name: string; entityCount: number }>;
  lines: Line2D[];
  polylines: Polyline2D[];
  stats: { entityCount: number; lineCount: number; polylineCount: number };
  boundary: SiteBoundary;
  siteAnalysis: {
    roadSides: CardinalSide[];
    roadWidthMeters: number | null;
    entranceSide: CardinalSide | null;
    entranceWidthMeters: number | null;
    entranceSegment: { start: Point2D; end: Point2D } | null;
    northAngleDegrees: number | null;
    northToleranceDegrees: 2;
    northWithinTolerance: boolean;
  };
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
    if (value === "POLYLINE") {
      const entity = collectLegacyPolyline(pairs, index);
      rawPolylines.push(entity.polyline);
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
  const siteAnalysis = analyzeSite(lines, polylines, boundary);
  const layerMap = new Map<string, number>();
  for (const entity of [...lines, ...polylines]) {
    layerMap.set(entity.layer, (layerMap.get(entity.layer) ?? 0) + 1);
  }

  return {
    schemaVersion: "0.3",
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
    siteAnalysis,
    previewSvg: renderBoundarySvg(boundary, siteAnalysis, lines, polylines),
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

function renderBoundarySvg(boundary: SiteBoundary, analysis: DxfModel["siteAnalysis"], lines: Line2D[], polylines: Polyline2D[]): string {
  const roads = polylines.filter((item) => item.layer.toUpperCase() === "ROAD");
  const entranceLines = lines.filter((item) => item.layer.toUpperCase() === "ENTRANCE");
  const entrancePolylines = polylines.filter((item) => item.layer.toUpperCase() === "ENTRANCE");
  const northLines = lines.filter((item) => item.layer.toUpperCase() === "NORTH");
  const northPolylines = polylines.filter((item) => item.layer.toUpperCase() === "NORTH");
  const featurePoints = [
    ...boundary.points,
    ...roads.flatMap((item) => item.points),
    ...entranceLines.flatMap((item) => [item.start, item.end]),
    ...entrancePolylines.flatMap((item) => item.points),
    ...northLines.flatMap((item) => [item.start, item.end]),
    ...northPolylines.flatMap((item) => item.points),
  ];
  const content = getBounds(featurePoints);
  const boundaryBox = getBounds(boundary.points);
  const padding = Math.max(content.width, content.height) * 0.08 || 1;
  const dimensionSpace = Math.max(boundaryBox.width, boundaryBox.height) * 0.1;
  const minX = Math.min(content.minX, boundaryBox.minX - dimensionSpace) - padding;
  const minY = Math.min(content.minY, boundaryBox.minY - dimensionSpace) - padding;
  const maxX = Math.max(content.maxX, boundaryBox.maxX + dimensionSpace) + padding;
  const maxY = Math.max(content.maxY, boundaryBox.maxY + dimensionSpace) + padding;
  const viewWidth = maxX - minX;
  const viewHeight = maxY - minY;
  const stroke = Math.max(viewWidth, viewHeight) / 220;
  const font = Math.max(viewWidth, viewHeight) / 34;
  const map = (point: Point2D) => ({ x: round(point.x - minX), y: round(maxY - point.y) });
  const points = (items: Point2D[]) => items.map((point) => { const value = map(point); return `${value.x},${value.y}`; }).join(" ");
  const line = (item: Line2D, color: string, width = stroke) => { const start = map(item.start); const end = map(item.end); return `<line x1="${start.x}" y1="${start.y}" x2="${end.x}" y2="${end.y}" stroke="${color}" stroke-width="${round(width)}" stroke-linecap="round"/>`; };
  const roadShapes = roads.map((item) => `<polygon points="${points(item.points)}" fill="#c98962" fill-opacity=".78" stroke="#9e5435" stroke-width="${round(stroke)}"/>`).join("");
  const boundaryShape = `<polygon points="${points(boundary.points)}" fill="#d8e4d2" fill-opacity=".88" stroke="#153b32" stroke-width="${round(stroke * 1.35)}"/>`;
  const entranceShapes = [
    ...entranceLines.map((item) => line(item, "#bb6e48", stroke * 1.5)),
    ...entrancePolylines.map((item) => `<polyline points="${points(item.points)}" fill="${item.closed ? "#bb6e48" : "none"}" stroke="#9e5435" stroke-width="${round(stroke)}"/>`),
  ].join("");
  const northShapes = [
    ...northLines.map((item) => line(item, "#153b32", stroke * 1.3)),
    ...northPolylines.map((item) => `<polyline points="${points(item.points)}" fill="${item.closed ? "#153b32" : "none"}" stroke="#153b32" stroke-width="${round(stroke)}"/>`),
  ].join("");
  const entranceGap = analysis.entranceSegment ? renderEntranceGap(analysis.entranceSegment, analysis.entranceSide, map, stroke) : "";
  const topLeft = map({ x: boundaryBox.minX, y: boundaryBox.maxY });
  const topRight = map({ x: boundaryBox.maxX, y: boundaryBox.maxY });
  const bottomRight = map({ x: boundaryBox.maxX, y: boundaryBox.minY });
  const dimensionOffset = dimensionSpace * 0.45;
  const widthY = round(topLeft.y - dimensionOffset);
  const heightX = round(topRight.x + dimensionOffset);
  const dimensions = `<g stroke="#567069" fill="#153b32" stroke-width="${round(stroke * .55)}" font-family="Arial, sans-serif" font-size="${round(font * .72)}"><line x1="${topLeft.x}" y1="${widthY}" x2="${topRight.x}" y2="${widthY}"/><line x1="${topLeft.x}" y1="${round(widthY - font * .3)}" x2="${topLeft.x}" y2="${round(widthY + font * .3)}"/><line x1="${topRight.x}" y1="${round(widthY - font * .3)}" x2="${topRight.x}" y2="${round(widthY + font * .3)}"/><text x="${round((topLeft.x + topRight.x) / 2)}" y="${round(widthY - font * .35)}" text-anchor="middle" stroke="none">${boundary.majorDimensionsMeters.width} m</text><line x1="${heightX}" y1="${topRight.y}" x2="${heightX}" y2="${bottomRight.y}"/><line x1="${round(heightX - font * .3)}" y1="${topRight.y}" x2="${round(heightX + font * .3)}" y2="${topRight.y}"/><line x1="${round(heightX - font * .3)}" y1="${bottomRight.y}" x2="${round(heightX + font * .3)}" y2="${bottomRight.y}"/><text x="${round(heightX + font * .65)}" y="${round((topRight.y + bottomRight.y) / 2)}" transform="rotate(90 ${round(heightX + font * .65)} ${round((topRight.y + bottomRight.y) / 2)})" text-anchor="middle" stroke="none">${boundary.majorDimensionsMeters.height} m</text></g>`;
  const roadLabel = roads[0] ? labelAtCenter(roads[0].points, `${sideLabel(analysis.roadSides[0])}侧道路 ${analysis.roadWidthMeters ?? "?"} m`, map, font, "#fffdf8") : "";
  const entranceLabel = analysis.entranceSegment ? labelAtCenter([analysis.entranceSegment.start, analysis.entranceSegment.end], `入口 ${analysis.entranceWidthMeters ?? "?"} m`, map, font * .72, "#9e5435", -font * .7) : "";
  const northTip = northLines[0]?.end;
  const northLabel = northTip ? labelAtCenter([northTip], `N ${analysis.northAngleDegrees ?? "?"}°`, map, font, "#153b32", -font * .55) : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${round(viewWidth)} ${round(viewHeight)}" role="img" aria-label="场地边界、临路、入口、北向和尺寸预览"><rect width="100%" height="100%" fill="#f5f1e8"/>${roadShapes}${roadLabel}${boundaryShape}${entranceGap}${entranceShapes}${entranceLabel}${northShapes}${northLabel}${dimensions}</svg>`;
}

function renderEntranceGap(segment: { start: Point2D; end: Point2D }, side: CardinalSide | null, map: (point: Point2D) => Point2D, stroke: number): string {
  const start = map(segment.start);
  const end = map(segment.end);
  const horizontal = side === "south" || side === "north";
  const tick = stroke * 5;
  const ticks = horizontal
    ? `<line x1="${start.x}" y1="${round(start.y - tick)}" x2="${start.x}" y2="${round(start.y + tick)}"/><line x1="${end.x}" y1="${round(end.y - tick)}" x2="${end.x}" y2="${round(end.y + tick)}"/>`
    : `<line x1="${round(start.x - tick)}" y1="${start.y}" x2="${round(start.x + tick)}" y2="${start.y}"/><line x1="${round(end.x - tick)}" y1="${end.y}" x2="${round(end.x + tick)}" y2="${end.y}"/>`;
  return `<g stroke="#bb6e48" stroke-width="${round(stroke * 2.5)}"><line x1="${start.x}" y1="${start.y}" x2="${end.x}" y2="${end.y}" stroke="#fffdf8" stroke-width="${round(stroke * 3.6)}"/>${ticks}</g>`;
}

function labelAtCenter(items: Point2D[], text: string, map: (point: Point2D) => Point2D, font: number, color: string, offsetY = 0): string {
  const center = items.reduce((sum, item) => ({ x: sum.x + item.x / items.length, y: sum.y + item.y / items.length }), { x: 0, y: 0 });
  const point = map(center);
  return `<text x="${point.x}" y="${round(point.y + offsetY)}" text-anchor="middle" dominant-baseline="middle" fill="${color}" font-size="${round(font)}" font-family="Arial, sans-serif" font-weight="700">${text}</text>`;
}

function sideLabel(side: CardinalSide | undefined): string {
  return side === "north" ? "北" : side === "east" ? "东" : side === "west" ? "西" : "南";
}

function collectLegacyPolyline(pairs: Pair[], start: number): { polyline: Polyline2D; next: number } {
  const header = collectEntity(pairs, start + 1);
  const points: Point2D[] = [];
  let next = header.next;
  while (next < pairs.length && pairs[next][0] === 0 && pairs[next][1] === "VERTEX") {
    const vertex = collectEntity(pairs, next + 1);
    const x = findNumber(vertex.pairs, 10);
    const y = findNumber(vertex.pairs, 20);
    if (x !== null && y !== null) points.push({ x, y });
    next = vertex.next;
  }
  if (next < pairs.length && pairs[next][0] === 0 && pairs[next][1] === "SEQEND") {
    next = collectEntity(pairs, next + 1).next;
  }
  return {
    polyline: {
      type: "POLYLINE",
      layer: findString(header.pairs, 8) ?? "0",
      closed: Boolean((findNumber(header.pairs, 70) ?? 0) & 1),
      points,
    },
    next,
  };
}

function analyzeSite(lines: Line2D[], polylines: Polyline2D[], boundary: SiteBoundary): DxfModel["siteAnalysis"] {
  const boundaryBox = getBounds(boundary.points);
  const roads = polylines.filter((polyline) => polyline.layer.toUpperCase() === "ROAD" && polyline.points.length >= 3);
  const roadPairs = roads.map((road) => {
    const box = getBounds(road.points);
    const side = nearestSide(box, boundaryBox);
    const width = side === "north" || side === "south" ? box.height : box.width;
    return { side, width };
  });
  const roadSides = [...new Set(roadPairs.map((item) => item.side))];
  const roadWidthMm = roadPairs.length ? Math.min(...roadPairs.map((item) => item.width)) : null;

  const entranceLines = lines.filter((line) => line.layer.toUpperCase() === "ENTRANCE");
  let entranceSide: CardinalSide | null = null;
  let entranceWidthMm: number | null = null;
  let entranceSegment: { start: Point2D; end: Point2D } | null = null;
  for (const side of ["south", "north", "west", "east"] as CardinalSide[]) {
    const positions = entranceLines
      .filter((line) => touchesBoundarySide(line, boundaryBox, side))
      .map((line) => side === "south" || side === "north" ? (line.start.x + line.end.x) / 2 : (line.start.y + line.end.y) / 2)
      .sort((a, b) => a - b);
    if (positions.length >= 2) {
      entranceSide = side;
      entranceWidthMm = positions.at(-1)! - positions[0];
      const fixed = side === "south" ? boundaryBox.minY : side === "north" ? boundaryBox.maxY : side === "west" ? boundaryBox.minX : boundaryBox.maxX;
      entranceSegment = side === "south" || side === "north"
        ? { start: { x: positions[0], y: fixed }, end: { x: positions.at(-1)!, y: fixed } }
        : { start: { x: fixed, y: positions[0] }, end: { x: fixed, y: positions.at(-1)! } };
      break;
    }
  }

  const northLine = lines
    .filter((line) => line.layer.toUpperCase() === "NORTH")
    .sort((a, b) => lineLength(b) - lineLength(a))[0];
  const northAngleDegrees = northLine
    ? round(normalizeAngle(Math.atan2(northLine.end.x - northLine.start.x, northLine.end.y - northLine.start.y) * 180 / Math.PI))
    : null;
  return {
    roadSides,
    roadWidthMeters: roadWidthMm === null ? null : round(roadWidthMm / 1000),
    entranceSide,
    entranceWidthMeters: entranceWidthMm === null ? null : round(entranceWidthMm / 1000),
    entranceSegment,
    northAngleDegrees,
    northToleranceDegrees: 2,
    northWithinTolerance: northAngleDegrees !== null && Math.abs(northAngleDegrees) <= 2,
  };
}

function nearestSide(feature: ReturnType<typeof getBounds>, boundary: ReturnType<typeof getBounds>): CardinalSide {
  const distances: Array<[CardinalSide, number]> = [
    ["south", Math.abs(feature.maxY - boundary.minY)],
    ["north", Math.abs(feature.minY - boundary.maxY)],
    ["west", Math.abs(feature.maxX - boundary.minX)],
    ["east", Math.abs(feature.minX - boundary.maxX)],
  ];
  return distances.sort((a, b) => a[1] - b[1])[0][0];
}

function touchesBoundarySide(line: Line2D, boundary: ReturnType<typeof getBounds>, side: CardinalSide): boolean {
  const tolerance = 500;
  const coordinate = side === "south" ? boundary.minY : side === "north" ? boundary.maxY : side === "west" ? boundary.minX : boundary.maxX;
  const values = side === "south" || side === "north" ? [line.start.y, line.end.y] : [line.start.x, line.end.x];
  return Math.min(...values) <= coordinate + tolerance && Math.max(...values) >= coordinate - tolerance;
}

function lineLength(line: Line2D): number {
  return Math.hypot(line.end.x - line.start.x, line.end.y - line.start.y);
}

function normalizeAngle(angle: number): number {
  return ((angle + 180) % 360 + 360) % 360 - 180;
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
