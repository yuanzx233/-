import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { generatePlanCandidates, planTemplates } from "../lib/plan-generator";

const input = {
  site: { northDirection: "北", entranceDirection: "南", roadDirections: ["南"], boundaryConfirmed: true, areaSquareMeters: 432, perimeterMeters: 84, boundaryPoints: [{ x: 0, y: 0 }, { x: 18000, y: 0 }, { x: 18000, y: 24000 }, { x: 0, y: 24000 }] },
  requirements: { floors: 1, householdSize: 3, areaMin: 75, areaMax: 95, bedroomCount: 2, bathroomCount: 1, stairCount: 0, elderRoomCount: 1, elderRoomFirstFloor: true, minBedroomArea: 8, minElderRoomArea: 10, minLivingArea: 15, minKitchenArea: 5, minBathroomArea: 3, priorities: ["适老", "动静分区"], notes: "" },
} as const;

test("loads only three approved mature templates", () => { assert.deepEqual(planTemplates.map(x => x.id), ["HT-T001", "HT-T002", "HT-T003"]); assert.ok(planTemplates.every(x => x.status === "APPROVED")); });
test("each mature template references a real standardized DXF", async () => { for (const template of planTemplates) { const source = await readFile(`resources/house-templates/${template.source.dxfPath}`, "utf8"); assert.match(source, /SECTION/); assert.match(source, /ENTITIES/); assert.ok(template.rooms.length >= 6); assert.ok(template.walls.length > 20); } });
test("returns candidates rendered from mature template geometry", () => { const plans = generatePlanCandidates(input as never); assert.equal(plans.length, 3); for (const plan of plans) { assert.match(plan.templateId, /^HT-T00[1-3]$/); assert.match(plan.templateSource, /STANDARDIZED_AC1032\.dxf/); assert.match(plan.svg, /成熟DXF户型及轴网尺寸/); assert.match(plan.svg, /data-layer="AXIS_GRID"/); assert.match(plan.svg, /data-layer="GRID_DIMENSIONS"/); assert.match(plan.svg, /总宽/); assert.match(plan.svg, /总深/); assert.ok(plan.rooms.length >= 6); assert.equal(plan.siteFit.fits, true); } });
test("does not synthesize a plan when mature templates do not satisfy requirements", () => { const unmatched = structuredClone(input) as any; unmatched.requirements.floors = 2; unmatched.requirements.bedroomCount = 4; assert.equal(generatePlanCandidates(unmatched).length, 0); });
test("rejects mature candidates that cannot fit the buildable polygon", () => { const constrained = structuredClone(input) as any; constrained.site.buildablePoints = [{ x: 0, y: 0 }, { x: 4000, y: 0 }, { x: 4000, y: 4000 }, { x: 0, y: 4000 }]; constrained.site.buildableAreaSquareMeters = 16; assert.equal(generatePlanCandidates(constrained).length, 0); });
