export type Point2D = { x: number; y: number };
export type Line2D = { type: "LINE"; layer: string; start: Point2D; end: Point2D };
export type Polyline2D = { type: "LWPOLYLINE" | "POLYLINE"; layer: string; closed: boolean; points: Point2D[] };
export type Circle2D = { type: "CIRCLE"; layer: string; center: Point2D; radius: number };
export type ExistingObjectAction = "keep" | "remove" | "ignore";
export type ExistingObject = {
  id: string;
  type: "building" | "tree" | "water" | "wall";
  label: string;
  defaultAction: ExistingObjectAction;
  points?: Point2D[];
  center?: Point2D;
  radius?: number;
  areaSquareMeters?: number;
  widthMeters?: number;
};
export type DxfUnit = "mm" | "cm" | "m" | "unknown";
export type CardinalSide = "north" | "east" | "south" | "west";
export type SiteBoundary = {
  layer: string;
  points: Point2D[];
  areaSquareMeters: number;
  perimeterMeters: number;
  sideLengthsMeters: number[];
  sideAnglesDegrees: number[];
  majorDimensionsMeters: { width: number; height: number };
  majorDirectionDegrees: number;
};

export type BuildableArea = {
  points: Point2D[];
  areaSquareMeters: number;
  perimeterMeters: number;
  setbacksMeters: Record<CardinalSide, number>;
};

export type DxfModel = {
  schemaVersion: "0.4";
  sourceUnit: DxfUnit;
  normalizedUnit: "mm";
  origin: Point2D;
  bounds: { min: Point2D; max: Point2D; width: number; height: number };
  layers: Array<{ name: string; entityCount: number }>;
  lines: Line2D[];
  polylines: Polyline2D[];
  circles: Circle2D[];
  existingObjects: ExistingObject[];
  stats: { entityCount: number; lineCount: number; polylineCount: number; circleCount: number };
  boundary: SiteBoundary;
  buildableArea: BuildableArea | null;
  siteAnalysis: {
    roadSides: CardinalSide[];
    roadWidthMeters: number | null;
    roads: Array<{ side: CardinalSide; widthMeters: number }>;
    entranceSide: CardinalSide | null;
    entranceWidthMeters: number | null;
    entranceSegment: { start: Point2D; end: Point2D } | null;
    northAngleDegrees: number | null;
    northDetected: boolean;
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
  const rawCircles: Circle2D[] = [];
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
    if (value === "CIRCLE") {
      const entity = collectEntity(pairs, index + 1);
      rawCircles.push({
        type: "CIRCLE",
        layer: findString(entity.pairs, 8) ?? "0",
        center: { x: findNumber(entity.pairs, 10) ?? 0, y: findNumber(entity.pairs, 20) ?? 0 },
        radius: findNumber(entity.pairs, 40) ?? 0,
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

  if (!rawLines.length && !rawPolylines.length && !rawCircles.length) throw new Error("DXF_NO_SUPPORTED_ENTITIES");
  const allPoints = [
    ...rawLines.flatMap((line) => [line.start, line.end]),
    ...rawPolylines.flatMap((polyline) => polyline.points),
    ...rawCircles.flatMap((circle) => [
      { x: circle.center.x - circle.radius, y: circle.center.y - circle.radius },
      { x: circle.center.x + circle.radius, y: circle.center.y + circle.radius },
    ]),
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
  const circles = rawCircles.map((circle) => ({ ...circle, center: normalize(circle.center), radius: round(circle.radius * scale) }));
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
    sideAnglesDegrees: boundaryPolyline.points.map((point, index) => {
      const next = boundaryPolyline.points[(index + 1) % boundaryPolyline.points.length];
      return round(((Math.atan2(next.y - point.y, next.x - point.x) * 180 / Math.PI) % 360 + 360) % 360);
    }),
    majorDimensionsMeters: {
      width: round(boundaryBounds.width / 1000),
      height: round(boundaryBounds.height / 1000),
    },
    majorDirectionDegrees: polygonMajorDirection(boundaryPolyline.points),
  };
  const buildablePolyline = closed.find((polyline) => polyline.layer.toUpperCase() === "BUILDABLE_AREA");
  const buildableArea = buildablePolyline ? {
    points: buildablePolyline.points,
    areaSquareMeters: round(polygonArea(buildablePolyline.points) / 1_000_000),
    perimeterMeters: round(polygonSideLengths(buildablePolyline.points).reduce((sum, length) => sum + length, 0) / 1000),
    setbacksMeters: calculateSetbacks(boundaryPolyline.points, buildablePolyline.points),
  } : null;
  const siteAnalysis = analyzeSite(lines, polylines, boundary);
  const existingObjects = analyzeExistingObjects(lines, polylines, circles);
  const layerMap = new Map<string, number>();
  for (const entity of [...lines, ...polylines, ...circles]) {
    layerMap.set(entity.layer, (layerMap.get(entity.layer) ?? 0) + 1);
  }

  return {
    schemaVersion: "0.4",
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
    circles,
    existingObjects,
    stats: {
      entityCount: lines.length + polylines.length + circles.length,
      lineCount: lines.length,
      polylineCount: polylines.length,
      circleCount: circles.length,
    },
    boundary,
    buildableArea,
    siteAnalysis,
    previewSvg: renderBoundarySvg(boundary, siteAnalysis, lines, polylines, circles),
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

function polygonMajorDirection(points: Point2D[]): number {
  const longest = points.map((point, index) => ({ point, next: points[(index + 1) % points.length] }))
    .sort((a, b) => Math.hypot(b.next.x - b.point.x, b.next.y - b.point.y) - Math.hypot(a.next.x - a.point.x, a.next.y - a.point.y))[0];
  const angle = Math.atan2(longest.next.y - longest.point.y, longest.next.x - longest.point.x) * 180 / Math.PI;
  return round(((angle % 180) + 180) % 180);
}

function calculateSetbacks(boundary: Point2D[], buildable: Point2D[]): Record<CardinalSide, number> {
  const site = getBounds(boundary);
  const control = getBounds(buildable);
  return {
    south: round((control.minY - site.minY) / 1000),
    north: round((site.maxY - control.maxY) / 1000),
    west: round((control.minX - site.minX) / 1000),
    east: round((site.maxX - control.maxX) / 1000),
  };
}

export function isFootprintWithinBuildableArea(buildableArea: BuildableArea | null, footprint: Point2D[]): boolean {
  if (!buildableArea || footprint.length < 3) return false;
  return footprint.every((point) => pointInPolygonOrBoundary(point, buildableArea.points));
}

export function isFootprintClearOfRetainedObjects(
  footprint: Point2D[], objects: ExistingObject[], actions: Partial<Record<string, ExistingObjectAction>> = {},
): boolean {
  if (footprint.length < 3) return false;
  return objects.every((object) => {
    if ((actions[object.id] ?? object.defaultAction) !== "keep") return true;
    if (object.center && object.radius !== undefined) {
      if (pointInPolygonOrBoundary(object.center, footprint)) return false;
      return segments(footprint, true).every(([a, b]) => projectToSegment(object.center!, a, b).distance > object.radius!);
    }
    if (!object.points?.length) return true;
    if (object.points.some((point) => pointInPolygonOrBoundary(point, footprint))) return false;
    if (footprint.some((point) => pointInPolygonOrBoundary(point, object.points!))) return false;
    return !segments(object.points, object.type !== "wall").some(([a, b]) => segments(footprint, true).some(([c, d]) => segmentsIntersect(a, b, c, d)));
  });
}

function analyzeExistingObjects(lines: Line2D[], polylines: Polyline2D[], circles: Circle2D[]): ExistingObject[] {
  const objects: ExistingObject[] = [];
  const addPolygons = (layer: string, type: ExistingObject["type"], label: string) => {
    polylines.filter((item) => item.layer.toUpperCase() === layer && item.closed && item.points.length >= 3).forEach((item, index) => {
      const bounds = getBounds(item.points);
      objects.push({ id: `${type}-${index + 1}`, type, label: `${label} ${index + 1}`, defaultAction: "keep", points: item.points,
        areaSquareMeters: round(polygonArea(item.points) / 1_000_000),
        widthMeters: type === "water" ? round(Math.min(bounds.width, bounds.height) / 1000) : undefined });
    });
  };
  addPolygons("EXISTING_BUILDING", "building", "现状建筑");
  addPolygons("WATER", "water", "水沟");
  const groupedTrees = new Map<string, Circle2D>();
  for (const tree of circles.filter((item) => item.layer.toUpperCase() === "TREE")) {
    const key = `${round(tree.center.x)}:${round(tree.center.y)}`;
    const current = groupedTrees.get(key);
    if (!current || tree.radius > current.radius) groupedTrees.set(key, tree);
  }
  [...groupedTrees.values()].forEach((tree, index) => objects.push({ id: `tree-${index + 1}`, type: "tree", label: `树木 ${index + 1}`, defaultAction: "keep", center: tree.center, radius: tree.radius }));
  const wallLines = lines.filter((item) => item.layer.toUpperCase() === "WALL");
  if (wallLines.length) objects.push({ id: "wall-1", type: "wall", label: "围墙 1", defaultAction: "keep", points: wallLines.flatMap((item) => [item.start, item.end]) });
  return objects;
}

function segments(points: Point2D[], closed: boolean): Array<[Point2D, Point2D]> {
  const result: Array<[Point2D, Point2D]> = [];
  for (let index = 0; index < points.length - 1; index += 1) result.push([points[index], points[index + 1]]);
  if (closed && points.length > 2) result.push([points.at(-1)!, points[0]]);
  return result;
}

function segmentsIntersect(a: Point2D, b: Point2D, c: Point2D, d: Point2D): boolean {
  const cross = (p: Point2D, q: Point2D, r: Point2D) => (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
  return cross(a, b, c) * cross(a, b, d) <= 0 && cross(c, d, a) * cross(c, d, b) <= 0;
}

function pointInPolygonOrBoundary(point: Point2D, polygon: Point2D[]): boolean {
  let inside = false;
  for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index++) {
    const start = polygon[previous];
    const end = polygon[index];
    if (projectToSegment(point, start, end).distance <= 1) return true;
    const crosses = (end.y > point.y) !== (start.y > point.y)
      && point.x < (start.x - end.x) * (point.y - end.y) / (start.y - end.y) + end.x;
    if (crosses) inside = !inside;
  }
  return inside;
}

function renderBoundarySvg(boundary: SiteBoundary, analysis: DxfModel["siteAnalysis"], lines: Line2D[], polylines: Polyline2D[], circles: Circle2D[]): string {
  const roads = polylines.filter((item) => item.layer.toUpperCase() === "ROAD");
  const entranceLines = lines.filter((item) => item.layer.toUpperCase() === "ENTRANCE");
  const entrancePolylines = polylines.filter((item) => item.layer.toUpperCase() === "ENTRANCE");
  const northLines = lines.filter((item) => item.layer.toUpperCase() === "NORTH");
  const northPolylines = polylines.filter((item) => item.layer.toUpperCase() === "NORTH");
  const buildablePolylines = polylines.filter((item) => item.layer.toUpperCase() === "BUILDABLE_AREA" && item.closed);
  const featurePoints = [
    ...boundary.points,
    ...roads.flatMap((item) => item.points),
    ...entranceLines.flatMap((item) => [item.start, item.end]),
    ...entrancePolylines.flatMap((item) => item.points),
    ...northLines.flatMap((item) => [item.start, item.end]),
    ...northPolylines.flatMap((item) => item.points),
    ...buildablePolylines.flatMap((item) => item.points),
    ...polylines.filter((item) => ["EXISTING_BUILDING", "WATER"].includes(item.layer.toUpperCase())).flatMap((item) => item.points),
    ...lines.filter((item) => item.layer.toUpperCase() === "WALL").flatMap((item) => [item.start, item.end]),
    ...circles.filter((item) => item.layer.toUpperCase() === "TREE").flatMap((item) => [{ x: item.center.x - item.radius, y: item.center.y - item.radius }, { x: item.center.x + item.radius, y: item.center.y + item.radius }]),
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
  const buildableShapes = buildablePolylines.map((item) => `<polygon points="${points(item.points)}" fill="#fffdf8" fill-opacity=".2" stroke="#bb6e48" stroke-width="${round(stroke)}" data-layer="BUILDABLE_AREA"/>`).join("");
  const existingShapes = polylines.filter((item) => item.layer.toUpperCase() === "EXISTING_BUILDING").map((item) => {
    const center = item.points.reduce((sum, point) => ({ x: sum.x + point.x / item.points.length, y: sum.y + point.y / item.points.length }), { x: 0, y: 0 });
    const label = map(center);
    return `<g data-existing-object="building"><polygon points="${points(item.points)}" fill="#b8b8b8" fill-opacity=".92" stroke="#111111" stroke-width="${round(stroke * 1.2)}"/><text x="${label.x}" y="${label.y}" text-anchor="middle" dominant-baseline="middle" fill="#111111" stroke="#f5f1e8" stroke-width="${round(stroke * .85)}" paint-order="stroke" font-size="${round(font * .7)}" font-family="Arial, sans-serif" font-weight="700">现状建筑</text></g>`;
  }).join("")
    + polylines.filter((item) => item.layer.toUpperCase() === "WATER").map((item) => `<polygon points="${points(item.points)}" fill="#9cc8d8" fill-opacity=".75" stroke="#39778c" stroke-width="${round(stroke)}" data-existing-object="water"/>`).join("")
    + lines.filter((item) => item.layer.toUpperCase() === "WALL").map((item) => line(item, "#6b665f", stroke * 1.35).replace("/>", ` data-existing-object="wall"/>`)).join("")
    + circles.filter((item) => item.layer.toUpperCase() === "TREE" && !circles.some((other) => other !== item && other.layer.toUpperCase() === "TREE" && other.center.x === item.center.x && other.center.y === item.center.y && other.radius > item.radius)).map((item) => { const center = map(item.center); return `<circle cx="${center.x}" cy="${center.y}" r="${round(item.radius)}" fill="#7aa46b" fill-opacity=".6" stroke="#3f6f37" stroke-width="${round(stroke)}" data-existing-object="tree"/>`; }).join("");
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
  const bottomLeft = map({ x: boundaryBox.minX, y: boundaryBox.minY });
  const bottomRight = map({ x: boundaryBox.maxX, y: boundaryBox.minY });
  const dimensionOffset = dimensionSpace * 0.45;
  const widthOnTop = !analysis.roadSides.includes("north");
  const heightOnRight = !analysis.roadSides.includes("east");
  const widthY = round(widthOnTop ? topLeft.y - dimensionOffset : bottomLeft.y + dimensionOffset);
  const heightX = round(heightOnRight ? topRight.x + dimensionOffset : topLeft.x - dimensionOffset);
  const widthTextY = round(widthY + (widthOnTop ? -font * .35 : font * .9));
  const heightTextX = round(heightX + (heightOnRight ? font * .65 : -font * .65));
  const heightMiddleY = round((topRight.y + bottomRight.y) / 2);
  const dimensions = `<g stroke="#567069" fill="#153b32" stroke-width="${round(stroke * .55)}" font-family="Arial, sans-serif" font-size="${round(font * .72)}"><line x1="${topLeft.x}" y1="${widthY}" x2="${topRight.x}" y2="${widthY}"/><line x1="${topLeft.x}" y1="${round(widthY - font * .3)}" x2="${topLeft.x}" y2="${round(widthY + font * .3)}"/><line x1="${topRight.x}" y1="${round(widthY - font * .3)}" x2="${topRight.x}" y2="${round(widthY + font * .3)}"/><text x="${round((topLeft.x + topRight.x) / 2)}" y="${widthTextY}" text-anchor="middle" stroke="none">${formatMetric(boundary.majorDimensionsMeters.width)} m</text><line x1="${heightX}" y1="${topRight.y}" x2="${heightX}" y2="${bottomRight.y}"/><line x1="${round(heightX - font * .3)}" y1="${topRight.y}" x2="${round(heightX + font * .3)}" y2="${topRight.y}"/><line x1="${round(heightX - font * .3)}" y1="${bottomRight.y}" x2="${round(heightX + font * .3)}" y2="${bottomRight.y}"/><text x="${heightTextX}" y="${heightMiddleY}" transform="rotate(90 ${heightTextX} ${heightMiddleY})" text-anchor="middle" stroke="none">${formatMetric(boundary.majorDimensionsMeters.height)} m</text></g>`;
  const roadLabels = roads.map((road, index) => {
    const detail = analysis.roads[index];
    return renderRoadLabel(road.points, detail?.side, `${sideLabel(detail?.side)}侧道路 ${detail ? formatMetric(detail.widthMeters) : "?"} m`, map, font);
  }).join("");
  const entranceLabel = analysis.entranceSegment ? renderEntranceLabel(analysis.entranceSegment, analysis.entranceSide, `入口 ${analysis.entranceWidthMeters === null ? "?" : formatMetric(analysis.entranceWidthMeters)} m`, map, font * .72) : "";
  const northTip = northLines[0]?.end;
  const northLabel = northTip ? labelAtCenter([northTip], `N ${analysis.northAngleDegrees ?? "?"}°`, map, font, "#153b32", -font * .55) : "";
  const edgeDimensions = renderEdgeDimensions(boundary, analysis, map, font, stroke);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${round(viewWidth)} ${round(viewHeight)}" role="img" aria-label="场地边界、建筑控制线、临路、入口、北向和尺寸预览；含现状对象"><rect width="100%" height="100%" fill="#f5f1e8"/>${roadShapes}${roadLabels}${boundaryShape}${buildableShapes}${existingShapes}${entranceGap}${entranceShapes}${entranceLabel}${northShapes}${northLabel}${edgeDimensions}${dimensions}</svg>`;
}

function renderEdgeDimensions(boundary: SiteBoundary, analysis: DxfModel["siteAnalysis"], map: (point: Point2D) => Point2D, font: number, stroke: number): string {
  const mapped = boundary.points.map(map);
  const center = mapped.reduce((sum, point) => ({ x: sum.x + point.x / mapped.length, y: sum.y + point.y / mapped.length }), { x: 0, y: 0 });
  const bounds = getBounds(boundary.points);
  return mapped.map((start, index) => {
    const end = mapped[(index + 1) % mapped.length];
    const worldStart = boundary.points[index];
    const worldEnd = boundary.points[(index + 1) % boundary.points.length];
    const edgeSide = boundaryEdgeSide(worldStart, worldEnd, bounds);
    const containsEntrance = analysis.entranceSegment !== null
      && projectToSegment(analysis.entranceSegment.start, worldStart, worldEnd).distance <= 700
      && projectToSegment(analysis.entranceSegment.end, worldStart, worldEnd).distance <= 700;
    const position = containsEntrance || edgeSide === analysis.entranceSide ? .78 : .5;
    const midpoint = { x: start.x + (end.x - start.x) * position, y: start.y + (end.y - start.y) * position };
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const length = Math.hypot(dx, dy) || 1;
    const normalA = { x: -dy / length, y: dx / length };
    const normalB = { x: -normalA.x, y: -normalA.y };
    const distanceA = Math.hypot(midpoint.x + normalA.x * font - center.x, midpoint.y + normalA.y * font - center.y);
    const distanceB = Math.hypot(midpoint.x + normalB.x * font - center.x, midpoint.y + normalB.y * font - center.y);
    const outsideNormal = distanceA >= distanceB ? normalA : normalB;
    const normal = { x: -outsideNormal.x, y: -outsideNormal.y };
    const label = { x: round(midpoint.x + normal.x * font * .9), y: round(midpoint.y + normal.y * font * .9) };
    let angle = Math.atan2(dy, dx) * 180 / Math.PI;
    if (angle > 90 || angle < -90) angle += 180;
    return `<text x="${label.x}" y="${label.y}" transform="rotate(${round(angle)} ${label.x} ${label.y})" text-anchor="middle" dominant-baseline="middle" fill="#153b32" stroke="#f5f1e8" stroke-width="${round(stroke * 1.4)}" paint-order="stroke" font-size="${round(font * .62)}" font-family="Arial, sans-serif" font-weight="700" data-edge="${index + 1}">${formatMetric(boundary.sideLengthsMeters[index])} m</text>`;
  }).join("");
}

function boundaryEdgeSide(start: Point2D, end: Point2D, bounds: ReturnType<typeof getBounds>): CardinalSide | null {
  const tolerance = 1;
  if (Math.abs(start.y - bounds.minY) <= tolerance && Math.abs(end.y - bounds.minY) <= tolerance) return "south";
  if (Math.abs(start.y - bounds.maxY) <= tolerance && Math.abs(end.y - bounds.maxY) <= tolerance) return "north";
  if (Math.abs(start.x - bounds.minX) <= tolerance && Math.abs(end.x - bounds.minX) <= tolerance) return "west";
  if (Math.abs(start.x - bounds.maxX) <= tolerance && Math.abs(end.x - bounds.maxX) <= tolerance) return "east";
  return null;
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

function renderRoadLabel(items: Point2D[], side: CardinalSide | undefined, text: string, map: (point: Point2D) => Point2D, font: number): string {
  const center = items.reduce((sum, item) => ({ x: sum.x + item.x / items.length, y: sum.y + item.y / items.length }), { x: 0, y: 0 });
  const point = map(center);
  const rotation = side === "east" || side === "west" ? 90 : 0;
  return `<text x="${point.x}" y="${point.y}" transform="rotate(${rotation} ${point.x} ${point.y})" text-anchor="middle" dominant-baseline="middle" fill="#fffdf8" stroke="#9e5435" stroke-width="${round(font * .16)}" paint-order="stroke" font-size="${round(font * .88)}" font-family="Arial, sans-serif" font-weight="700">${text}</text>`;
}

function renderEntranceLabel(segment: { start: Point2D; end: Point2D }, side: CardinalSide | null, text: string, map: (point: Point2D) => Point2D, font: number): string {
  const center = map({ x: (segment.start.x + segment.end.x) / 2, y: (segment.start.y + segment.end.y) / 2 });
  const offset = font * 1.25;
  const x = round(center.x + (side === "west" ? offset : side === "east" ? -offset : 0));
  const y = round(center.y + (side === "north" ? offset : side === "south" ? -offset : 0));
  const anchor = side === "east" ? "end" : side === "west" ? "start" : "middle";
  return `<text x="${x}" y="${y}" text-anchor="${anchor}" dominant-baseline="middle" fill="#9e5435" stroke="#fffdf8" stroke-width="${round(font * .35)}" paint-order="stroke" font-size="${round(font)}" font-family="Arial, sans-serif" font-weight="700">${text}</text>`;
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
    const width = Math.min(...polygonSideLengths(road.points));
    return { side, width };
  });
  const roadSides = [...new Set(roadPairs.map((item) => item.side))];
  const roadWidthMm = roadPairs.length ? Math.max(...roadPairs.map((item) => item.width)) : null;
  const roadDetails = roadPairs.map((item) => ({ side: item.side, widthMeters: round(item.width / 1000) }));

  const entranceLines = lines.filter((line) => line.layer.toUpperCase() === "ENTRANCE");
  let entranceSide: CardinalSide | null = null;
  let entranceWidthMm: number | null = null;
  let entranceSegment: { start: Point2D; end: Point2D } | null = null;
  for (let index = 0; index < boundary.points.length; index += 1) {
    const edgeStart = boundary.points[index];
    const edgeEnd = boundary.points[(index + 1) % boundary.points.length];
    const projections = entranceLines.flatMap((line) => {
      const candidates = [projectToSegment(line.start, edgeStart, edgeEnd), projectToSegment(line.end, edgeStart, edgeEnd)];
      const nearest = candidates.sort((a, b) => a.distance - b.distance)[0];
      return nearest.distance <= 700 ? [nearest] : [];
    }).sort((a, b) => a.t - b.t);
    if (projections.length >= 2) {
      const first = projections[0];
      const last = projections.at(-1)!;
      entranceSide = classifyBoundaryEdge(edgeStart, edgeEnd, boundaryBox);
      entranceWidthMm = Math.hypot(last.point.x - first.point.x, last.point.y - first.point.y);
      entranceSegment = { start: first.point, end: last.point };
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
    roads: roadDetails,
    entranceSide,
    entranceWidthMeters: entranceWidthMm === null ? null : round(entranceWidthMm / 1000),
    entranceSegment,
    northAngleDegrees,
    northDetected: northAngleDegrees !== null,
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

function projectToSegment(point: Point2D, start: Point2D, end: Point2D): { point: Point2D; t: number; distance: number } {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy || 1;
  const t = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared));
  const projected = { x: round(start.x + t * dx), y: round(start.y + t * dy) };
  return { point: projected, t, distance: Math.hypot(point.x - projected.x, point.y - projected.y) };
}

function classifyBoundaryEdge(start: Point2D, end: Point2D, bounds: ReturnType<typeof getBounds>): CardinalSide {
  const midpoint = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };
  const distances: Array<[CardinalSide, number]> = [
    ["south", Math.abs(midpoint.y - bounds.minY)],
    ["north", Math.abs(midpoint.y - bounds.maxY)],
    ["west", Math.abs(midpoint.x - bounds.minX)],
    ["east", Math.abs(midpoint.x - bounds.maxX)],
  ];
  return distances.sort((a, b) => a[1] - b[1])[0][0];
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

function formatMetric(value: number): string {
  return value.toFixed(1);
}
