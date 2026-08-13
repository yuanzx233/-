import type { RequirementSubmission } from "./requirements";
import { projectPlanTemplateLibrary, type MaturePlanTemplate } from "./plan-template-library";

type Point = { x: number; y: number };
export type PlanRoom = { id: string; name: string; floor: number; area: number; x: number; y: number; width: number; height: number };
export type PlanCandidate = {
  id: string; name: string; templateId: string; templateSource: string;
  adjustment: { rotationDegrees: 0 | 90; scale: number }; score: number; totalArea: number; floors: number;
  footprint: Point[]; siteFit: { fits: boolean; basis: "buildable" | "boundary"; coveragePercent: number; clearanceNote: string };
  rooms: PlanRoom[]; strengths: string[]; tradeoffs: string[];
  satisfaction: Array<{ label: string; met: boolean; detail: string }>; svg: string;
};

export const planTemplates = projectPlanTemplateLibrary;

export function generatePlanCandidates(input: RequirementSubmission): PlanCandidate[] {
  const available = input.site.buildablePoints?.length ? input.site.buildablePoints : input.site.boundaryPoints;
  if (!available?.length) throw new Error("SITE_GEOMETRY_REQUIRED");
  const bounds = polygonBounds(available);
  const availableArea = input.site.buildableAreaSquareMeters ?? input.site.areaSquareMeters;
  return planTemplates
    .filter(template => template.status === "APPROVED" && template.floors === input.requirements.floors && template.bedrooms >= input.requirements.bedroomCount)
    .flatMap(template => bestPlacement(template, input, available, bounds, availableArea))
    .filter(plan => plan.siteFit.fits && plan.totalArea >= input.requirements.areaMin && plan.totalArea <= input.requirements.areaMax)
    .sort((a, b) => b.score - a.score).slice(0, 3)
    .map((plan, index) => ({ ...plan, id: `P${index + 1}`, name: `方案 ${String.fromCharCode(65 + index)} · ${plan.name}` }));
}

function bestPlacement(template: MaturePlanTemplate, input: RequirementSubmission, available: Point[], bounds: ReturnType<typeof polygonBounds>, availableArea: number): PlanCandidate[] {
  const variants = ([0, 90] as const).flatMap(rotation => [.95, 1, 1.05].map(scale => buildCandidate(template, input, available, bounds, availableArea, rotation, scale)));
  const best = variants.filter(item => item.siteFit.fits).sort((a, b) => b.score - a.score)[0];
  return best ? [best] : [];
}

function buildCandidate(template: MaturePlanTemplate, input: RequirementSubmission, available: Point[], siteBounds: ReturnType<typeof polygonBounds>, availableArea: number, rotationDegrees: 0 | 90, scale: number): PlanCandidate {
  const r = input.requirements;
  const footprint = placePolygon(template.footprint, siteBounds, rotationDegrees, scale);
  const totalArea = round(template.area * scale * scale);
  const within = footprint.every(point => pointInPolygon(point, available));
  const avoids = avoidsRetainedObjects(footprint, input.site.retainedObjects ?? []);
  const coveragePercent = round(totalArea / availableArea * 100);
  const capacity = coveragePercent <= 80;
  const areaFit = totalArea >= r.areaMin && totalArea <= r.areaMax;
  const priorityFit = r.priorities.filter(item => template.tags.includes(item)).length / Math.max(1, r.priorities.length);
  const score = round(55 + priorityFit * 15 + (areaFit ? 20 : 0) + (scale === 1 ? 10 : 7));
  const siteFit = {
    fits: within && avoids && capacity,
    basis: input.site.buildablePoints?.length ? "buildable" as const : "boundary" as const,
    coveragePercent,
    clearanceNote: !within ? "成熟模板轮廓超出可建设边界" : !avoids ? "成熟模板轮廓占用保留对象" : !capacity ? "首层占地超过可建设面积 80%" : "成熟模板完整位于可建设范围内",
  };
  const rooms: PlanRoom[] = template.rooms.map(room => {
    const box = pairBounds(room.boundary);
    return { id: room.id, name: room.name, floor: 1, area: round(room.area * scale * scale), x: box.minX, y: box.minY, width: box.maxX - box.minX, height: box.maxY - box.minY };
  });
  const satisfaction = [
    { label: "成熟模板来源", met: true, detail: `${template.id} · v${template.version}` },
    { label: "层数与面积", met: areaFit, detail: `${template.floors} 层 · ${totalArea.toFixed(1)} ㎡` },
    { label: "卧室数量", met: template.bedrooms >= r.bedroomCount, detail: `${template.bedrooms} 间卧室` },
    { label: "场地硬约束", met: siteFit.fits, detail: siteFit.clearanceNote },
  ];
  const base = {
    id: template.id, name: template.name, templateId: template.id,
    templateSource: `${template.source.dxfPath} + ${template.source.jsonPath}`,
    adjustment: { rotationDegrees, scale: round(scale) }, score, totalArea, floors: template.floors,
    footprint, siteFit, rooms,
    strengths: ["直接采用已审核标准化 DXF", "保留原始墙体、门窗与房间关系", `整体调正：旋转 ${rotationDegrees}°、比例 ${(scale * 100).toFixed(0)}%`],
    tradeoffs: scale === 1 ? ["未改变成熟模板内部布局"] : ["进行了有限整体比例调整，施工前需复核构造尺寸"],
    satisfaction, svg: "",
  } satisfies Omit<PlanCandidate, "svg"> & { svg: string };
  return { ...base, svg: renderTemplateSvg(template, base.name) };
}

function placePolygon(points: number[][], site: ReturnType<typeof polygonBounds>, rotation: 0 | 90, scale: number): Point[] {
  const source = pairBounds(points); const scx = (source.minX + source.maxX) / 2; const scy = (source.minY + source.maxY) / 2;
  const tcx = (site.minX + site.maxX) / 2; const tcy = (site.minY + site.maxY) / 2;
  return points.map(([x, y]) => { const dx = (x - scx) * scale, dy = (y - scy) * scale; return rotation === 90 ? { x: tcx - dy, y: tcy + dx } : { x: tcx + dx, y: tcy + dy }; });
}

function renderTemplateSvg(template: MaturePlanTemplate, name: string): string {
  const all = template.footprint; const b = pairBounds(all); const pad = 1500; const width = b.maxX - b.minX + pad * 2; const height = b.maxY - b.minY + pad * 2;
  const point = ([x, y]: number[]) => `${x - b.minX + pad},${b.maxY - y + pad}`;
  const rooms = template.rooms.map((room, index) => `<g><polygon points="${room.boundary.map(point).join(" ")}" fill="${["#e3eadb", "#f1e2cf", "#e4ded3", "#dce8d5"][index % 4]}" stroke="#8ca099" stroke-width="24"/><text x="${room.labelPoint[0] - b.minX + pad}" y="${b.maxY - room.labelPoint[1] + pad}" text-anchor="middle" font-size="260" fill="#173d34">${escapeXml(room.name)}</text><text x="${room.labelPoint[0] - b.minX + pad}" y="${b.maxY - room.labelPoint[1] + pad + 300}" text-anchor="middle" font-size="190" fill="#657872">${room.area.toFixed(1)} ㎡</text></g>`).join("");
  const walls = template.walls.map(wall => `<line x1="${wall.start[0] - b.minX + pad}" y1="${b.maxY - wall.start[1] + pad}" x2="${wall.end[0] - b.minX + pad}" y2="${b.maxY - wall.end[1] + pad}" stroke="#173d34" stroke-width="70" stroke-linecap="square"/>`).join("");
  const openings = template.openings.map(opening => opening.start && opening.end ? `<line x1="${opening.start[0] - b.minX + pad}" y1="${b.maxY - opening.start[1] + pad}" x2="${opening.end[0] - b.minX + pad}" y2="${b.maxY - opening.end[1] + pad}" stroke="${opening.type?.includes("WINDOW") ? "#4e8ca0" : "#b87550"}" stroke-width="100"/>` : "").join("");
  const grid = renderAxisGrid(template, b, pad);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeXml(name)}成熟DXF户型及轴网尺寸"><rect width="100%" height="100%" fill="#f5f1e8"/>${grid}${rooms}${walls}${openings}<polygon points="${template.footprint.map(point).join(" ")}" fill="none" stroke="#173d34" stroke-width="90"/></svg>`;
}

function renderAxisGrid(template: MaturePlanTemplate, b: ReturnType<typeof pairBounds>, pad: number): string {
  const xs = uniqueCoordinates(template.footprint.map(point => point[0]));
  const ys = uniqueCoordinates(template.footprint.map(point => point[1]));
  const xScreen = (x: number) => x - b.minX + pad;
  const yScreen = (y: number) => b.maxY - y + pad;
  const top = pad, bottom = b.maxY - b.minY + pad, left = pad, right = b.maxX - b.minX + pad;
  const axisStyle = `stroke="#789089" stroke-width="22" stroke-dasharray="120 90"`;
  const axesX = xs.map((x, i) => `<g data-axis="${i + 1}"><line x1="${xScreen(x)}" y1="${top - 450}" x2="${xScreen(x)}" y2="${bottom + 350}" ${axisStyle}/><circle cx="${xScreen(x)}" cy="${top - 650}" r="190" fill="#fffdf8" stroke="#173d34" stroke-width="28"/><text x="${xScreen(x)}" y="${top - 585}" text-anchor="middle" font-size="210" font-weight="700" fill="#173d34">${i + 1}</text></g>`).join("");
  const axesY = ys.slice().reverse().map((y, i) => { const label = String.fromCharCode(65 + i); return `<g data-axis="${label}"><line x1="${left - 350}" y1="${yScreen(y)}" x2="${right + 350}" y2="${yScreen(y)}" ${axisStyle}/><circle cx="${left - 650}" cy="${yScreen(y)}" r="190" fill="#fffdf8" stroke="#173d34" stroke-width="28"/><text x="${left - 650}" y="${yScreen(y) + 70}" text-anchor="middle" font-size="210" font-weight="700" fill="#173d34">${label}</text></g>`; }).join("");
  const xDims = xs.slice(1).map((x, i) => dimensionHorizontal(xScreen(xs[i]), xScreen(x), top - 1050, formatMillimeters(x - xs[i]))).join("");
  const yAscending = ys.slice().sort((a, b) => a - b);
  const yDims = yAscending.slice(1).map((y, i) => dimensionVertical(right + 720, yScreen(yAscending[i]), yScreen(y), formatMillimeters(y - yAscending[i]))).join("");
  const overallX = dimensionHorizontal(left, right, top - 1370, `总宽 ${formatMillimeters(b.maxX - b.minX)}`);
  const overallY = dimensionVertical(right + 1120, bottom, top, `总深 ${formatMillimeters(b.maxY - b.minY)}`);
  return `<g data-layer="AXIS_GRID">${axesX}${axesY}</g><g data-layer="GRID_DIMENSIONS">${xDims}${yDims}${overallX}${overallY}</g>`;
}

function dimensionHorizontal(x1: number, x2: number, y: number, label: string) { return `<g><line x1="${x1}" y1="${y}" x2="${x2}" y2="${y}" stroke="#536b64" stroke-width="24"/><line x1="${x1}" y1="${y - 90}" x2="${x1}" y2="${y + 90}" stroke="#536b64" stroke-width="24"/><line x1="${x2}" y1="${y - 90}" x2="${x2}" y2="${y + 90}" stroke="#536b64" stroke-width="24"/><text x="${(x1 + x2) / 2}" y="${y - 110}" text-anchor="middle" font-size="190" fill="#173d34">${label}</text></g>`; }
function dimensionVertical(x: number, y1: number, y2: number, label: string) { const top = Math.min(y1, y2), bottom = Math.max(y1, y2); return `<g><line x1="${x}" y1="${top}" x2="${x}" y2="${bottom}" stroke="#536b64" stroke-width="24"/><line x1="${x - 90}" y1="${top}" x2="${x + 90}" y2="${top}" stroke="#536b64" stroke-width="24"/><line x1="${x - 90}" y1="${bottom}" x2="${x + 90}" y2="${bottom}" stroke="#536b64" stroke-width="24"/><text x="${x + 150}" y="${(top + bottom) / 2}" transform="rotate(90 ${x + 150} ${(top + bottom) / 2})" text-anchor="middle" font-size="190" fill="#173d34">${label}</text></g>`; }
function uniqueCoordinates(values: number[]) { return [...new Set(values.map(value => Math.round(value)))].sort((a, b) => a - b); }
function formatMillimeters(value: number) { return `${(value / 1000).toFixed(1)} m`; }

function pairBounds(points: number[][]) { const xs = points.map(p => p[0]), ys = points.map(p => p[1]); return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) }; }
function polygonBounds(points: Point[]) { const xs = points.map(p => p.x), ys = points.map(p => p.y); return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) }; }
function pointInPolygon(point: Point, polygon: Point[]) { let inside = false; for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) { const a = polygon[i], b = polygon[j]; if (((a.y > point.y) !== (b.y > point.y)) && point.x < (b.x - a.x) * (point.y - a.y) / ((b.y - a.y) || 1) + a.x) inside = !inside; } return inside; }
function avoidsRetainedObjects(footprint: Point[], objects: NonNullable<RequirementSubmission["site"]["retainedObjects"]>) { return objects.every(object => { if (object.center && object.radius) return footprint.every(point => Math.hypot(point.x - object.center!.x, point.y - object.center!.y) > object.radius!); if (object.points?.length) return object.points.every(point => !pointInPolygon(point, footprint)) && footprint.every(point => !pointInPolygon(point, object.points!)); return true; }); }
function round(value: number) { return Math.round(value * 10) / 10; }
function escapeXml(value: string) { return value.replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" }[char]!)); }
