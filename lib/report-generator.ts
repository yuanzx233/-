export type ReportImage = { label: string; src: string };
export type ReportInput = {
  project: { name: string; address?: string | null; updatedAt: string };
  site?: Record<string, any>;
  requirements?: Record<string, any>;
  plan?: Record<string, any>;
  style?: Record<string, any>;
  renders: ReportImage[];
};

const h = (value: unknown) => String(value ?? "—").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]!));
const n = (value: unknown, digits = 1) => Number.isFinite(Number(value)) ? Number(value).toFixed(digits) : "—";

export function generateProjectReportHtml(input: ReportInput) {
  const boundary = input.site?.boundary ?? {};
  const analysis = input.site?.siteAnalysis ?? {};
  const selectedId = input.plan?.selectedPlanId;
  const plans = Array.isArray(input.plan?.plans) ? input.plan!.plans : [];
  const selected = plans.find((plan: any) => plan.id === selectedId) ?? plans[0];
  const rooms = Array.isArray(selected?.rooms) ? selected.rooms : [];
  const roomArea = rooms.reduce((sum: number, room: any) => sum + Number(room.area || 0), 0);
  const planArea = Number(selected?.totalArea || roomArea || 0);
  const areaDelta = Math.abs(planArea - roomArea);
  const metricsConsistent = !rooms.length || areaDelta <= Math.max(1, planArea * .02);
  const siteSvg = input.site?.previewSvg || "";
  const planSvg = selected?.svg || "";
  const styles = input.style?.style ?? input.style ?? {};
  const needs = input.requirements?.requirements ?? input.requirements ?? {};
  const floorGroups = rooms.reduce((groups: Record<string, any[]>, room: any) => { const floor = `${room.floor || 1}F`; (groups[floor] ??= []).push(room); return groups; }, {});
  const imageCards = input.renders.length ? input.renders.map(image => `<figure class="report-image"><img src="${h(image.src)}" alt="${h(image.label)}"/><figcaption>${h(image.label)}</figcaption></figure>`).join("") : `<div class="missing">尚未确认建筑效果图</div>`;
  const page = (key: string, title: string, body: string, cls = "") => `<section class="report-page ${cls}" data-section="${key}"><header><span>筑想家 · 自建房概念方案</span><b>${h(input.project.name)}</b></header><div class="page-body"><p class="chapter">${h(title)}</p>${body}</div><footer><span>${h(input.project.address || "项目地址待补充")}</span><span class="page-no"></span></footer></section>`;
  const html = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>${h(input.project.name)} · 方案报告</title><style>
  :root{--ink:#173d34;--terra:#b8734f;--paper:#f4f0e7;--line:#cdd4cb;--muted:#64766f}*{box-sizing:border-box}html,body{margin:0;background:#d8d8d2;color:var(--ink);font-family:"Microsoft YaHei","Noto Sans SC",sans-serif}.report{counter-reset:page}.report-page{counter-increment:page;width:min(1120px,100%);min-height:790px;margin:24px auto;background:#fffdf8;padding:34px 46px 28px;display:grid;grid-template-rows:auto 1fr auto;overflow:hidden;break-after:page;box-shadow:0 8px 30px #0002}.report-page header,.report-page footer{display:flex;justify-content:space-between;gap:20px;color:var(--muted);font-size:13px}.report-page header{border-bottom:1px solid var(--line);padding-bottom:12px}.report-page footer{border-top:1px solid var(--line);padding-top:12px}.page-no:after{content:counter(page,decimal-leading-zero)}.page-body{min-width:0;padding:34px 0 24px}.chapter{margin:0 0 22px;color:var(--terra);font-weight:800;letter-spacing:.16em}.cover{background:var(--ink);color:#fff}.cover header,.cover footer{color:#dbe4df;border-color:#ffffff40}.cover .page-body{display:flex;flex-direction:column;justify-content:center}.cover h1{font-family:Georgia,"Songti SC",serif;font-size:64px;line-height:1.12;margin:0 0 28px;max-width:850px}.cover .subtitle{font-size:24px;color:#ecd8c8}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}.metric,.card{border:1px solid var(--line);padding:18px;background:#f7f8f3;min-width:0}.metric small,.card small{display:block;color:var(--muted);margin-bottom:7px}.metric strong{font-size:30px}.two{display:grid;grid-template-columns:1fr 1fr;gap:22px}.visual{height:560px;border:1px solid var(--line);background:var(--paper);display:flex;align-items:center;justify-content:center;overflow:hidden}.visual svg{width:100%;height:100%;max-width:100%;max-height:100%}.report-image{margin:0;border:1px solid var(--line);background:var(--paper);overflow:hidden}.report-image img{display:block;width:100%;height:300px;object-fit:cover}.report-image figcaption{padding:10px 14px}.image-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:16px}.room-table{width:100%;border-collapse:collapse;font-size:14px}.room-table th,.room-table td{padding:10px;border-bottom:1px solid var(--line);text-align:left}.pill{display:inline-block;border:1px solid var(--line);padding:8px 12px;margin:0 8px 8px 0}.prose{font-size:20px;line-height:1.9;max-width:850px}.risk{border-left:5px solid var(--terra);padding:14px 18px;background:#f8eee8;margin:12px 0}.missing{padding:70px;text-align:center;border:1px dashed var(--line);color:var(--muted)}@media print{body{background:#fff}.report-page{width:297mm;height:210mm;min-height:0;margin:0;box-shadow:none}}@media(max-width:760px){.report-page{min-height:auto;margin:0 0 12px;padding:24px}.cover h1{font-size:42px}.grid,.two,.image-grid{grid-template-columns:1fr}.visual{height:420px}}
  </style></head><body><main class="report">
  ${page("cover","方案封面",`<h1>${h(input.project.name)}<br/>自建房建筑概念方案</h1><p class="subtitle">从场地解析、成熟平面匹配到建筑外观方向</p><p>生成日期 · ${h(new Date(input.project.updatedAt).toLocaleDateString("zh-CN"))}</p>`,"cover")}
  ${page("overview","项目概况",`<div class="grid"><div class="metric"><small>项目名称</small><strong>${h(input.project.name)}</strong></div><div class="metric"><small>项目地址</small><strong>${h(input.project.address)}</strong></div><div class="metric"><small>报告状态</small><strong>概念方案</strong></div></div><p class="prose">本报告汇总已确认的场地、需求、平面版本、建筑风格与效果图，用于方案沟通和方向确认。</p>`)}
  ${page("requirements","户型需求",`<div class="grid"><div class="metric"><small>层数</small><strong>${h(needs.floors)}</strong></div><div class="metric"><small>卧室 / 卫生间</small><strong>${h(needs.bedroomCount)} / ${h(needs.bathroomCount)}</strong></div><div class="metric"><small>面积范围</small><strong>${n(needs.areaMin)}–${n(needs.areaMax)} ㎡</strong></div></div><p class="prose">设计优先满足场地硬约束、房间数量、首层适老需求及主要空间邻接关系。优先项：${h((needs.priorities || []).join("、"))}。</p>`)}
  ${page("cad","原始 CAD",siteSvg?`<div class="visual">${siteSvg}</div>`:`<div class="missing">尚无可展示的 CAD 场地预览</div>`)}
  ${page("site","场地分析",`<div class="grid"><div class="metric"><small>用地面积</small><strong>${n(boundary.areaSquareMeters)} ㎡</strong></div><div class="metric"><small>周长</small><strong>${n(boundary.perimeterMeters)} m</strong></div><div class="metric"><small>北向</small><strong>${n(analysis.northAngleDegrees)}°</strong></div></div><div class="two"><div class="card"><small>临路条件</small><b>${h((analysis.roadSides||[]).join("、") || "待确认")}</b></div><div class="card"><small>入口方向</small><b>${h(analysis.entranceSide || "待确认")}</b></div></div>`)}
  ${page("strategy","设计策略",`<p class="prose">采用“先满足场地，再匹配成熟模板”的策略：建筑轮廓必须完整落入可建设范围；保留对象与控制线作为硬约束；入口、采光与公共空间组织作为评分条件。</p><div class="grid"><div class="card">场地约束优先</div><div class="card">成熟户型匹配</div><div class="card">版本锁定追溯</div></div>`)}
  ${page("master-plan","总平面",planSvg?`<div class="visual">${planSvg}</div>`:`<div class="missing">尚未锁定平面方案</div>`)}
  ${page("floor-plans","楼层平面",planSvg?`<div class="visual">${planSvg}</div><p>${h(Object.keys(floorGroups).join("、") || "楼层信息待确认")}</p>`:`<div class="missing">尚未生成楼层平面</div>`)}
  ${page("metrics","面积指标",`<div class="grid"><div class="metric"><small>建筑面积</small><strong>${n(planArea)} ㎡</strong></div><div class="metric"><small>房间面积合计</small><strong>${n(roomArea)} ㎡</strong></div><div class="metric"><small>指标一致性</small><strong>${metricsConsistent?"通过":"需复核"}</strong></div></div><table class="room-table"><thead><tr><th>房间</th><th>楼层</th><th>面积</th></tr></thead><tbody>${rooms.map((room:any)=>`<tr><td>${h(room.name)}</td><td>${h(room.floor||1)}F</td><td>${n(room.area)} ㎡</td></tr>`).join("")}</tbody></table>`)}
  ${page("style","建筑风格",`<div class="grid"><div class="metric"><small>风格</small><strong>${h(styles.architecturalStyle)}</strong></div><div class="metric"><small>屋顶</small><strong>${h(styles.roofType)}</strong></div><div class="metric"><small>色彩</small><strong>${h(styles.colorScheme)}</strong></div></div><p>${(styles.materials||[]).map((item:string)=>`<span class="pill">${h(item)}</span>`).join("")}</p>`)}
  ${page("renders","建筑效果图",`<div class="image-grid">${imageCards}</div>`)}
  ${page("summary","方案总结",`<p class="prose">当前方案以已确认场地和锁定平面为基础，形成明确的建筑体量、空间组织与外观方向。建议下一阶段结合结构、机电、节能及当地报建要求深化。</p>`)}
  ${page("risks","风险与复核",`<div class="risk">本成果用于前期概念沟通，不可直接作为施工图、报建图或结构安全依据。</div><div class="risk">场地边界、道路、退界、高程和现状障碍物应由专业人员现场复核。</div><div class="risk">面积指标一致性：${metricsConsistent?"自动检查通过":"存在差异，请人工复核"}。</div>`)}
  ${page("back-cover","封底",`<div class="cover page-body"><h1>让场地、需求与家的想象<br/>在同一份方案里对齐。</h1><p class="subtitle">筑想家 · 自建房智能方案</p></div>`,"cover")}
  </main><script>const qa={overflow:[],distorted:[],sections:document.querySelectorAll('[data-section]').length,metricsConsistent:${metricsConsistent}};document.querySelectorAll('.report-page').forEach((page,i)=>{if(page.scrollHeight>page.clientHeight+2||page.scrollWidth>page.clientWidth+2)qa.overflow.push(i+1)});document.querySelectorAll('img').forEach((img,i)=>{img.addEventListener('load',()=>{const box=img.getBoundingClientRect();if(!img.naturalWidth||!img.naturalHeight||box.width/box.height<.5||box.width/box.height>2.5)qa.distorted.push(i+1)})});window.__REPORT_QA__=qa;</script></body></html>`;
  return { html, qa: { sectionCount: 14, metricsConsistent, areaDelta: Number(areaDelta.toFixed(1)) } };
}
