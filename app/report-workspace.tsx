"use client";
import { useState } from "react";

export function ReportWorkspace({ projectId, authHeaders }: { projectId: string; authHeaders: Record<string,string> }) {
  const [loading,setLoading]=useState(false); const [error,setError]=useState(""); const [qa,setQa]=useState("");
  async function generate(){ setLoading(true);setError("");setQa(""); try { const response=await fetch(`/api/projects/${projectId}/report`,{headers:authHeaders}); if(!response.ok) throw new Error("方案 HTML 生成失败"); const html=await response.text(); const blob=new Blob([html],{type:"text/html;charset=utf-8"}); const url=URL.createObjectURL(blob); const link=document.createElement("a");link.href=url;link.download=`筑想家-方案报告.html`;link.click(); setTimeout(()=>URL.revokeObjectURL(url),30000); setQa(`已生成 ${response.headers.get("x-report-sections") || 14} 个固定章节 · 指标一致性${response.headers.get("x-report-metrics-consistent") === "true" ? "通过" : "需复核"}`); } catch(cause){setError(cause instanceof Error?cause.message:"生成失败")} finally{setLoading(false)} }
  return <section className="report-workspace" id="report"><div><p className="eyebrow">方案文档 · HTML</p><h3>生成完整方案报告</h3><p>固定封面、概况、需求、CAD、场地分析、策略、总平面、楼层平面、指标、风格、效果图、总结、风险和封底，并自动检查版式与指标。</p>{qa&&<span className="report-qa">✓ {qa}</span>}{error&&<span className="report-error">{error}</span>}</div><button className="submit-button" type="button" disabled={loading} onClick={()=>void generate()}>{loading?"正在汇总项目数据…":"生成并下载方案 HTML"}</button></section>;
}
