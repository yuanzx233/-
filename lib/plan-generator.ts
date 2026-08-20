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
    return { id: room.id, name: room.name, floor: room.floorNumber ?? 1, area: round(room.area * scale * scale), x: box.minX, y: box.minY, width: box.maxX - box.minX, height: box.maxY - box.minY };
  });
  const satisfaction = [
    { label: "成熟模板来源", met: true, detail: `${template.id} · v${template.version}` },
    { label: "层数与面积", met: areaFit, detail: `${template.floors} 层 · ${totalArea.toFixed(1)} ㎡` },
    { label: "卧室数量", met: template.bedrooms >= r.bedroomCount, detail: `${template.bedrooms} 间卧室` },
    { label: "场地硬约束", met: siteFit.fits, detail: siteFit.clearanceNote },
  ];
  const residentialAssessment = assessResidentialQualities(template, r, scale);
  const base = {
    id: template.id, name: template.name, templateId: template.id,
    templateSource: `${template.source.dxfPath} + ${template.source.jsonPath}`,
    adjustment: { rotationDegrees, scale: round(scale) }, score, totalArea, floors: template.floors,
    footprint, siteFit, rooms,
    strengths: residentialAssessment.strengths,
    tradeoffs: residentialAssessment.tradeoffs,
    satisfaction, svg: "",
  } satisfies Omit<PlanCandidate, "svg"> & { svg: string };
  return { ...base, svg: renderTemplateSvg(template, base.name) };
}

function assessResidentialQualities(template: MaturePlanTemplate, requirements: RequirementSubmission["requirements"], scale: number) {
  const rooms = template.rooms.map(room => ({ ...room, adjustedArea: room.area * scale * scale }));
  const count = (prefix: string) => rooms.filter(room => room.type.startsWith(prefix)).length;
  const find = (...types: string[]) => rooms.find(room => types.some(type => room.type === type));
  const bedrooms = count("BED-"); const bathrooms = count("BAT-");
  const living = find("LIV-LIVING", "LIVING"); const dining = find("DIN-DINING", "DINING"); const combined = find("LIV-DIN-COMBINED");
  const master = find("BED-MASTER"); const kitchen = find("KIT-CLOSED"); const study = find("STUDY"); const foyer = find("ENT-FOYER"); const storageCount = count("SER-STORAGE") + count("SER-UTILITY");
  const strengths: string[] = [];
  strengths.push(`${bedrooms}卧${bathrooms}卫配置，满足家庭成员分房与日常卫浴需求`);
  if (combined) strengths.push(`约${combined.adjustedArea.toFixed(1)}㎡一体化客餐厅，公共活动空间开阔、家人互动方便`);
  else if (living && dining) strengths.push(`客厅约${living.adjustedArea.toFixed(1)}㎡、餐厅约${dining.adjustedArea.toFixed(1)}㎡，会客与用餐功能分区明确`);
  if (master && master.adjustedArea >= 16) strengths.push(`主卧约${master.adjustedArea.toFixed(1)}㎡，家具布置和收纳余量较充足`);
  else if (study) strengths.push(`配置约${study.adjustedArea.toFixed(1)}㎡独立书房，可兼顾办公、学习或临时客房`);
  else if (foyer) strengths.push(`设有约${foyer.adjustedArea.toFixed(1)}㎡入口玄关，入户缓冲和鞋物收纳更完整`);
  else if (kitchen && kitchen.adjustedArea >= 8) strengths.push(`厨房约${kitchen.adjustedArea.toFixed(1)}㎡，操作台与储物布置空间较充足`);
  else if (storageCount) strengths.push(`配置${storageCount}处储藏空间，有利于减少公共区域杂物堆放`);

  const tradeoffs: string[] = [];
  if (requirements.elderRoomCount > 0 && !rooms.some(room => room.type === "BED-ELDERLY")) tradeoffs.push("未设置明确的老人房，需结合采光、近卫生间和无障碍要求指定一间卧室");
  if (bathrooms < requirements.bathroomCount) tradeoffs.push(`现有${bathrooms}卫少于需求的${requirements.bathroomCount}卫，需要调整湿区或压缩相邻空间增设`);
  const compactBedroom = rooms.filter(room => room.type.startsWith("BED-")).sort((a, b) => a.adjustedArea - b.adjustedArea)[0];
  if (compactBedroom && compactBedroom.adjustedArea < 11) tradeoffs.push(`最小卧室约${compactBedroom.adjustedArea.toFixed(1)}㎡，双人床、衣柜与通道同时布置会较紧凑`);
  const compactBathroom = rooms.filter(room => room.type.startsWith("BAT-")).sort((a, b) => a.adjustedArea - b.adjustedArea)[0];
  if (compactBathroom && compactBathroom.adjustedArea < 4) tradeoffs.push(`最小卫生间约${compactBathroom.adjustedArea.toFixed(1)}㎡，干湿分离和无障碍使用空间有限`);
  if (!foyer) tradeoffs.push("缺少独立入户玄关，开门后的视线遮挡、鞋柜和换鞋区需要二次设计");
  if (!rooms.some(room => /BALCONY|LAUNDRY/.test(room.type))) tradeoffs.push("未配置独立阳台或家政空间，洗衣、晾晒和设备位置需结合场地补充");
  if (scale !== 1) tradeoffs.push(`方案按${(scale * 100).toFixed(0)}%整体缩放，家具、门洞和结构净尺寸需进一步复核`);
  return { strengths: strengths.slice(0, 3), tradeoffs: tradeoffs.slice(0, 3) };
}

function placePolygon(points: number[][], site: ReturnType<typeof polygonBounds>, rotation: 0 | 90, scale: number): Point[] {
  const source = pairBounds(points); const scx = (source.minX + source.maxX) / 2; const scy = (source.minY + source.maxY) / 2;
  const tcx = (site.minX + site.maxX) / 2; const tcy = (site.minY + site.maxY) / 2;
  return points.map(([x, y]) => { const dx = (x - scx) * scale, dy = (y - scy) * scale; return rotation === 90 ? { x: tcx - dy, y: tcy + dx } : { x: tcx + dx, y: tcy + dy }; });
}

function renderTemplateSvgLegacy(template: MaturePlanTemplate, name: string): string {
  const all = [...template.footprint, ...ancillaryExtentPoints(template)]; const b = pairBounds(all); const pad = 1500; const width = b.maxX - b.minX + pad * 2; const height = b.maxY - b.minY + pad * 2;
  const point = ([x, y]: number[]) => `${x - b.minX + pad},${b.maxY - y + pad}`;
  const rooms = template.rooms.map(room => { const style = roomColorStyle(room); return `<g data-room-category="${style.category}"><polygon points="${room.boundary.map(point).join(" ")}" fill="${style.fill}" stroke="${style.fill}" stroke-width="40" stroke-linejoin="miter"/><text x="${room.labelPoint[0] - b.minX + pad}" y="${b.maxY - room.labelPoint[1] + pad}" text-anchor="middle" font-size="260" fill="#173d34">${escapeXml(room.name)}</text><text x="${room.labelPoint[0] - b.minX + pad}" y="${b.maxY - room.labelPoint[1] + pad + 300}" text-anchor="middle" font-size="190" fill="#657872">${room.area.toFixed(1)} ㎡</text></g>`; }).join("");
  const walls = template.walls.map(wall => `<line x1="${wall.start[0] - b.minX + pad}" y1="${b.maxY - wall.start[1] + pad}" x2="${wall.end[0] - b.minX + pad}" y2="${b.maxY - wall.end[1] + pad}" stroke="#454b49" stroke-width="70" stroke-linecap="square"/>`).join("");
  const openings = template.openings.map(opening => renderOpeningSegment(opening, template.walls, template.rooms, b, pad)).join("");
  const grid = renderAxisGrid(template, b, pad);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeXml(name)}成熟DXF户型及轴网尺寸"><rect width="100%" height="100%" fill="#f5f1e8"/>${grid}${renderAncillaryAreas(template, b, pad)}<polygon data-room-category="service-base" points="${template.footprint.map(point).join(" ")}" fill="#ddd9d0"/>${rooms}${walls}${openings}<polygon points="${template.footprint.map(point).join(" ")}" fill="none" stroke="#454b49" stroke-width="90"/></svg>`;
}

function renderTemplateSvg(template: MaturePlanTemplate, name: string): string {
  const b = pairBounds([...template.displayFootprints.flat(), ...ancillaryExtentPoints(template)]); const pad = 1500; const width = b.maxX - b.minX + pad * 2; const height = b.maxY - b.minY + pad * 2;
  const point = ([x, y]: number[]) => `${x - b.minX + pad},${b.maxY - y + pad}`;
  const rooms = template.rooms.map(room => {
    const center = polygonVisualCenter(room.boundary); const x = center[0] - b.minX + pad; const y = b.maxY - center[1] + pad;
    const style = roomColorStyle(room);
    return `<g data-room-id="${room.id}" data-room-category="${style.category}" data-label-position="visual-center"><polygon points="${room.boundary.map(point).join(" ")}" fill="${style.fill}" stroke="${style.fill}" stroke-width="40" stroke-linejoin="miter"/><text x="${x}" y="${y - 90}" text-anchor="middle" dominant-baseline="middle" font-size="260" fill="#173d34">${escapeXml(room.name)}</text><text x="${x}" y="${y + 190}" text-anchor="middle" dominant-baseline="middle" font-size="190" fill="#657872">${room.area.toFixed(1)} m²</text></g>`;
  }).join("");
  const walls = template.walls.map(wall => `<line x1="${wall.start[0] - b.minX + pad}" y1="${b.maxY - wall.start[1] + pad}" x2="${wall.end[0] - b.minX + pad}" y2="${b.maxY - wall.end[1] + pad}" stroke="#454b49" stroke-width="70" stroke-linecap="square"/>`).join("");
  const openings = template.openings.map(opening => renderOpeningSegment(opening, template.walls, template.rooms, b, pad)).join("");
  const dimensions = renderAxisGrid(template, b, pad);
  const footprints = template.displayFootprints.map((footprint, index) => `<polygon data-floor-footprint="${index + 1}" data-room-category="service-base" points="${footprint.map(point).join(" ")}" fill="#ddd9d0" stroke="#454b49" stroke-width="90"/>`).join("");
  const floorLabels = template.displayFootprints.length > 1 ? template.displayFootprints.map((footprint, index) => { const floorBounds = pairBounds(footprint); return `<text x="${(floorBounds.minX + floorBounds.maxX) / 2 - b.minX + pad}" y="${b.maxY - floorBounds.maxY + pad - 320}" text-anchor="middle" font-size="260" font-weight="700" fill="#173d34">${index + 1}F</text>`; }).join("") : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeXml(name)}成熟DXF户型及总尺寸"><rect width="100%" height="100%" fill="#f5f1e8"/>${dimensions}${renderAncillaryAreas(template, b, pad)}${footprints}${rooms}${walls}${openings}${floorLabels}</svg>`;
}

function ancillaryExtentPoints(template: MaturePlanTemplate): number[][] { return [...template.ancillaryAreas.flatMap(area => area.geometry?.kind === "POLYGON" ? area.geometry.points : area.geometry?.kind === "QUADRATIC_ARC_SEGMENT" ? [area.geometry.chordStart, area.geometry.chordEnd, area.geometry.controlPoint] : []), ...template.exteriorSteps.flatMap(step => step.kind === "LINEAR" ? [...step.treadLines.flat(), ...step.sideLines.flat()] : [...step.sideLines.flat(), ...step.curves.flatMap(curve => [curve.start, curve.end, [(curve.start[0] + curve.end[0] + curve.control[0] * 2) / 4, (curve.start[1] + curve.end[1] + curve.control[1] * 2) / 4] as [number, number]])])]; }

function renderAncillaryAreas(template: MaturePlanTemplate, b: ReturnType<typeof pairBounds>, pad: number): string {
  const screen = ([x, y]: number[]) => [x - b.minX + pad, b.maxY - y + pad] as const;
  const ancillary = template.ancillaryAreas.map(area => {
    if (!area.geometry) return "";
    if (area.geometry.kind === "POLYGON") {
      const center = polygonVisualCenter(area.geometry.points); const [tx, ty] = screen(center);
      const porchColumns = area.type === "PORCH" ? area.geometry.points.slice(1, 3).map(point => { const [x, y] = screen(point); return `<rect x="${x - 100}" y="${y - 100}" width="200" height="200" fill="#454b49"/>`; }).join("") : "";
      return `<g data-ancillary-type="${area.type}" data-area-square-meters="${area.areaM2.toFixed(2)}"><polygon points="${area.geometry.points.map(point => screen(point).join(",")).join(" ")}" fill="#e5dfd2" stroke="#8f826f" stroke-width="55"/>${porchColumns}<text x="${tx}" y="${ty - 70}" text-anchor="middle" font-size="250" fill="#564e43">${escapeXml(area.name)}</text><text x="${tx}" y="${ty + 210}" text-anchor="middle" font-size="180" fill="#746a5b">${area.areaM2.toFixed(2)} m²</text></g>`;
    }
    const start = screen(area.geometry.chordStart), end = screen(area.geometry.chordEnd), control = screen(area.geometry.controlPoint); const tx = (start[0] + end[0] + control[0] * 2) / 4, ty = (start[1] + end[1] + control[1] * 2) / 4;
    const columns = area.type === "PORCH" ? `<rect x="${start[0] - 100}" y="${start[1] - 100}" width="200" height="200" fill="#454b49"/><rect x="${end[0] - 100}" y="${end[1] - 100}" width="200" height="200" fill="#454b49"/>` : "";
    return `<g data-ancillary-type="${area.type}" data-area-square-meters="${area.areaM2.toFixed(2)}"><path d="M ${start[0]} ${start[1]} Q ${control[0]} ${control[1]} ${end[0]} ${end[1]} L ${start[0]} ${start[1]} Z" fill="#eadfc9" stroke="#8f826f" stroke-width="55"/>${columns}<text x="${tx}" y="${ty - 60}" text-anchor="middle" font-size="210" fill="#564e43">${escapeXml(area.name)}</text><text x="${tx}" y="${ty + 180}" text-anchor="middle" font-size="165" fill="#746a5b">${area.areaM2.toFixed(2)} m²</text></g>`;
  }).join("");
  const steps = template.exteriorSteps.map(step => {
    if (step.kind === "CURVED") { const arcs = step.curves.map(curve => { const start = screen(curve.start), end = screen(curve.end), control = screen(curve.control); return `<path data-parallel-tread="true" d="M ${start[0]} ${start[1]} Q ${control[0]} ${control[1]} ${end[0]} ${end[1]}"/>`; }).join(""); const sides = step.sideLines.map(([a, c]) => { const start = screen(a), end = screen(c); return `<line x1="${start[0]}" y1="${start[1]}" x2="${end[0]}" y2="${end[1]}"/>`; }).join(""); return `<g data-ancillary-type="CURVED-EXTERIOR-STEPS" data-tread-layout="parallel" data-area-square-meters="${(step.areaM2 ?? 0).toFixed(2)}" stroke="#9b8d77" stroke-width="48" fill="none">${arcs}${sides}</g>`; }
    const segments = [...step.treadLines, ...step.sideLines]; const lines = segments.map(([a, c]) => { const start = screen(a), end = screen(c); return `<line x1="${start[0]}" y1="${start[1]}" x2="${end[0]}" y2="${end[1]}"/>`; }).join(""); const all = step.treadLines.flat(); const center: [number, number] = [all.reduce((sum, point) => sum + point[0], 0) / all.length, all.reduce((sum, point) => sum + point[1], 0) / all.length]; const [tx, ty] = screen(center); return `<g data-ancillary-type="EXTERIOR-STEPS" data-side-closure="both" stroke="#9b8d77" stroke-width="48" fill="none">${lines}<text x="${tx}" y="${ty - 150}" text-anchor="middle" font-size="185" fill="#62594c" stroke="none">${escapeXml(step.name)}</text></g>`;
  }).join("");
  return ancillary + steps;
}

function roomColorStyle(room: MaturePlanTemplate["rooms"][number]): { category: "private" | "public" | "service"; fill: string } {
  const type = room.type.toUpperCase(); const name = room.name;
  if (type.includes("BED") || type.includes("STUDY") || /卧室|主卧|老人房|书房/.test(name)) return { category: "private", fill: "#dfe8d6" };
  if (type.includes("LIVING") || type.includes("DINING") || type.includes("HALL") || /客厅|餐厅|起居|家庭厅/.test(name)) return { category: "public", fill: "#efe1cc" };
  return { category: "service", fill: "#ddd9d0" };
}

function renderMainEntrance(template: MaturePlanTemplate, b: ReturnType<typeof pairBounds>, pad: number): string {
  const ranked = template.openings.filter(opening => opening.type?.includes("DOOR")).map(opening => {
    const location = opening.insertionPoint ?? opening.position ?? (opening.start && opening.end ? midpoint(opening.start, opening.end) : undefined);
    return location ? { opening, location, distance: distanceToPolygon(location, template.footprint) } : undefined;
  }).filter((item): item is NonNullable<typeof item> => Boolean(item)).sort((a, c) => a.distance - c.distance || (c.opening.width ?? 0) - (a.opening.width ?? 0));
  if (!ranked.length) return "";
  const [x, y] = ranked[0].location; const cx = (b.minX + b.maxX) / 2; const cy = (b.minY + b.maxY) / 2; const dx = x - cx; const dy = y - cy; const length = Math.hypot(dx, dy) || 1;
  const outside: [number, number] = [x + dx / length * 650, y + dy / length * 650]; const sx = x - b.minX + pad; const sy = b.maxY - y + pad; const lx = outside[0] - b.minX + pad; const ly = b.maxY - outside[1] + pad;
  return `<g data-layer="MAIN_ENTRANCE" data-opening-id="${ranked[0].opening.id}"><line x1="${lx}" y1="${ly}" x2="${sx}" y2="${sy}" stroke="#a35532" stroke-width="55"/><path d="M ${sx} ${sy} l -130 -85 l 20 155 z" fill="#a35532"/><text x="${lx}" y="${ly - 90}" text-anchor="middle" font-size="240" font-weight="700" fill="#a35532" paint-order="stroke" stroke="#f5f1e8" stroke-width="70">主入口</text></g>`;
}

function renderOpeningSegment(opening: MaturePlanTemplate["openings"][number], walls: MaturePlanTemplate["walls"], rooms: MaturePlanTemplate["rooms"], b: ReturnType<typeof pairBounds>, pad: number): string {
  let start = opening.start, end = opening.end;
  if ((!start || !end) && opening.insertionPoint) {
    const length = opening.widthMm ?? opening.width ?? inferOpeningWidth(opening, walls) ?? (opening.type.includes("WINDOW") ? 1200 : 900);
    const angle = (opening.rotationDeg ?? 0) * Math.PI / 180; const dx = Math.cos(angle) * length / 2; const dy = Math.sin(angle) * length / 2;
    start = [opening.insertionPoint[0] - dx, opening.insertionPoint[1] - dy]; end = [opening.insertionPoint[0] + dx, opening.insertionPoint[1] + dy];
  }
  if (!start || !end) return "";
  const isWindow = opening.type.includes("WINDOW");
  const length = Math.hypot(end[0] - start[0], end[1] - start[1]);
  const sx = start[0] - b.minX + pad, sy = b.maxY - start[1] + pad;
  const ex = end[0] - b.minX + pad, ey = b.maxY - end[1] + pad;
  if (isWindow) return `<line data-opening-type="window" data-opening-id="${opening.id}" data-opening-length-mm="${Math.round(length)}" x1="${sx}" y1="${sy}" x2="${ex}" y2="${ey}" stroke="#9ebdca" stroke-width="160" stroke-linecap="square"/>`;

  const adjacentRooms = roomsBesideOpening(start, end, rooms);
  const isSlidingDoor = opening.sourceBlock === "$DorLib2D$00000131";
  if (isSlidingDoor) {
    const nx = -(end[1] - start[1]) / length * 52, ny = (end[0] - start[0]) / length * 52;
    const mx1 = sx + (ex - sx) * .58, my1 = sy + (ey - sy) * .58;
    const mx2 = sx + (ex - sx) * .42, my2 = sy + (ey - sy) * .42;
    return `<g data-opening-type="door" data-door-type="sliding" data-source-block="${escapeXml(opening.sourceBlock)}" data-opening-id="${opening.id}" data-opening-length-mm="${Math.round(length)}" stroke="#e2ca7a" fill="none" stroke-width="58" stroke-linecap="square"><line data-sliding-panel="1" x1="${sx + nx}" y1="${sy - ny}" x2="${mx1 + nx}" y2="${my1 - ny}"/><line data-sliding-panel="2" x1="${mx2 - nx}" y1="${my2 + ny}" x2="${ex - nx}" y2="${ey + ny}"/></g>`;
  }

  const swing = chooseInwardWallSide(start, end, adjacentRooms, walls);
  const hinge = swing.hingeAtEnd ? end : start, closed = swing.hingeAtEnd ? start : end;
  const alongX = (closed[0] - hinge[0]) / length, alongY = (closed[1] - hinge[1]) / length;
  const openWorld: [number, number] = [hinge[0] - alongY * length * swing.side, hinge[1] + alongX * length * swing.side];
  const hx = hinge[0] - b.minX + pad, hy = b.maxY - hinge[1] + pad;
  const cx = closed[0] - b.minX + pad, cy = b.maxY - closed[1] + pad;
  const ox = openWorld[0] - b.minX + pad, oy = b.maxY - openWorld[1] + pad;
  const sweep = swing.side > 0 ? 0 : 1;
  return `<g data-opening-type="door" data-door-type="single-swing-inward" data-source-block="${escapeXml(opening.sourceBlock ?? "")}" data-opening-id="${opening.id}" data-opening-length-mm="${Math.round(length)}" stroke="#e2ca7a" fill="none"><line data-door-leaf="true" x1="${hx}" y1="${hy}" x2="${ox}" y2="${oy}" stroke-width="58" stroke-linecap="square"/><path data-door-swing="true" d="M ${cx} ${cy} A ${length} ${length} 0 0 ${sweep} ${ox} ${oy}" stroke-width="38"/></g>`;
}

function roomsBesideOpening(start: number[], end: number[], rooms: MaturePlanTemplate["rooms"]): MaturePlanTemplate["rooms"] {
  const length = Math.hypot(end[0] - start[0], end[1] - start[1]); const midpointX = (start[0] + end[0]) / 2, midpointY = (start[1] + end[1]) / 2;
  const nx = -(end[1] - start[1]) / length, ny = (end[0] - start[0]) / length;
  const samples = [180, 360, 600].flatMap(distance => [[midpointX + nx * distance, midpointY + ny * distance], [midpointX - nx * distance, midpointY - ny * distance]]);
  return rooms.filter(room => samples.some(sample => pointInPairPolygon(sample, room.boundary)));
}

function chooseInwardWallSide(start: number[], end: number[], adjacentRooms: MaturePlanTemplate["rooms"], walls: MaturePlanTemplate["walls"]): { hingeAtEnd: boolean; side: 1 | -1 } {
  const length = Math.hypot(end[0] - start[0], end[1] - start[1]);
  const targetRooms = adjacentRooms.length > 1 ? adjacentRooms.slice().sort((a, b) => a.area - b.area).slice(0, 1) : adjacentRooms;
  const options = ([false, true] as const).flatMap(hingeAtEnd => ([1, -1] as const).map(side => {
    const hinge = hingeAtEnd ? end : start, closed = hingeAtEnd ? start : end; const ax = (closed[0] - hinge[0]) / length, ay = (closed[1] - hinge[1]) / length;
    const open: [number, number] = [hinge[0] - ay * length * side, hinge[1] + ax * length * side]; const probe: [number, number] = [(hinge[0] + open[0]) / 2, (hinge[1] + open[1]) / 2];
    const inward = targetRooms.length === 0 || targetRooms.some(room => pointInPairPolygon(probe, room.boundary));
    const wallDistance = Math.min(...walls.map(wall => distanceToSegment(open, wall.start, wall.end)));
    return { hingeAtEnd, side, score: (inward ? 100000 : 0) - wallDistance };
  }));
  return options.sort((a, b) => b.score - a.score)[0];
}

function inferOpeningWidth(opening: MaturePlanTemplate["openings"][number], walls: MaturePlanTemplate["walls"]): number | undefined {
  if (!opening.insertionPoint) return undefined;
  const angle = (opening.rotationDeg ?? 0) * Math.PI / 180; const along: [number, number] = [Math.cos(angle), Math.sin(angle)]; const normal: [number, number] = [-along[1], along[0]]; const origin = opening.insertionPoint;
  const candidates = walls.map(wall => { const vx = wall.end[0] - wall.start[0], vy = wall.end[1] - wall.start[1], wallLength = Math.hypot(vx, vy); if (!wallLength || Math.abs((vx * along[0] + vy * along[1]) / wallLength) < .98) return undefined; const offset = Math.abs((wall.start[0] - origin[0]) * normal[0] + (wall.start[1] - origin[1]) * normal[1]); const projections = [wall.start, wall.end].map(point => (point[0] - origin[0]) * along[0] + (point[1] - origin[1]) * along[1]).sort((a, b) => a - b); return { offset, start: projections[0], end: projections[1] }; }).filter((item): item is NonNullable<typeof item> => Boolean(item));
  const nearestOffset = Math.min(...candidates.map(item => item.offset)); const intervals = candidates.filter(item => item.offset <= nearestOffset + 40); const before = Math.max(...intervals.filter(item => item.end <= 50).map(item => item.end), -Infinity); const after = Math.min(...intervals.filter(item => item.start >= -50).map(item => item.start), Infinity); const gap = after - before;
  return Number.isFinite(gap) && gap >= 500 && gap <= 3600 ? gap : undefined;
}

function polygonVisualCenter(polygon: number[][]): [number, number] {
  const centroid = polygonCentroid(polygon); if (pointInPairPolygon(centroid, polygon)) return centroid;
  const b = pairBounds(polygon); const boxCenter: [number, number] = [(b.minX + b.maxX) / 2, (b.minY + b.maxY) / 2]; if (pointInPairPolygon(boxCenter, polygon)) return boxCenter;
  let best = polygon[0] as [number, number], bestDistance = -1;
  for (let row = 1; row < 20; row++) for (let column = 1; column < 20; column++) { const candidate: [number, number] = [b.minX + (b.maxX - b.minX) * column / 20, b.minY + (b.maxY - b.minY) * row / 20]; if (!pointInPairPolygon(candidate, polygon)) continue; const distance = distanceToPolygon(candidate, polygon); if (distance > bestDistance) { best = candidate; bestDistance = distance; } }
  return best;
}

function polygonCentroid(points: number[][]): [number, number] { let areaTwice = 0, x = 0, y = 0; for (let i = 0, j = points.length - 1; i < points.length; j = i++) { const cross = points[j][0] * points[i][1] - points[i][0] * points[j][1]; areaTwice += cross; x += (points[j][0] + points[i][0]) * cross; y += (points[j][1] + points[i][1]) * cross; } if (Math.abs(areaTwice) < 1e-6) { const b = pairBounds(points); return [(b.minX + b.maxX) / 2, (b.minY + b.maxY) / 2]; } return [x / (3 * areaTwice), y / (3 * areaTwice)]; }
function midpoint(a: number[], b: number[]): [number, number] { return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]; }
function pointInPairPolygon(point: number[], polygon: number[][]) { return pointInPolygon({ x: point[0], y: point[1] }, polygon.map(([x, y]) => ({ x, y }))); }
function distanceToPolygon(point: number[], polygon: number[][]) { let result = Infinity; for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) result = Math.min(result, distanceToSegment(point, polygon[j], polygon[i])); return result; }
function distanceToSegment(point: number[], a: number[], b: number[]) { const dx = b[0] - a[0], dy = b[1] - a[1], denominator = dx * dx + dy * dy; const t = denominator ? Math.max(0, Math.min(1, ((point[0] - a[0]) * dx + (point[1] - a[1]) * dy) / denominator)) : 0; return Math.hypot(point[0] - (a[0] + t * dx), point[1] - (a[1] + t * dy)); }

function renderAxisGrid(template: MaturePlanTemplate, b: ReturnType<typeof pairBounds>, pad: number): string {
  const xs = uniqueCoordinates(template.footprint.map(point => point[0]));
  const ys = uniqueCoordinates(template.footprint.map(point => point[1]));
  const xScreen = (x: number) => x - b.minX + pad;
  const yScreen = (y: number) => b.maxY - y + pad;
  const footprintBounds = pairBounds(template.footprint); const top = yScreen(footprintBounds.maxY), bottom = yScreen(footprintBounds.minY), left = xScreen(footprintBounds.minX), right = xScreen(footprintBounds.maxX);
  const axisStyle = `stroke="#789089" stroke-width="22" stroke-dasharray="120 90"`;
  const axesX = xs.map((x, i) => `<g data-axis="${i + 1}"><line x1="${xScreen(x)}" y1="${top - 450}" x2="${xScreen(x)}" y2="${bottom + 350}" ${axisStyle}/><circle cx="${xScreen(x)}" cy="${top - 650}" r="190" fill="#fffdf8" stroke="#173d34" stroke-width="28"/><text x="${xScreen(x)}" y="${top - 585}" text-anchor="middle" font-size="210" font-weight="700" fill="#173d34">${i + 1}</text></g>`).join("");
  const axesY = ys.slice().reverse().map((y, i) => { const label = String.fromCharCode(65 + i); return `<g data-axis="${label}"><line x1="${left - 350}" y1="${yScreen(y)}" x2="${right + 350}" y2="${yScreen(y)}" ${axisStyle}/><circle cx="${left - 650}" cy="${yScreen(y)}" r="190" fill="#fffdf8" stroke="#173d34" stroke-width="28"/><text x="${left - 650}" y="${yScreen(y) + 70}" text-anchor="middle" font-size="210" font-weight="700" fill="#173d34">${label}</text></g>`; }).join("");
  const xDims = xs.slice(1).map((x, i) => dimensionHorizontal(xScreen(xs[i]), xScreen(x), top - 1050, formatMillimeters(x - xs[i]))).join("");
  const yAscending = ys.slice().sort((a, b) => a - b);
  const yDims = yAscending.slice(1).map((y, i) => dimensionVertical(right + 720, yScreen(yAscending[i]), yScreen(y), formatMillimeters(y - yAscending[i]))).join("");
  const overallX = dimensionHorizontal(left, right, top - 1370, `总宽 ${formatMillimeters(b.maxX - b.minX)}`);
  const overallY = dimensionVertical(right + 1120, bottom, top, `总深 ${formatMillimeters(b.maxY - b.minY)}`);
  return `<g data-layer="OVERALL_DIMENSIONS">${overallX}${overallY}</g>`;
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
