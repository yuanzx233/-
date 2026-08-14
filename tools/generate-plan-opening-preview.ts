import { mkdir, writeFile } from "node:fs/promises";
import sharp from "sharp";
import { generatePlanCandidates } from "../lib/plan-generator";

const input = {
  site: { northDirection: "北", entranceDirection: "南", roadDirections: ["南"], boundaryConfirmed: true, areaSquareMeters: 600, perimeterMeters: 100, boundaryPoints: [{ x: 0, y: 0 }, { x: 25000, y: 0 }, { x: 25000, y: 24000 }, { x: 0, y: 24000 }] },
  requirements: { floors: 1, householdSize: 5, areaMin: 90, areaMax: 150, bedroomCount: 3, bathroomCount: 2, stairCount: 0, elderRoomCount: 0, elderRoomFirstFloor: false, minBedroomArea: 8, minElderRoomArea: 10, minLivingArea: 15, minKitchenArea: 5, minBathroomArea: 3, priorities: [], notes: "" },
} as const;

const plan = generatePlanCandidates(input as never).find(item => item.templateId === "HT-T005");
if (!plan) throw new Error("HT-T005 preview candidate was not generated");
await mkdir(".artifacts", { recursive: true });
await writeFile(".artifacts/HT-T005-door-window-preview.svg", plan.svg, "utf8");
await sharp(Buffer.from(plan.svg), { limitInputPixels: false }).resize({ width: 1200 }).png().toFile(".artifacts/HT-T005-door-window-preview.png");
