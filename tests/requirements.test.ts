import assert from "node:assert/strict";
import test from "node:test";
import { type RequirementSubmission, validateRequirementSubmission } from "../lib/requirements";

function validSubmission(): RequirementSubmission {
  return {
    site: {
      northDirection: "北",
      entranceDirection: "南",
      roadDirections: ["南"],
      boundaryConfirmed: true,
      areaSquareMeters: 432,
      perimeterMeters: 84,
    },
    requirements: {
      floors: 2,
      householdSize: 5,
      areaMin: 160,
      areaMax: 220,
      bedroomCount: 4,
      bathroomCount: 2,
      stairCount: 1,
      elderRoomCount: 1,
      elderRoomFirstFloor: true,
      minBedroomArea: 10,
      minElderRoomArea: 12,
      minLivingArea: 24,
      minKitchenArea: 8,
      minBathroomArea: 4,
      priorities: ["采光", "通风"],
      notes: "保留院落",
    },
  };
}

test("accepts a complete structured requirement submission", () => {
  assert.deepEqual(validateRequirementSubmission(validSubmission()), []);
});

test("rejects area overflow and minimum room area violations", () => {
  const input = validSubmission();
  input.requirements.areaMax = 800;
  input.requirements.minBedroomArea = 7;
  input.requirements.minBathroomArea = 2;
  const fields = validateRequirementSubmission(input).map((issue) => issue.field);
  assert.ok(fields.includes("areaMax"));
  assert.ok(fields.includes("minBedroomArea"));
  assert.ok(fields.includes("minBathroomArea"));
});

test("checks elder room, bathroom and stair rules", () => {
  const input = validSubmission();
  input.requirements.bedroomCount = 7;
  input.requirements.bathroomCount = 1;
  input.requirements.stairCount = 0;
  input.requirements.elderRoomFirstFloor = false;
  const fields = validateRequirementSubmission(input).map((issue) => issue.field);
  assert.ok(fields.includes("bathroomCount"));
  assert.ok(fields.includes("stairCount"));
  assert.ok(fields.includes("elderRoomFirstFloor"));
});

test("requires boundary, road and a concise priority list", () => {
  const input = validSubmission();
  input.site.boundaryConfirmed = false;
  input.site.roadDirections = [];
  input.requirements.priorities = ["采光", "通风", "收纳", "庭院"];
  const fields = validateRequirementSubmission(input).map((issue) => issue.field);
  assert.ok(fields.includes("boundaryConfirmed"));
  assert.ok(fields.includes("roadDirections"));
  assert.ok(fields.includes("priorities"));
});
