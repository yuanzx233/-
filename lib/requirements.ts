export type Direction = "东" | "南" | "西" | "北";

export type SiteConfirmation = {
  northDirection: Direction;
  entranceDirection: Direction;
  roadDirections: Direction[];
  boundaryConfirmed: boolean;
  areaSquareMeters: number;
  perimeterMeters: number;
  boundaryPoints?: Array<{ x: number; y: number }>;
  buildablePoints?: Array<{ x: number; y: number }>;
  buildableAreaSquareMeters?: number;
  retainedObjects?: Array<{ type: string; points?: Array<{ x: number; y: number }>; center?: { x: number; y: number }; radius?: number }>;
};

export type HousingRequirements = {
  floors: number;
  householdSize: number;
  areaMin: number;
  areaMax: number;
  bedroomCount: number;
  bathroomCount: number;
  stairCount: number;
  elderRoomCount: number;
  elderRoomFirstFloor: boolean;
  minBedroomArea: number;
  minElderRoomArea: number;
  minLivingArea: number;
  minKitchenArea: number;
  minBathroomArea: number;
  priorities: string[];
  notes: string;
};

export type RequirementSubmission = {
  site: SiteConfirmation;
  requirements: HousingRequirements;
};

export type ValidationIssue = { field: string; message: string };

export const priorityOptions = ["采光", "通风", "收纳", "动静分区", "适老", "庭院", "停车"] as const;

export function validateRequirementSubmission(input: RequirementSubmission): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const { site, requirements: value } = input;
  const integerFields: Array<[keyof HousingRequirements, string, number, number]> = [
    ["floors", "建筑层数", 1, 3],
    ["householdSize", "居住人数", 1, 20],
    ["bedroomCount", "卧室数量", 1, 12],
    ["bathroomCount", "卫生间数量", 1, 8],
    ["stairCount", "楼梯数量", 0, 3],
    ["elderRoomCount", "老人房数量", 0, 4],
  ];
  for (const [field, label, min, max] of integerFields) {
    const number = value[field] as number;
    if (!Number.isInteger(number) || number < min || number > max) {
      issues.push({ field, message: `${label}应为 ${min}–${max} 的整数。` });
    }
  }
  if (!site.boundaryConfirmed) issues.push({ field: "boundaryConfirmed", message: "请确认解析出的场地边界无误。" });
  if (!Number.isFinite(site.areaSquareMeters) || site.areaSquareMeters <= 0) issues.push({ field: "siteArea", message: "场地面积无效，请重新解析 DXF。" });
  if (!site.roadDirections.length) issues.push({ field: "roadDirections", message: "请至少确认一个临路方向。" });
  if (!Number.isFinite(value.areaMin) || !Number.isFinite(value.areaMax) || value.areaMin < 40 || value.areaMax < value.areaMin) {
    issues.push({ field: "areaRange", message: "建筑面积范围应从 40 m² 起，且最大值不能小于最小值。" });
  } else {
    const conceptualLimit = site.areaSquareMeters * Math.max(1, value.floors) * 0.8;
    if (value.areaMax > conceptualLimit) {
      issues.push({ field: "areaMax", message: `面积上限超过概念容量 ${round(conceptualLimit)} m²（按场地面积 × 层数 × 80% 预检）。` });
    }
  }
  const minimumAreas: Array<[keyof HousingRequirements, string, number]> = [
    ["minBedroomArea", "卧室", 8],
    ["minElderRoomArea", "老人房", 10],
    ["minLivingArea", "客厅", 15],
    ["minKitchenArea", "厨房", 5],
    ["minBathroomArea", "卫生间", 3],
  ];
  for (const [field, label, minimum] of minimumAreas) {
    const number = value[field] as number;
    if (!Number.isFinite(number) || number < minimum) issues.push({ field, message: `${label}最小面积不能低于 ${minimum} m²。` });
  }
  if (value.elderRoomCount > value.bedroomCount) issues.push({ field: "elderRoomCount", message: "老人房数量不能超过卧室总数。" });
  if (value.elderRoomCount > 0 && !value.elderRoomFirstFloor) issues.push({ field: "elderRoomFirstFloor", message: "包含老人房时，至少一间老人房必须设在首层。" });
  const minimumBathrooms = Math.max(1, Math.ceil(value.bedroomCount / 3));
  if (value.bathroomCount < minimumBathrooms) issues.push({ field: "bathroomCount", message: `${value.bedroomCount} 间卧室至少需要 ${minimumBathrooms} 个卫生间。` });
  if (value.floors > 1 && value.stairCount < 1) issues.push({ field: "stairCount", message: "两层及以上住宅至少需要 1 部楼梯。" });
  if (value.floors === 1 && value.stairCount > 0) issues.push({ field: "stairCount", message: "单层住宅通常无需楼梯，请将楼梯数量设为 0。" });
  if (!value.priorities.length) issues.push({ field: "priorities", message: "请至少选择一项需求优先级。" });
  if (value.priorities.length > 3) issues.push({ field: "priorities", message: "最多选择 3 项最高优先级，便于方案取舍。" });
  return issues;
}

function round(value: number) {
  return Math.round(value * 10) / 10;
}
