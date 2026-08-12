"use client";

import { FormEvent, useMemo, useState } from "react";
import {
  type Direction,
  type HousingRequirements,
  priorityOptions,
  type RequirementSubmission,
  type ValidationIssue,
  validateRequirementSubmission,
} from "../lib/requirements";
import { PlanWorkspace } from "./plan-workspace";

type SiteResult = { areaSquareMeters: number; perimeterMeters: number; boundaryPoints?: Array<{ x: number; y: number }>; buildablePoints?: Array<{ x: number; y: number }>; buildableAreaSquareMeters?: number; retainedObjects?: Array<{ type: string; points?: Array<{ x: number; y: number }>; center?: { x: number; y: number }; radius?: number }> };
type Props = {
  projectId: string;
  siteResult: SiteResult;
  initialRoadDirection: string;
  authHeaders: Record<string, string>;
  onSaved: () => void;
};

const directions: Direction[] = ["东", "南", "西", "北"];
const initialRequirements: HousingRequirements = {
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
  notes: "",
};

export function RequirementsWorkspace({ projectId, siteResult, initialRoadDirection, authHeaders, onSaved }: Props) {
  const safeRoad = directions.includes(initialRoadDirection as Direction) ? initialRoadDirection as Direction : "南";
  const [northDirection, setNorthDirection] = useState<Direction>("北");
  const [entranceDirection, setEntranceDirection] = useState<Direction>(safeRoad);
  const [roadDirections, setRoadDirections] = useState<Direction[]>([safeRoad]);
  const [boundaryConfirmed, setBoundaryConfirmed] = useState(false);
  const [requirements, setRequirements] = useState(initialRequirements);
  const [issues, setIssues] = useState<ValidationIssue[]>([]);
  const [saving, setSaving] = useState(false);
  const [savedVersion, setSavedVersion] = useState<number | null>(null);
  const [serverError, setServerError] = useState("");

  const submission = useMemo<RequirementSubmission>(() => ({
    site: { northDirection, entranceDirection, roadDirections, boundaryConfirmed, ...siteResult },
    requirements,
  }), [northDirection, entranceDirection, roadDirections, boundaryConfirmed, siteResult, requirements]);

  function updateNumber(field: keyof HousingRequirements, value: string) {
    setRequirements((current) => ({ ...current, [field]: Number(value) }));
  }

  function toggleRoad(direction: Direction) {
    setRoadDirections((current) => current.includes(direction) ? current.filter((item) => item !== direction) : [...current, direction]);
  }

  function togglePriority(priority: string) {
    setRequirements((current) => ({
      ...current,
      priorities: current.priorities.includes(priority)
        ? current.priorities.filter((item) => item !== priority)
        : [...current.priorities, priority],
    }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setServerError("");
    setSavedVersion(null);
    const nextIssues = validateRequirementSubmission(submission);
    setIssues(nextIssues);
    if (nextIssues.length) return document.querySelector("#requirement-errors")?.scrollIntoView({ behavior: "smooth", block: "center" });
    setSaving(true);
    try {
      const response = await fetch(`/api/projects/${projectId}/requirements`, {
        method: "POST",
        headers: { "content-type": "application/json", ...authHeaders },
        body: JSON.stringify(submission),
      });
      const payload = await response.json() as { version?: { sequence: number }; issues?: ValidationIssue[]; error?: string };
      if (!response.ok || !payload.version) {
        if (payload.issues) setIssues(payload.issues);
        throw new Error(payload.error ?? "提交失败");
      }
      setSavedVersion(payload.version.sequence);
      setIssues([]);
      onSaved();
    } catch (error) {
      setServerError(error instanceof Error ? error.message : "提交失败，请稍后重试。");
    } finally {
      setSaving(false);
    }
  }

  return (<>
    <section className="requirements-workspace" id="requirements">
      <div className="cad-heading">
        <div><p className="eyebrow">DAY 4 · 场地确认与户型需求</p><h2>先确认地块，再说清楚一家人的生活</h2></div>
        <span className="support-pill">保存为项目版本 · 可追溯</span>
      </div>
      <form onSubmit={submit}>
        <div className="requirements-grid">
          <section className="form-card">
            <div className="step-title"><span>01</span><div><strong>确认场地分析</strong><small>解析结果：{siteResult.areaSquareMeters} m² · 周长 {siteResult.perimeterMeters} m</small></div></div>
            <div className="field-grid">
              <label>图纸北向<select value={northDirection} onChange={(event) => setNorthDirection(event.target.value as Direction)}>{directions.map((item) => <option key={item}>{item}</option>)}</select></label>
              <label>主入口方向<select value={entranceDirection} onChange={(event) => setEntranceDirection(event.target.value as Direction)}>{directions.map((item) => <option key={item}>{item}</option>)}</select></label>
            </div>
            <fieldset className="choice-field"><legend>临路方向（可多选）</legend><div>{directions.map((item) => <label className={roadDirections.includes(item) ? "choice active" : "choice"} key={item}><input type="checkbox" checked={roadDirections.includes(item)} onChange={() => toggleRoad(item)} />{item}侧</label>)}</div></fieldset>
            <label className="confirm-box"><input type="checkbox" checked={boundaryConfirmed} onChange={(event) => setBoundaryConfirmed(event.target.checked)} /><span><strong>我已核对场地边界</strong><small>轮廓、面积和主要尺寸与 CAD 原图一致</small></span></label>
          </section>

          <section className="form-card">
            <div className="step-title"><span>02</span><div><strong>家庭与总体规模</strong><small>系统将依据场地容量进行概念预检</small></div></div>
            <div className="field-grid triple">
              <NumberField label="建筑层数" value={requirements.floors} min={1} max={3} onChange={(value) => updateNumber("floors", value)} />
              <NumberField label="居住人数" value={requirements.householdSize} min={1} max={20} onChange={(value) => updateNumber("householdSize", value)} />
              <NumberField label="卧室数量" value={requirements.bedroomCount} min={1} max={12} onChange={(value) => updateNumber("bedroomCount", value)} />
              <NumberField label="面积下限（m²）" value={requirements.areaMin} min={40} max={1000} onChange={(value) => updateNumber("areaMin", value)} />
              <NumberField label="面积上限（m²）" value={requirements.areaMax} min={40} max={1000} onChange={(value) => updateNumber("areaMax", value)} />
              <NumberField label="卫生间数量" value={requirements.bathroomCount} min={1} max={8} onChange={(value) => updateNumber("bathroomCount", value)} />
              <NumberField label="楼梯数量" value={requirements.stairCount} min={0} max={3} onChange={(value) => updateNumber("stairCount", value)} />
              <NumberField label="老人房数量" value={requirements.elderRoomCount} min={0} max={4} onChange={(value) => updateNumber("elderRoomCount", value)} />
            </div>
            <label className="confirm-box compact"><input type="checkbox" checked={requirements.elderRoomFirstFloor} onChange={(event) => setRequirements((current) => ({ ...current, elderRoomFirstFloor: event.target.checked }))} /><span><strong>老人房安排在首层</strong><small>减少日常上下楼，满足基础适老要求</small></span></label>
          </section>

          <section className="form-card wide-card">
            <div className="step-title"><span>03</span><div><strong>房间面积与优先级</strong><small>填写可以接受的单间最小使用面积</small></div></div>
            <div className="field-grid five">
              <NumberField label="卧室 ≥ m²" value={requirements.minBedroomArea} min={8} max={60} step="0.5" onChange={(value) => updateNumber("minBedroomArea", value)} />
              <NumberField label="老人房 ≥ m²" value={requirements.minElderRoomArea} min={10} max={60} step="0.5" onChange={(value) => updateNumber("minElderRoomArea", value)} />
              <NumberField label="客厅 ≥ m²" value={requirements.minLivingArea} min={15} max={100} step="0.5" onChange={(value) => updateNumber("minLivingArea", value)} />
              <NumberField label="厨房 ≥ m²" value={requirements.minKitchenArea} min={5} max={40} step="0.5" onChange={(value) => updateNumber("minKitchenArea", value)} />
              <NumberField label="卫生间 ≥ m²" value={requirements.minBathroomArea} min={3} max={30} step="0.5" onChange={(value) => updateNumber("minBathroomArea", value)} />
            </div>
            <fieldset className="choice-field priority-field"><legend>最高优先级（最多 3 项）</legend><div>{priorityOptions.map((item, index) => <label className={requirements.priorities.includes(item) ? "choice active" : "choice"} key={item}><input type="checkbox" checked={requirements.priorities.includes(item)} onChange={() => togglePriority(item)} />{requirements.priorities.includes(item) ? `${requirements.priorities.indexOf(item) + 1}. ` : ""}{item}</label>)}</div></fieldset>
            <label className="wide-field">补充需求<textarea maxLength={500} rows={3} placeholder="例如：厨房靠近餐厅；二层需要朝南露台；保留一辆车停车位。" value={requirements.notes} onChange={(event) => setRequirements((current) => ({ ...current, notes: event.target.value }))} /></label>
          </section>
        </div>

        {issues.length ? <div className="validation-summary" id="requirement-errors"><strong>还有 {issues.length} 项需要调整</strong><ul>{issues.map((issue, index) => <li key={`${issue.field}-${index}`}>{issue.message}</li>)}</ul></div> : null}
        {serverError ? <p className="error-banner">{serverError}</p> : null}
        {savedVersion ? <div className="success-panel"><strong>需求已提交</strong><span>已保存为项目版本 V{savedVersion}，可以进入平面方案阶段。</span></div> : null}
        <div className="requirement-submit"><span>提交前将再次校验面积、房间下限、老人房楼层及卧卫楼梯数量。</span><button className="submit-button" disabled={saving} type="submit">{saving ? "正在保存…" : "确认场地并提交需求"}</button></div>
      </form>
    </section>
    {savedVersion ? <PlanWorkspace projectId={projectId} authHeaders={authHeaders} onConfirmed={onSaved} /> : null}
    </>
  );
}

function NumberField({ label, value, min, max, step = "1", onChange }: { label: string; value: number; min: number; max: number; step?: string; onChange: (value: string) => void }) {
  return <label>{label}<input type="number" value={value} min={min} max={max} step={step} onChange={(event) => onChange(event.target.value)} /></label>;
}
