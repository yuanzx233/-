import type { RequirementSubmission } from "./requirements";

export type PlanRoom = { id: string; name: string; floor: number; area: number; x: number; y: number; width: number; height: number };
export type PlanCandidate = { id: string; name: string; templateId: string; score: number; totalArea: number; floors: number; footprint: Array<{ x: number; y: number }>; siteFit: { fits: boolean; basis: "buildable" | "boundary"; coveragePercent: number; clearanceNote: string }; rooms: PlanRoom[]; strengths: string[]; tradeoffs: string[]; satisfaction: Array<{ label: string; met: boolean; detail: string }>; svg: string };
type Template = { id: string; name: string; aspect: number; floors: number; bedrooms: number; layout: "central" | "side" | "courtyard"; tags: string[] };

export const planTemplates: Template[] = Array.from({ length: 16 }, (_, index) => ({
  id: `T${String(index + 1).padStart(2, "0")}`,
  name: ["南向通厅", "中央楼梯", "侧厅紧凑", "双面采光", "适老首层", "庭院联动", "动静分层", "方正经济"][index % 8],
  aspect: [0.72, 0.8, 0.9, 1, 1.12, 1.25, 1.38, 1.5][index % 8],
  floors: index < 5 ? 1 : index < 12 ? 2 : 3,
  bedrooms: 2 + (index % 5),
  layout: (["central", "side", "courtyard"] as const)[index % 3],
  tags: index % 3 === 0 ? ["采光", "通风"] : index % 3 === 1 ? ["动静分区", "适老"] : ["庭院", "收纳"],
}));

export function generatePlanCandidates(input: RequirementSubmission): PlanCandidate[] {
  const r = input.requirements;
  const targetArea = (r.areaMin + r.areaMax) / 2;
  const siteAspect = Math.max(.55, Math.min(1.8, input.site.areaSquareMeters / Math.max(1, input.site.perimeterMeters ** 2) * 16));
  const available = input.site.buildablePoints?.length ? input.site.buildablePoints : input.site.boundaryPoints;
  if (!available?.length) throw new Error("SITE_GEOMETRY_REQUIRED");
  const bounds = polygonBounds(available);
  const availableArea = input.site.buildableAreaSquareMeters ?? input.site.areaSquareMeters;
  return planTemplates.map((template) => {
    const floorFit = 1 - Math.min(1, Math.abs(template.floors - r.floors) / 2);
    const bedroomFit = 1 - Math.min(1, Math.abs(template.bedrooms - r.bedroomCount) / Math.max(1, r.bedroomCount));
    const aspectFit = 1 - Math.min(1, Math.abs(template.aspect - siteAspect) / 1.2);
    const priorityFit = r.priorities.filter((item) => template.tags.includes(item)).length / Math.max(1, r.priorities.length);
    const score = Math.round((floorFit * 35 + bedroomFit * 30 + aspectFit * 20 + priorityFit * 15) * 10) / 10;
    return buildCandidate(template, input, targetArea, score, available, bounds, availableArea);
  }).filter((plan) => plan.siteFit.fits).sort((a, b) => b.score - a.score).slice(0, 3).map((plan, index) => ({ ...plan, id: `P${index + 1}`, name: `方案 ${String.fromCharCode(65 + index)} · ${plan.name}` }));
}

function buildCandidate(template: Template, input: RequirementSubmission, targetArea: number, score: number, available: Array<{ x: number; y: number }>, bounds: ReturnType<typeof polygonBounds>, availableArea: number): PlanCandidate {
  const r = input.requirements;
  const totalArea = round(Math.min(r.areaMax, Math.max(r.areaMin, targetArea * (0.94 + (Number(template.id.slice(1)) % 3) * .04))));
  const perFloor = totalArea / r.floors;
  const footprintWidth = Math.sqrt(perFloor * template.aspect) * 1000, footprintHeight = perFloor / (footprintWidth / 1000) * 1000;
  const cx = (bounds.minX + bounds.maxX) / 2, cy = (bounds.minY + bounds.maxY) / 2;
  const footprint = [{ x: cx - footprintWidth / 2, y: cy - footprintHeight / 2 }, { x: cx + footprintWidth / 2, y: cy - footprintHeight / 2 }, { x: cx + footprintWidth / 2, y: cy + footprintHeight / 2 }, { x: cx - footprintWidth / 2, y: cy + footprintHeight / 2 }];
  const within = footprint.every((point) => pointInPolygon(point, available)), avoids = avoidsRetainedObjects(footprint, input.site.retainedObjects ?? []), capacity = perFloor <= availableArea * .8;
  const siteFit = { fits: within && avoids && capacity, basis: input.site.buildablePoints?.length ? "buildable" as const : "boundary" as const, coveragePercent: round(perFloor / availableArea * 100), clearanceNote: !within ? "建筑轮廓超出可建设边界" : !avoids ? "建筑轮廓占用保留对象" : !capacity ? "首层占地超过可建设面积 80%" : "建筑轮廓完整位于可建设范围内" };
  const living = Math.max(r.minLivingArea, round(perFloor * .24));
  const kitchen = Math.max(r.minKitchenArea, round(perFloor * .1));
  const bathArea = Math.max(r.minBathroomArea, round(perFloor * .055));
  const bedroomArea = Math.max(r.minBedroomArea, round((totalArea - living - kitchen - bathArea * r.bathroomCount) / Math.max(3, r.bedroomCount + 2)));
  const rooms: PlanRoom[] = [];
  for (let floor = 1; floor <= r.floors; floor++) {
    const floorBedrooms = Math.floor(r.bedroomCount / r.floors) + (floor <= r.bedroomCount % r.floors ? 1 : 0);
    const baseY = (floor - 1) * 250;
    if (floor === 1) rooms.push(room(`living-${floor}`, "客厅", floor, living, 10, baseY + 10, 210, 105), room(`kitchen-${floor}`, "餐厨", floor, kitchen, 225, baseY + 10, 105, 105));
    for (let i = 0; i < floorBedrooms; i++) rooms.push(room(`bed-${floor}-${i}`, floor === 1 && i < r.elderRoomCount ? "老人房" : `卧室 ${rooms.filter(x => x.name.includes("卧室")).length + 1}`, floor, floor === 1 && i < r.elderRoomCount ? Math.max(bedroomArea, r.minElderRoomArea) : bedroomArea, 10 + i * 108, baseY + 120, 103, 90));
    rooms.push(room(`bath-${floor}`, "卫生间", floor, bathArea, 225, baseY + 120, 50, 90));
    if (r.floors > 1) rooms.push(room(`stair-${floor}`, "楼梯", floor, 8, 280, baseY + 120, 50, 90));
  }
  const satisfaction = [
    { label: "层数与面积", met: template.floors === r.floors && totalArea >= r.areaMin && totalArea <= r.areaMax, detail: `${r.floors} 层 · ${totalArea.toFixed(1)} ㎡` },
    { label: "卧室与卫浴", met: template.bedrooms >= r.bedroomCount, detail: `${r.bedroomCount} 室 · ${r.bathroomCount} 卫` },
    { label: "老人房首层", met: r.elderRoomCount === 0 || r.elderRoomFirstFloor, detail: r.elderRoomCount ? `${r.elderRoomCount} 间首层老人房` : "无老人房要求" },
    { label: "优先需求", met: template.tags.some(tag => r.priorities.includes(tag)), detail: template.tags.join("、") },
  ];
  const plan = { id: template.id, name: template.name, templateId: template.id, score, totalArea, floors: r.floors, footprint, siteFit, rooms, strengths: [`匹配 ${template.tags.join("、")} 偏好`, "主要房间沿外墙布置", "交通面积控制紧凑"], tradeoffs: template.layout === "courtyard" ? ["庭院界面增加造价", "需复核场地退界"] : ["次卧尺度较紧凑", "门窗位置需结合立面深化"], satisfaction, svg: "" };
  return { ...plan, svg: renderPlanSvg(plan) };
}

function room(id: string, name: string, floor: number, area: number, x: number, y: number, width: number, height: number): PlanRoom { return { id, name, floor, area: round(area), x, y, width, height }; }
function polygonBounds(points: Array<{ x: number; y: number }>) { const xs = points.map(p => p.x), ys = points.map(p => p.y); return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) }; }
function pointInPolygon(point: { x: number; y: number }, polygon: Array<{ x: number; y: number }>) { let inside = false; for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) { const a = polygon[i], b = polygon[j]; if (((a.y > point.y) !== (b.y > point.y)) && point.x < (b.x - a.x) * (point.y - a.y) / ((b.y - a.y) || 1) + a.x) inside = !inside; } return inside; }
function avoidsRetainedObjects(footprint: Array<{ x: number; y: number }>, objects: NonNullable<RequirementSubmission["site"]["retainedObjects"]>) { return objects.every(object => { if (object.center && object.radius) return footprint.every(point => Math.hypot(point.x - object.center!.x, point.y - object.center!.y) > object.radius!); if (object.points?.length) return object.points.every(point => !pointInPolygon(point, footprint)) && footprint.every(point => !pointInPolygon(point, object.points!)); return true; }); }
function round(value: number) { return Math.round(value * 10) / 10; }
function escapeXml(value: string) { return value.replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" }[char]!)); }
function renderPlanSvg(plan: Omit<PlanCandidate, "svg">): string {
  const height = plan.floors * 250 + 40;
  const rooms = plan.rooms.map(r => `<g><rect x="${r.x}" y="${r.y + 20}" width="${r.width}" height="${r.height}" fill="${r.name === "客厅" ? "#dce8d5" : r.name === "餐厨" ? "#f2ddc5" : r.name === "老人房" ? "#e8dfcf" : "#f7f4ec"}" stroke="#173d34" stroke-width="2"/><text x="${r.x + r.width / 2}" y="${r.y + 58}" text-anchor="middle" font-size="13" fill="#173d34">${escapeXml(r.name)}</text><text x="${r.x + r.width / 2}" y="${r.y + 77}" text-anchor="middle" font-size="10" fill="#6a7c76">${r.area.toFixed(1)} ㎡</text></g>`).join("");
  const floors = Array.from({ length: plan.floors }, (_, i) => `<text x="345" y="${55 + i * 250}" font-size="12" fill="#a35d3c">${i + 1}F</text>`).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 370 ${height}" role="img" aria-label="${escapeXml(plan.name)}平面图"><rect width="370" height="${height}" fill="#f5f1e8"/>${rooms}${floors}<path d="M350 58v-28m0 0-7 10m7-10 7 10" stroke="#173d34" stroke-width="3" fill="none"/><text x="350" y="22" text-anchor="middle" font-size="12" font-weight="700" fill="#173d34">N</text></svg>`;
}
