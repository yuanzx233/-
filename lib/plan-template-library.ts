import t001 from "../resources/house-templates/HT-T001/data/template.json";
import t002 from "../resources/house-templates/HT-T002/data/template.json";
import t003 from "../resources/house-templates/HT-T003/data/template.json";
import t004 from "../resources/house-templates/HT-T004/data/template.json";
import t005 from "../resources/house-templates/HT-T005/data/template.json";
import t006 from "../resources/house-templates/HT-T006/data/template.json";

type Pair = [number, number];
type RawRoom = { id: string; name: string; type: string; area: number; boundary: Pair[]; labelPoint: Pair[] };
type RawWall = { id: string; start: Pair; end: Pair };
type RawOpening = { id: string; type: string; start?: Pair; end?: Pair; position?: Pair; insertionPoint?: Pair; width?: number; rotationDeg?: number };
type RawTemplate = {
  template: { id: string; name: string; status: string; version: string };
  classification: { primaryWidthType: string; depthType: string; layoutType: string };
  geometry: { buildingFootprint: { outline: Pair[]; boundingWidth: number; boundingDepth: number; areaM2: number } };
  floors: Array<{ number: number; rooms: RawRoom[]; walls: RawWall[]; openings: RawOpening[] }>;
  approval: { status?: string };
};

export type MaturePlanTemplate = {
  id: string; name: string; version: string; status: "APPROVED"; floors: number; bedrooms: number;
  width: number; depth: number; area: number; footprint: Pair[]; rooms: RawRoom[]; walls: RawWall[]; openings: RawOpening[];
  source: { dxfPath: string; jsonPath: string }; tags: string[];
  adjustable: { rotate: true; minScale: number; maxScale: number };
};

function load(raw: unknown, folder: string, dxfFile: string): MaturePlanTemplate {
  const item = raw as RawTemplate;
  if (item.template.status !== "APPROVED") throw new Error(`INVALID_MATURE_TEMPLATE:${folder}`);
  const rooms = item.floors.flatMap(floor => floor.rooms);
  return {
    id: item.template.id, name: item.template.name, version: item.template.version, status: "APPROVED",
    floors: item.floors.length, bedrooms: rooms.filter(room => room.type.startsWith("BED-")).length,
    width: item.geometry.buildingFootprint.boundingWidth, depth: item.geometry.buildingFootprint.boundingDepth,
    area: item.geometry.buildingFootprint.areaM2, footprint: item.geometry.buildingFootprint.outline,
    rooms, walls: item.floors.flatMap(floor => floor.walls), openings: item.floors.flatMap(floor => floor.openings),
    source: { dxfPath: `${folder}/normalized/${dxfFile}`, jsonPath: `${folder}/data/template.json` },
    tags: rooms.some(room => room.type === "BED-ELDERLY") ? ["适老", "动静分区"] : ["采光", "通风"],
    adjustable: { rotate: true, minScale: .95, maxScale: 1.05 },
  };
}

/** 仅包含经过审核、同时具有标准化 DXF 与 template.json 的成熟模板。 */
export const projectPlanTemplateLibrary = [
  load(t001, "HT-T001", "HT_T001_V0.3_STANDARDIZED_AC1032.dxf"),
  load(t002, "HT-T002", "HT_T002_V0.3_STANDARDIZED_AC1032.dxf"),
  load(t003, "HT-T003", "HT_T003_V0.3_STANDARDIZED_AC1032.dxf"),
  load(t004, "HT-T004", "HT_T004_V0.3_STANDARDIZED_AC1032.dxf"),
  load(t005, "HT-T005", "HT_T005_V0.3_STANDARDIZED_AC1032.dxf"),
  load(t006, "HT-T006", "HT_T006_V0.3_STANDARDIZED_AC1032.dxf"),
];
