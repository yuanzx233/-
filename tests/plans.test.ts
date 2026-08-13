import assert from "node:assert/strict";
import test from "node:test";
import { generatePlanCandidates, planTemplates } from "../lib/plan-generator";

const input = {
  site: { northDirection: "北", entranceDirection: "南", roadDirections: ["南"], boundaryConfirmed: true, areaSquareMeters: 432, perimeterMeters: 84, boundaryPoints: [{ x: 0, y: 0 }, { x: 18000, y: 0 }, { x: 18000, y: 24000 }, { x: 0, y: 24000 }] },
  requirements: { floors: 2, householdSize: 5, areaMin: 160, areaMax: 220, bedroomCount: 4, bathroomCount: 2, stairCount: 1, elderRoomCount: 1, elderRoomFirstFloor: true, minBedroomArea: 10, minElderRoomArea: 12, minLivingArea: 24, minKitchenArea: 8, minBathroomArea: 4, priorities: ["采光", "通风"], notes: "" },
} as const;

test("provides 16 base templates", () => assert.equal(planTemplates.length, 16));
test("loads templates from the project resource library", () => { for (const template of planTemplates) { assert.match(template.id, /^LIB-/); assert.match(template.resourcePath, /^\/plan-library\//); assert.equal(template.adjustable.rotate, true); } });
test("returns three ranked plans only after site fit passes", () => { const plans = generatePlanCandidates(input as never); assert.equal(plans.length, 3); assert.ok(plans[0].score >= plans[1].score); for (const plan of plans) { assert.equal(plan.siteFit.fits, true); assert.match(plan.templateSource, /^\/plan-library\//); assert.ok([0, 90].includes(plan.adjustment.rotationDegrees)); assert.ok(plan.adjustment.scale >= .88); assert.match(plan.svg, /^<svg/); assert.ok(plan.rooms.length >= 6); assert.ok(plan.satisfaction.length >= 4); assert.ok(plan.totalArea >= 160 && plan.totalArea <= 220); } });
test("rejects candidates that cannot fit the parsed buildable polygon", () => { const constrained = structuredClone(input) as any; constrained.site.buildablePoints = [{ x: 0, y: 0 }, { x: 4000, y: 0 }, { x: 4000, y: 4000 }, { x: 0, y: 4000 }]; constrained.site.buildableAreaSquareMeters = 16; assert.equal(generatePlanCandidates(constrained).length, 0); });
