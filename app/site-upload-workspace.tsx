"use client";

import { ChangeEvent, useEffect, useRef, useState } from "react";
import { RequirementsWorkspace } from "./requirements-workspace";

type ProjectOption = { id: string; name: string; address: string | null };
type BoundaryResult = {
  areaSquareMeters: number;
  perimeterMeters: number;
  sideLengthsMeters: number[];
  sideAnglesDegrees: number[];
  majorDimensionsMeters: { width: number; height: number };
  majorDirectionDegrees: number;
};
type SiteAnalysis = {
  roadSides: Array<"north" | "east" | "south" | "west">;
  roadWidthMeters: number | null;
  roads: Array<{ side: "north" | "east" | "south" | "west"; widthMeters: number }>;
  entranceSide: "north" | "east" | "south" | "west" | null;
  entranceWidthMeters: number | null;
  entranceSegment: { start: { x: number; y: number }; end: { x: number; y: number } } | null;
  northAngleDegrees: number | null;
  northDetected: boolean;
};
type ExistingObject = { id: string; type: "building" | "tree" | "water" | "wall"; label: string; defaultAction: "keep" | "remove" | "ignore"; areaSquareMeters?: number; widthMeters?: number };
type TerrainAnalysis = { contourCount: number; contourElevationsMeters: number[]; elevationPoints: Array<{ elevationMeters: number }>; minimumElevationMeters: number | null; maximumElevationMeters: number | null; elevationDifferenceMeters: number | null; slopeDirection: "north_high_south_low" | "south_high_north_low" | "undetermined"; warnings: string[]; manualReviewRequired: boolean };
type ParseResult = { model: { boundary: BoundaryResult; buildableArea: { areaSquareMeters: number; perimeterMeters: number; setbacksMeters: Record<"north" | "east" | "south" | "west", number> } | null; existingObjects: ExistingObject[]; terrainAnalysis: TerrainAnalysis; siteAnalysis: SiteAnalysis; previewSvg: string; sourceUnit: string } };
const sideChinese = { north: "北", east: "东", south: "南", west: "西" } as const;

const errorMessages: Record<string, string> = {
  DXF_FILE_TYPE_INVALID: "请选择扩展名为 .dxf 的 ASCII DXF 文件。",
  DXF_FILE_EMPTY: "文件为空，请重新从 CAD 软件导出。",
  DXF_UNIT_REQUIRED: "DXF 未声明绘图单位，请在“CAD 绘图单位”中手动确认后重试。",
  DXF_UNIT_INVALID: "绘图单位无效，请重新选择。",
  DXF_INVALID_STRUCTURE: "文件结构不完整，可能已损坏或不是标准 DXF。",
  DXF_BINARY_UNSUPPORTED: "暂不支持二进制 DXF，请另存为 ASCII DXF 后重试。",
  DXF_GROUP_PAIR_MISMATCH: "DXF 数据不完整，请重新导出文件。",
  DXF_INVALID_GROUP_CODE: "DXF 包含无法识别的数据组，可能已经损坏。",
  DXF_INVALID_COORDINATE: "DXF 中存在无效坐标，请检查 CAD 图形。",
  DXF_NO_SUPPORTED_ENTITIES: "未找到线段或多段线。请检查 DXF 实体是否完整。",
  DXF_BOUNDARY_NOT_CLOSED: "未识别到闭合地块。请在 CAD 中闭合场地多段线。",
  DXF_MULTIPLE_BOUNDARIES: "识别到多个闭合地块。请只保留一个 SITE_BOUNDARY 边界。",
  DXF_SCALE_OUT_OF_RANGE: "换算后的地块尺寸异常，请检查所选单位或 CAD 比例。",
  UPLOAD_SIZE_MISMATCH: "上传文件大小与登记信息不一致，请重试。",
};

export function SiteUploadWorkspace({ projects, authHeaders, onProjectUpdated }: { projects: ProjectOption[]; authHeaders: Record<string, string>; onProjectUpdated: () => void }) {
  const [projectId, setProjectId] = useState("");
  const [unit, setUnit] = useState<"auto" | "mm" | "cm" | "m">("auto");
  const [detectedUnit, setDetectedUnit] = useState<"mm" | "cm" | "m" | null>(null);
  const [roadDirection, setRoadDirection] = useState("南");
  const [roadWidth, setRoadWidth] = useState("6.0");
  const [note, setNote] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState<"idle" | "uploading" | "parsing" | "done" | "error">("idle");
  const [message, setMessage] = useState("");
  const [result, setResult] = useState<ParseResult | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!projectId && projects[0]) setProjectId(projects[0].id);
    if (projectId && !projects.some((project) => project.id === projectId)) setProjectId(projects[0]?.id ?? "");
  }, [projectId, projects]);

  function chooseFile(event: ChangeEvent<HTMLInputElement>) {
    const next = event.target.files?.[0] ?? null;
    setResult(null);
    setDetectedUnit(null);
    setMessage("");
    setProgress(0);
    if (!next) return setFile(null);
    if (!next.name.toLowerCase().endsWith(".dxf")) {
      setFile(null);
      setPhase("error");
      return setMessage(errorMessages.DXF_FILE_TYPE_INVALID);
    }
    if (!next.size || next.size > 50 * 1024 * 1024) {
      setFile(null);
      setPhase("error");
      return setMessage(next.size ? "DXF 文件不能超过 50 MB。" : errorMessages.DXF_FILE_EMPTY);
    }
    setFile(next);
    setPhase("idle");
  }

  async function startUpload() {
    if (!projectId) return fail("请先创建并选择一个项目。");
    if (!file) return fail("请选择要解析的 DXF 文件。");
    setResult(null);
    setMessage("");
    setProgress(0);
    setPhase("uploading");
    try {
      const credentialResponse = await fetch("/api/uploads/credentials", {
        method: "POST",
        headers: { "content-type": "application/json", ...authHeaders },
        body: JSON.stringify({
          projectId,
          fileName: file.name,
          contentType: file.type || "application/octet-stream",
          size: file.size,
          sourceUnit: unit === "auto" ? undefined : unit,
          siteInfo: { roadDirection, roadWidthMeters: Number(roadWidth) || 0, note: note.trim() },
        }),
      });
      const credentialPayload = await credentialResponse.json() as { credential?: { uploadUrl: string; fileId: string }; error?: string };
      if (!credentialResponse.ok || !credentialPayload.credential) throw new Error(credentialPayload.error ?? "UPLOAD_CREDENTIAL_FAILED");
      await uploadWithProgress(credentialPayload.credential.uploadUrl, file, setProgress);
      setPhase("parsing");
      const parseResponse = await fetch(`/api/files/${credentialPayload.credential.fileId}/parse`, { method: "POST", headers: authHeaders });
      const parsePayload = await parseResponse.json() as ParseResult & { error?: string };
      if (!parseResponse.ok) throw new Error(parsePayload.error ?? "DXF_PARSE_FAILED");
      const detectedRoads = parsePayload.model.siteAnalysis.roadSides;
      if (detectedRoads.length === 1) setRoadDirection(sideChinese[detectedRoads[0]]);
      if (detectedRoads.length > 1) setRoadDirection("多面临路");
      if (parsePayload.model.siteAnalysis.roadWidthMeters !== null) setRoadWidth(formatMetric(parsePayload.model.siteAnalysis.roadWidthMeters));
      if (["mm", "cm", "m"].includes(parsePayload.model.sourceUnit)) setDetectedUnit(parsePayload.model.sourceUnit as "mm" | "cm" | "m");
      setResult(parsePayload);
      setProgress(100);
      setPhase("done");
      setMessage("场地解析完成，坐标已统一为毫米。下一步请核对轮廓和尺寸。");
    } catch (error) {
      fail(toReadableError(error));
    }
  }

  function fail(text: string) {
    setPhase("error");
    setMessage(text);
  }

  return (<>
    <section className="cad-workspace" id="cad-upload">
      <div className="cad-heading">
        <div><p className="eyebrow">DAY 3 · CAD 上传与场地解析</p><h2>把 CAD 地块变成可核对的场地数据</h2></div>
        <span className="support-pill">ASCII DXF · 最大 50 MB</span>
      </div>
      <div className="cad-grid">
        <div className="upload-card">
          <div className="field-grid">
            <label>所属项目<select value={projectId} onChange={(event) => setProjectId(event.target.value)} disabled={!projects.length}><option value="">请先创建项目</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select></label>
            <label>CAD 绘图单位<select value={unit} onChange={(event) => { setUnit(event.target.value as "auto" | "mm" | "cm" | "m"); setDetectedUnit(null); }}><option value="auto">自动读取 DXF（推荐）</option><option value="mm">手动指定：毫米（mm）</option><option value="cm">手动指定：厘米（cm）</option><option value="m">手动指定：米（m）</option></select><small className="unit-hint">{detectedUnit ? `已从文件识别：${unitName(detectedUnit)}` : unit === "auto" ? "优先读取文件中的 $INSUNITS；缺失时会要求确认" : `将覆盖文件声明，按${unitName(unit)}重新计算`}</small></label>
            <label>临路方向<select value={roadDirection} onChange={(event) => setRoadDirection(event.target.value)}>{["东", "南", "西", "北", "多面临路"].map((item) => <option key={item}>{item}</option>)}</select></label>
            <label>主要道路宽度（米）<input type="number" min="0" max="100" step="0.1" value={roadWidth} onChange={(event) => setRoadWidth(event.target.value)} /></label>
          </div>
          <label className="wide-field">场地备注<input maxLength={160} placeholder="例如：北侧邻宅，西南角有古树" value={note} onChange={(event) => setNote(event.target.value)} /></label>
          <button className="drop-zone" type="button" onClick={() => inputRef.current?.click()}>
            <input ref={inputRef} hidden type="file" accept=".dxf,application/dxf,application/x-dxf,text/plain" onChange={chooseFile} />
            <span className="drop-icon">DXF</span><strong>{file ? file.name : "选择标准 DXF 文件"}</strong><small>{file ? `${(file.size / 1024).toFixed(1)} KB · 点击可更换` : "建议将地块闭合多段线放在 SITE_BOUNDARY 图层"}</small>
          </button>
          {(phase === "uploading" || phase === "parsing") && <div className="upload-progress"><div style={{ width: `${phase === "parsing" ? 100 : progress}%` }} /><span>{phase === "parsing" ? "上传完成，正在识别闭合边界…" : `正在上传 ${progress}%`}</span></div>}
          {message && <p className={phase === "error" ? "cad-message error" : "cad-message success"}>{message}</p>}
          <button className="submit-button" type="button" disabled={phase === "uploading" || phase === "parsing" || !projects.length} onClick={() => void startUpload()}>{phase === "error" ? "重新上传并解析" : phase === "uploading" || phase === "parsing" ? "处理中…" : "上传并解析场地"}</button>
        </div>
        <div className="preview-card">
          {result ? <ResultView result={result} /> : <div className="preview-empty"><span>⌗</span><strong>等待场地文件</strong><p>解析后将在这里显示闭合轮廓、面积、周长和每条边的长度。</p></div>}
        </div>
      </div>
    </section>
    {result && projectId ? <RequirementsWorkspace projectId={projectId} siteResult={{ areaSquareMeters: result.model.boundary.areaSquareMeters, perimeterMeters: result.model.boundary.perimeterMeters }} initialRoadDirection={result.model.siteAnalysis.roadSides[0] ? sideChinese[result.model.siteAnalysis.roadSides[0]] : roadDirection} authHeaders={authHeaders} onSaved={onProjectUpdated} /> : null}
  </>);
}

function ResultView({ result }: { result: ParseResult }) {
  const boundary = result.model.boundary;
  const analysis = result.model.siteAnalysis;
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [objectActions, setObjectActions] = useState<Record<string, "keep" | "remove" | "ignore">>({});
  useEffect(() => {
    setObjectActions(Object.fromEntries((result.model.existingObjects ?? []).map((object) => [object.id, object.defaultAction])));
  }, [result.model.existingObjects]);
  useEffect(() => {
    if (!isPreviewOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsPreviewOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [isPreviewOpen]);
  return <>
    <div className="preview-top"><div><small>场地轮廓</small><strong>{formatMetric(boundary.majorDimensionsMeters.width)} × {formatMetric(boundary.majorDimensionsMeters.height)} m</strong></div><button className="quiet-button" type="button" onClick={() => void downloadPng(result.model.previewSvg)}>下载 PNG</button></div>
    <button className="svg-preview preview-zoom-trigger" type="button" aria-label="放大查看场地轮廓图" onClick={() => setIsPreviewOpen(true)}>
      <span className="preview-zoom-hint">点击放大</span>
      <span className="preview-svg-content" dangerouslySetInnerHTML={{ __html: result.model.previewSvg }} />
    </button>
    {isPreviewOpen && <div className="preview-lightbox" role="dialog" aria-modal="true" aria-label="场地轮廓放大图" onMouseDown={(event) => { if (event.target === event.currentTarget) setIsPreviewOpen(false); }}>
      <div className="preview-lightbox-panel">
        <button className="preview-lightbox-close" type="button" aria-label="关闭放大图" autoFocus onClick={() => setIsPreviewOpen(false)}>×</button>
        <div className="preview-lightbox-image" dangerouslySetInnerHTML={{ __html: result.model.previewSvg }} />
        <p>按 Esc 或点击图片外区域关闭</p>
      </div>
    </div>}
    <div className="site-metrics"><div><small>用地面积</small><strong>{formatMetric(boundary.areaSquareMeters)} m²</strong></div><div><small>周长</small><strong>{formatMetric(boundary.perimeterMeters)} m</strong></div><div><small>边数</small><strong>{boundary.sideLengthsMeters.length}</strong></div></div>
    <div className="semantic-metrics">
      <span><small>临路</small><strong>{analysis.roads?.length ? analysis.roads.map((road) => `${sideChinese[road.side]}侧 ${formatMetric(road.widthMeters)} m`).join("、") : analysis.roadSides.length ? analysis.roadSides.map((side) => `${sideChinese[side]}侧`).join("、") : "待确认"}</strong><em>{analysis.roads?.length ? `${analysis.roads.length} 面道路` : analysis.roadWidthMeters === null ? "未识别宽度" : `${formatMetric(analysis.roadWidthMeters)} m 宽`}</em></span>
      <span><small>入口</small><strong>{analysis.entranceSide ? `${sideChinese[analysis.entranceSide]}侧` : "待确认"}</strong><em>{analysis.entranceWidthMeters === null ? "未识别宽度" : `${formatMetric(analysis.entranceWidthMeters)} m 宽`}</em></span>
      <span><small>北向</small><strong>{analysis.northAngleDegrees === null ? "待确认" : `${analysis.northAngleDegrees}°`}</strong><em>{analysis.northDetected ? "已识别 · 顺时针自图纸上方" : "未找到 NORTH 图层"}</em></span>
      {result.model.buildableArea && <span><small>可建设范围</small><strong>{formatMetric(result.model.buildableArea.areaSquareMeters)} m²</strong><em>控制线内 · 周长 {formatMetric(result.model.buildableArea.perimeterMeters)} m</em></span>}
    </div>
    {result.model.buildableArea && <div className="side-list setback-list"><small>各方向退界距离</small><div>{(["south", "north", "west", "east"] as const).map((side) => <span key={side}>{sideChinese[side]}侧<strong>{formatMetric(result.model.buildableArea!.setbacksMeters[side])} m</strong></span>)}</div></div>}
    {!!result.model.existingObjects?.length && <section className="existing-object-panel">
      <div><small>场地限制条件</small><strong>现状对象需逐项确认</strong><p>标记为“保留”的对象将作为后续平面方案不可占用的避让范围。</p></div>
      <div className="existing-object-list">{result.model.existingObjects.map((object) => <label key={object.id}>
        <span><strong>{object.label}</strong><small>{object.type === "building" && object.areaSquareMeters !== undefined ? `${formatMetric(object.areaSquareMeters)} m²` : object.type === "water" && object.widthMeters !== undefined ? `宽 ${formatMetric(object.widthMeters)} m` : object.type === "tree" ? "树冠范围" : "线性障碍"}</small></span>
        <select aria-label={`${object.label}处置方式`} value={objectActions[object.id] ?? object.defaultAction} onChange={(event) => setObjectActions((current) => ({ ...current, [object.id]: event.target.value as "keep" | "remove" | "ignore" }))}><option value="keep">保留</option><option value="remove">拆除</option><option value="ignore">忽略</option></select>
      </label>)}</div>
      <p className="constraint-summary">当前保留 {result.model.existingObjects.filter((object) => (objectActions[object.id] ?? object.defaultAction) === "keep").length} 项；提交户型需求前请确认处置方式。</p>
    </section>}
    {result.model.terrainAnalysis?.contourCount > 0 && <section className="terrain-panel">
      <div><small>坡地分析</small><strong>{result.model.terrainAnalysis.slopeDirection === "north_high_south_low" ? "北高南低" : result.model.terrainAnalysis.slopeDirection === "south_high_north_low" ? "南高北低" : "坡向待人工确认"}</strong></div>
      <div className="terrain-metrics"><span>等高线<strong>{result.model.terrainAnalysis.contourCount} 条</strong></span><span>高程点<strong>{result.model.terrainAnalysis.elevationPoints.length} 个</strong></span><span>总体高差<strong>{result.model.terrainAnalysis.elevationDifferenceMeters === null ? "待确认" : `${formatMetric(result.model.terrainAnalysis.elevationDifferenceMeters)} m`}</strong></span><span>高程范围<strong>{result.model.terrainAnalysis.minimumElevationMeters === null ? "待确认" : `${formatMetric(result.model.terrainAnalysis.minimumElevationMeters)}–${formatMetric(result.model.terrainAnalysis.maximumElevationMeters!)} m`}</strong></span></div>
      <ul><li>南侧入口位于相对低点，需复核雨水倒灌与入口排水组织。</li><li>约 4 m 高差可能涉及挡墙、分台地或基础高差，需专项结构复核。</li><li>当前仅完成二维等高线与高程点识别，尚不支持精确坡地自动设计，建议人工复核。</li></ul>
    </section>}
    <div className="side-list"><small>逐边尺寸</small><div>{boundary.sideLengthsMeters.map((length, index) => <span key={`${index}-${length}`}>边 {index + 1}<strong>{formatMetric(length)} m</strong></span>)}</div></div>
  </>;
}

function unitName(unit: "mm" | "cm" | "m"): string {
  return unit === "mm" ? "毫米（mm）" : unit === "cm" ? "厘米（cm）" : "米（m）";
}

function formatMetric(value: number): string {
  return value.toFixed(1);
}

function uploadWithProgress(url: string, file: File, onProgress: (value: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("content-type", file.type || "application/octet-stream");
    xhr.upload.onprogress = (event) => event.lengthComputable && onProgress(Math.round(event.loaded / event.total * 100));
    xhr.onerror = () => reject(new Error("UPLOAD_NETWORK_FAILED"));
    xhr.onload = () => xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error("UPLOAD_FAILED"));
    xhr.send(file);
  });
}

function toReadableError(error: unknown): string {
  const code = error instanceof Error ? error.message : "DXF_PARSE_FAILED";
  return errorMessages[code] ?? (code === "UPLOAD_NETWORK_FAILED" ? "网络中断，文件未上传完成。请检查网络后重试。" : "处理失败，请重新导出 DXF 后再试。未解决时可联系技术人员并提供文件。") ;
}

async function downloadPng(svg: string) {
  const image = new Image();
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
  image.onload = () => {
    const canvas = document.createElement("canvas");
    canvas.width = 1600; canvas.height = 1200;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.fillStyle = "#f5f1e8"; context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const link = document.createElement("a"); link.download = "site-boundary.png"; link.href = canvas.toDataURL("image/png"); link.click();
    URL.revokeObjectURL(url);
  };
  image.src = url;
}
