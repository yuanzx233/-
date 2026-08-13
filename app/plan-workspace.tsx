"use client";

import { useState } from "react";
import type { PlanCandidate } from "../lib/plan-generator";

export function PlanWorkspace({ projectId, authHeaders, onConfirmed }: { projectId: string; authHeaders: Record<string, string>; onConfirmed: () => void }) {
  const [plans, setPlans] = useState<PlanCandidate[]>([]);
  const [selected, setSelected] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [confirmed, setConfirmed] = useState(false);

  async function generate() {
    setLoading(true); setError(""); setConfirmed(false);
    try {
      const response = await fetch(`/api/projects/${projectId}/plans`, { method: "POST", headers: { "content-type": "application/json", ...authHeaders }, body: JSON.stringify({ action: "generate" }) });
      const payload = await response.json() as { plans?: PlanCandidate[]; error?: string; message?: string };
      if (!response.ok || !payload.plans) throw new Error(payload.message ?? payload.error ?? "方案生成失败");
      setPlans(payload.plans); setSelected(payload.plans[0]?.id ?? "");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "方案生成失败"); }
    finally { setLoading(false); }
  }

  async function confirm() {
    if (!selected) return; setLoading(true);
    try {
      const response = await fetch(`/api/projects/${projectId}/plans`, { method: "POST", headers: { "content-type": "application/json", ...authHeaders }, body: JSON.stringify({ action: "confirm", planId: selected }) });
      if (!response.ok) throw new Error("方案确认失败"); setConfirmed(true); onConfirmed();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "方案确认失败"); }
    finally { setLoading(false); }
  }

  const active = plans.find((plan) => plan.id === selected);
  return <section className="plan-workspace" id="plans">
    <div className="cad-heading"><div><p className="eyebrow">DAY 5 · 平面方案生成</p><h2>从项目资源库匹配模板，并按场地调正后生成 3 套</h2></div><button className="submit-button plan-generate" type="button" disabled={loading} onClick={() => void generate()}>{loading ? "正在生成…" : plans.length ? "重新匹配方案" : "生成候选方案"}</button></div>
    {error && <p className="error-banner">{error}</p>}
    {!plans.length && <div className="plan-empty"><strong>需求已保存，可以开始匹配</strong><p>从项目资源库读取既有模板，按场地旋转、缩放和居中调正；通过边界、控制线、占地率及保留对象校验后再评分。</p></div>}
    {plans.length > 0 && <><div className="plan-list">{plans.map((plan) => <button type="button" key={plan.id} className={`plan-card ${selected === plan.id ? "active" : ""}`} onClick={() => setSelected(plan.id)}><span className="plan-rank">{plan.id}</span><div dangerouslySetInnerHTML={{ __html: plan.svg }} /><strong>{plan.name}</strong><span>{plan.totalArea.toFixed(1)} ㎡ · {plan.floors} 层</span><em>匹配度 {plan.score.toFixed(1)}% · 场地校验通过</em></button>)}</div>
      {active && <section className="plan-detail"><div className="plan-detail-preview" dangerouslySetInnerHTML={{ __html: active.svg }} /><div className="plan-detail-copy"><p className="eyebrow">{active.templateId} · 方案详情</p><h3>{active.name}</h3><div className="site-fit-banner"><strong>✓ 场地条件通过</strong><span>{active.siteFit.clearanceNote} · 首层占地率 {active.siteFit.coveragePercent.toFixed(1)}%</span></div><div className="plan-satisfaction">{active.satisfaction.map((item) => <span className={item.met ? "met" : "partial"} key={item.label}><b>{item.met ? "✓" : "△"} {item.label}</b><small>{item.detail}</small></span>)}</div><div className="plan-pros-cons"><div><strong>优点</strong><ul>{active.strengths.map((item) => <li key={item}>{item}</li>)}</ul></div><div><strong>取舍</strong><ul>{active.tradeoffs.map((item) => <li key={item}>{item}</li>)}</ul></div></div><table><thead><tr><th>房间</th><th>楼层</th><th>面积</th></tr></thead><tbody>{active.rooms.map((room) => <tr key={room.id}><td>{room.name}</td><td>{room.floor}F</td><td>{room.area.toFixed(1)} ㎡</td></tr>)}</tbody></table><button className="submit-button" type="button" disabled={loading || confirmed} onClick={() => void confirm()}>{confirmed ? "已确认当前方案" : "确认此方案"}</button></div></section>}
    </>}
  </section>;
}
