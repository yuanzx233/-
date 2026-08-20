import t001 from "../resources/house-templates/HT-T001/data/template.json";
import t002 from "../resources/house-templates/HT-T002/data/template.json";
import t003 from "../resources/house-templates/HT-T003/data/template.json";
import t004 from "../resources/house-templates/HT-T004/data/template.json";
import t005 from "../resources/house-templates/HT-T005/data/template.json";
import t006 from "../resources/house-templates/HT-T006/data/template.json";
import t007 from "../resources/house-templates/HT-T007/data/template.json";
import t008 from "../resources/house-templates/HT-T008/data/template.json";
import t009 from "../resources/house-templates/HT-T009/data/template.json";
import t010 from "../resources/house-templates/HT-T010/data/template.json";
import t011 from "../resources/house-templates/HT-T011/data/template.json";
import t012 from "../resources/house-templates/HT-T012/data/template.json";
import t013 from "../resources/house-templates/HT-T013/data/template.json";
import t014 from "../resources/house-templates/HT-T014/data/template.json";
import t015 from "../resources/house-templates/HT-T015/data/template.json";

type Pair = [number, number];
type RawRoom = { id: string; name: string; type: string; area: number; boundary: Pair[]; labelPoint: Pair[]; floorNumber?: number };
type RawWall = { id: string; start: Pair; end: Pair };
type RawOpening = { id: string; type: string; sourceBlock?: string; start?: Pair; end?: Pair; position?: Pair; insertionPoint?: Pair; width?: number; widthMm?: number; rotationDeg?: number };
type RawAncillaryArea = { id: string; type: "PORCH" | "OUTDOOR-TERRACE"; name: string; areaM2: number; includedInBuildingArea: false; geometry?: { kind: "POLYGON"; points: Pair[] } | { kind: "QUADRATIC_ARC_SEGMENT"; chordStart: Pair; chordEnd: Pair; controlPoint: Pair } };
type RawExteriorStep = { id: string; name: string; kind: "LINEAR"; treadLines: Array<[Pair, Pair]>; sideLines: Array<[Pair, Pair]> } | { id: string; name: string; kind: "CURVED"; areaM2?: number; curves: Array<{ start: Pair; end: Pair; control: Pair }>; sideLines: Array<[Pair, Pair]> };
type RawTemplate = {
  template: { id: string; name: string; status: string; version: string };
  classification: { primaryWidthType: string; depthType: string; layoutType: string };
  geometry: { buildingFootprint?: { outline: Pair[]; boundingWidth: number; boundingDepth: number; areaM2: number }; floorFootprints?: Array<{ floorId: string; outline: Pair[]; areaM2: number }>; grossFloorAreaM2?: number; ancillaryAreas?: RawAncillaryArea[]; exteriorSteps?: RawExteriorStep[] };
  floors: Array<{ number: number; rooms: RawRoom[]; walls: RawWall[]; openings: RawOpening[] }>;
  approval: { status?: string };
};

export type MaturePlanTemplate = {
  id: string; name: string; version: string; status: "APPROVED"; floors: number; bedrooms: number;
  width: number; depth: number; area: number; footprint: Pair[]; displayFootprints: Pair[][]; ancillaryAreas: RawAncillaryArea[]; exteriorSteps: RawExteriorStep[]; rooms: RawRoom[]; walls: RawWall[]; openings: RawOpening[];
  source: { dxfPath: string; jsonPath: string }; tags: string[];
  adjustable: { rotate: true; minScale: number; maxScale: number };
};

function load(raw: unknown, folder: string, dxfFile: string): MaturePlanTemplate {
  const item = raw as RawTemplate;
  if (item.template.status !== "APPROVED") throw new Error(`INVALID_MATURE_TEMPLATE:${folder}`);
  const displayFootprints = item.geometry.floorFootprints?.map(floor => floor.outline) ?? (item.geometry.buildingFootprint ? [item.geometry.buildingFootprint.outline] : []);
  if (!displayFootprints.length) throw new Error(`MISSING_TEMPLATE_FOOTPRINT:${folder}`);
  const footprint = displayFootprints[0]; const footprintBounds = bounds(footprint);
  const rooms = item.floors.flatMap(floor => floor.rooms.map(room => ({ ...room, floorNumber: floor.number })));
  return {
    id: item.template.id, name: item.template.name, version: item.template.version, status: "APPROVED",
    floors: item.floors.length, bedrooms: rooms.filter(room => room.type.startsWith("BED-")).length,
    width: item.geometry.buildingFootprint?.boundingWidth ?? footprintBounds.maxX - footprintBounds.minX, depth: item.geometry.buildingFootprint?.boundingDepth ?? footprintBounds.maxY - footprintBounds.minY,
    area: item.geometry.grossFloorAreaM2 ?? item.geometry.buildingFootprint?.areaM2 ?? item.geometry.floorFootprints?.reduce((sum, floor) => sum + floor.areaM2, 0) ?? 0, footprint, displayFootprints, ancillaryAreas: item.geometry.ancillaryAreas ?? [], exteriorSteps: item.geometry.exteriorSteps ?? [],
    rooms, walls: item.floors.flatMap(floor => floor.walls), openings: item.floors.flatMap(floor => floor.openings),
    source: { dxfPath: `${folder}/normalized/${dxfFile}`, jsonPath: `${folder}/data/template.json` },
    tags: rooms.some(room => room.type === "BED-ELDERLY") ? ["适老", "动静分区"] : ["采光", "通风"],
    adjustable: { rotate: true, minScale: .95, maxScale: 1.05 },
  };
}

function bounds(points: Pair[]) { const xs = points.map(point => point[0]); const ys = points.map(point => point[1]); return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) }; }

/** 仅包含经过审核、同时具有标准化 DXF 与 template.json 的成熟模板。 */
export const projectPlanTemplateLibrary = [
  load(t001, "HT-T001", "HT_T001_V0.3_STANDARDIZED_AC1032.dxf"),
  load(t002, "HT-T002", "HT_T002_V0.3_STANDARDIZED_AC1032.dxf"),
  load(t003, "HT-T003", "HT_T003_V0.3_STANDARDIZED_AC1032.dxf"),
  load(t004, "HT-T004", "HT_T004_V0.3_STANDARDIZED_AC1032.dxf"),
  load(t005, "HT-T005", "HT_T005_V0.3_STANDARDIZED_AC1032.dxf"),
  load(t006, "HT-T006", "HT_T006_V0.3_STANDARDIZED_AC1032.dxf"),
  load(t007, "HT-T007", "HT_T007_V0.3_STANDARDIZED_AC1032.dxf"),
  load(t008, "HT-T008", "HT_T008_V0.3_STANDARDIZED_AC1032.dxf"),
  load(t009, "HT-T009", "HT_T009_V0.3_STANDARDIZED_AC1032.dxf"),
  load(t010, "HT-T010", "HT_T010_V0.3_STANDARDIZED_AC1032.dxf"),
  load(t011, "HT-T011", "HT_T011_V0.3_STANDARDIZED_AC1032.dxf"),
  load(t012, "HT-T012", "HT_T012_V0.3_STANDARDIZED_AC1032.dxf"),
  load(t013, "HT-T013", "HT_T013_V0.3_STANDARDIZED_AC1032.dxf"),
  load(t014, "HT-T014", "HT_T014_V0.3_STANDARDIZED_AC1032.dxf"),
  load(t015, "HT-T015", "HT_T015_V0.3_STANDARDIZED_AC1032.dxf"),
];
