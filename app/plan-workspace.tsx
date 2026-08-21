"use client";

import { useMemo, useState } from "react";
import type { PlanCandidate } from "../lib/plan-generator";
import { architecturalStyles, colorOptions, materialOptions, roofOptions, type StyleSelection } from "../lib/style-brief";
import { RenderGallery } from "./render-gallery";

export function PlanWorkspace({ projectId, authHeaders, onConfirmed }: { projectId: string; authHeaders: Record<string, string>; onConfirmed: () => void }) {
  const [plans, setPlans] = useState<PlanCandidate[]>([]);
  const [selected, setSelected] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [planVersionId, setPlanVersionId] = useState("");
  const [styleSaved, setStyleSaved] = useState(false);
  const [renderTaskId, setRenderTaskId] = useState("");
  const [style, setStyle] = useState<StyleSelection>({ architecturalStyle: architecturalStyles[0], materials: [materialOptions[0]], colorScheme: colorOptions[0], roofType: roofOptions[0], referenceImage: "", notes: "" });

  async function generate() {
    setLoading(true); setError(""); setConfirmed(false);
    try {
      const response = await fetch(`/api/projects/${projectId}/plans`, { method: "POST", headers: { "content-type": "application/json", ...authHeaders }, body: JSON.stringify({ action: "generate" }) });
      const payload = await response.json() as { plans?: PlanCandidate[]; error?: string; message?: string };
      if (!response.ok || !payload.plans) throw new Error(payload.message ?? payload.error ?? "方案生成失败");
      setPlans(payload.plans); setSelected(payload.plans[0]?.id ?? ""); setPlanVersionId((payload as { version?: { id: string } }).version?.id ?? "");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "方案生成失败"); }
    finally { setLoading(false); }
  }

  async function confirm() {
    if (!selected) return; setLoading(true);
    try {
      const response = await fetch(`/api/projects/${projectId}/plans`, { method: "POST", headers: { "content-type": "application/json", ...authHeaders }, body: JSON.stringify({ action: "confirm", planId: selected }) });
      const payload = await response.json() as { planVersionId?: string; error?: string };
      if (!response.ok) throw new Error(payload.error ?? "方案确认失败"); setPlanVersionId(payload.planVersionId ?? planVersionId); setConfirmed(true); onConfirmed();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "方案确认失败"); }
    finally { setLoading(false); }
  }

  const active = plans.find((plan) => plan.id === selected);
  const comparisonRows = useMemo(() => [
    { label: "建筑面积", values: plans.map(plan => `${plan.totalArea.toFixed(1)} ㎡`) },
    { label: "首层占地率", values: plans.map(plan => `${plan.siteFit.coveragePercent.toFixed(1)}%`) },
    { label: "需求匹配度", values: plans.map(plan => `${plan.score.toFixed(1)}%`) },
    { label: "卧室 / 卫生间", values: plans.map(plan => `${plan.rooms.filter(room => room.name.includes("卧") || room.name.includes("主卧")).length} / ${plan.rooms.filter(room => room.name.includes("卫生间")).length}`) },
    { label: "需求满足项", values: plans.map(plan => `${plan.satisfaction.filter(item => item.met).length}/${plan.satisfaction.length}`) },
  ], [plans]);

  function toggleMaterial(material: string) {
    setStyle(current => ({ ...current, materials: current.materials.includes(material) ? current.materials.filter(item => item !== material) : current.materials.length < 3 ? [...current.materials, material] : current.materials }));
  }

  async function submitStyle() {
    if (!planVersionId) return; setLoading(true); setError("");
    try {
      const response = await fetch(`/api/projects/${projectId}/plans`, { method: "POST", headers: { "content-type": "application/json", ...authHeaders }, body: JSON.stringify({ action: "style", planVersionId, style }) });
      const payload = await response.json() as { error?: string; errors?: string[]; task?: { id: string } };
      if (!response.ok) throw new Error(payload.errors?.join("；") ?? payload.error ?? "风格保存失败");
      setStyleSaved(true); setRenderTaskId(payload.task?.id ?? ""); onConfirmed();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "风格保存失败"); }
    finally { setLoading(false); }
  }
  return <section className="plan-workspace" id="plans">
    <div className="cad-heading"><div><p className="eyebrow">DAY 6 · 方案对比与风格选择</p><h2>比较成熟方案，锁定平面并建立建筑风格</h2></div><button className="submit-button plan-generate" type="button" disabled={loading || confirmed} onClick={() => void generate()}>{confirmed ? "平面版本已锁定" : loading ? "正在生成…" : plans.length ? "重新匹配方案" : "生成候选方案"}</button></div>
    {error && <p className="error-banner">{error}</p>}
    {!plans.length && <div className="plan-empty"><strong>需求已保存，可以开始匹配</strong><p>直接读取已审核模板的标准化 DXF 与 template.json，保留原始墙体、门窗和房间关系；若没有成熟模板满足需求，系统不会临时拼装户型。</p></div>}
    {plans.length > 0 && <><div className="plan-list">{plans.map((plan) => <button type="button" key={plan.id} className={`plan-card ${selected === plan.id ? "active" : ""}`} onClick={() => !confirmed && setSelected(plan.id)}><span className="plan-rank">{plan.id}</span><div dangerouslySetInnerHTML={{ __html: plan.svg }} /><strong>{plan.name}</strong><span>{plan.totalArea.toFixed(1)} ㎡ · {plan.floors} 层</span><em>匹配度 {plan.score.toFixed(1)}% · 场地校验通过</em></button>)}</div>
      <section className="plan-compare"><div className="section-heading"><div><p className="eyebrow">多方案对比</p><h3>面积指标与需求满足度</h3></div><span>同一场地条件下横向比较</span></div><div className="comparison-grid"><strong>指标</strong>{plans.map(plan => <strong key={plan.id}>{plan.id} · {plan.name.split("·").at(-1)}</strong>)}{comparisonRows.flatMap(row => [<span className="comparison-label" key={`${row.label}-label`}>{row.label}</span>, ...row.values.map((value, index) => <span key={`${row.label}-${plans[index]?.id}`}>{value}</span>)])}</div></section>
      {active && <section className="plan-detail"><div className="plan-detail-preview" dangerouslySetInnerHTML={{ __html: active.svg }} /><div className="plan-detail-copy"><p className="eyebrow">{active.templateId} · 方案详情</p><h3>{active.name}</h3><div className="site-fit-banner"><strong>✓ 场地条件通过</strong><span>{active.siteFit.clearanceNote} · 首层占地率 {active.siteFit.coveragePercent.toFixed(1)}%</span></div><div className="plan-satisfaction">{active.satisfaction.map((item) => <span className={item.met ? "met" : "partial"} key={item.label}><b>{item.met ? "✓" : "△"} {item.label}</b><small>{item.detail}</small></span>)}</div><div className="plan-pros-cons"><div><strong>优点</strong><ul>{active.strengths.map((item) => <li key={item}>{item}</li>)}</ul></div><div><strong>取舍</strong><ul>{active.tradeoffs.map((item) => <li key={item}>{item}</li>)}</ul></div></div><table><thead><tr><th>房间</th><th>楼层</th><th>面积</th></tr></thead><tbody>{active.rooms.map((room) => <tr key={room.id}><td>{room.name}</td><td>{room.floor}F</td><td>{room.area.toFixed(1)} ㎡</td></tr>)}</tbody></table><button className="submit-button" type="button" disabled={loading || confirmed} onClick={() => void confirm()}>{confirmed ? "已确认当前方案" : "确认此方案"}</button></div></section>}
      {confirmed && active && <section className="style-workspace"><div className="section-heading"><div><p className="eyebrow">已锁定 · {active.id}</p><h3>选择建筑风格与效果图参数</h3></div><span className="lock-badge">🔒 平面几何不可变</span></div><div className="style-grid"><label>建筑风格<select value={style.architecturalStyle} onChange={event => setStyle({ ...style, architecturalStyle: event.target.value })}>{architecturalStyles.map(item => <option key={item}>{item}</option>)}</select></label><label>主色方案<select value={style.colorScheme} onChange={event => setStyle({ ...style, colorScheme: event.target.value })}>{colorOptions.map(item => <option key={item}>{item}</option>)}</select></label><label>屋顶形式<select value={style.roofType} onChange={event => setStyle({ ...style, roofType: event.target.value })}>{roofOptions.map(item => <option key={item}>{item}</option>)}</select></label><label>参考图链接<input type="url" placeholder="可选：粘贴参考图片链接" value={style.referenceImage} onChange={event => setStyle({ ...style, referenceImage: event.target.value })} /></label></div><fieldset className="material-picker"><legend>外立面材质（最多 3 种）</legend><div>{materialOptions.map(item => <button type="button" className={style.materials.includes(item) ? "active" : ""} key={item} onClick={() => toggleMaterial(item)}>{item}</button>)}</div></fieldset><label className="wide-field">补充要求<textarea value={style.notes} placeholder="例如：入口雨棚轻薄，控制玻璃面积，适合南方多雨气候" onChange={event => setStyle({ ...style, notes: event.target.value })} /></label><div className="style-submit"><p>提交后将建立 STYLE 版本，并把锁定平面、风格、材质、颜色、屋顶和参考图组装为下游效果图任务参数。</p><button className="submit-button" type="button" disabled={loading || styleSaved || !style.materials.length} onClick={() => void submitStyle()}>{styleSaved ? "已关联效果图任务" : "保存风格并创建效果图任务"}</button></div></section>}
      {renderTaskId && <RenderGallery projectId={projectId} authHeaders={authHeaders} initialTaskId={renderTaskId} onConfirmed={onConfirmed} />}
    </>}
  </section>;
}
