"use client";

import { ChangeEvent, useEffect, useRef, useState } from "react";

type ProjectOption = { id: string; name: string; address: string | null };
type BoundaryResult = {
  areaSquareMeters: number;
  perimeterMeters: number;
  sideLengthsMeters: number[];
  majorDimensionsMeters: { width: number; height: number };
};
type ParseResult = { model: { boundary: BoundaryResult; previewSvg: string; sourceUnit: string } };

const errorMessages: Record<string, string> = {
  DXF_FILE_TYPE_INVALID: "请选择扩展名为 .dxf 的 ASCII DXF 文件。",
  DXF_FILE_EMPTY: "文件为空，请重新从 CAD 软件导出。",
  DXF_UNIT_REQUIRED: "请选择 CAD 文件使用的绘图单位。",
  DXF_INVALID_STRUCTURE: "文件结构不完整，可能已损坏或不是标准 DXF。",
  DXF_BINARY_UNSUPPORTED: "暂不支持二进制 DXF，请另存为 ASCII DXF 后重试。",
  DXF_GROUP_PAIR_MISMATCH: "DXF 数据不完整，请重新导出文件。",
  DXF_INVALID_GROUP_CODE: "DXF 包含无法识别的数据组，可能已经损坏。",
  DXF_INVALID_COORDINATE: "DXF 中存在无效坐标，请检查 CAD 图形。",
  DXF_NO_SUPPORTED_ENTITIES: "未找到线段或轻量多段线。请将地块边界导出为 LWPOLYLINE。",
  DXF_BOUNDARY_NOT_CLOSED: "未识别到闭合地块。请在 CAD 中闭合场地多段线。",
  DXF_MULTIPLE_BOUNDARIES: "识别到多个闭合地块。请只保留一个 SITE_BOUNDARY 边界。",
  DXF_SCALE_OUT_OF_RANGE: "换算后的地块尺寸异常，请检查所选单位或 CAD 比例。",
  UPLOAD_SIZE_MISMATCH: "上传文件大小与登记信息不一致，请重试。",
};

export function SiteUploadWorkspace({ projects, authHeaders }: { projects: ProjectOption[]; authHeaders: Record<string, string> }) {
  const [projectId, setProjectId] = useState("");
  const [unit, setUnit] = useState<"mm" | "cm" | "m">("mm");
  const [roadDirection, setRoadDirection] = useState("南");
  const [roadWidth, setRoadWidth] = useState("6");
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
          sourceUnit: unit,
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

  return (
    <section className="cad-workspace" id="cad-upload">
      <div className="cad-heading">
        <div><p className="eyebrow">DAY 3 · CAD 上传与场地解析</p><h2>把 CAD 地块变成可核对的场地数据</h2></div>
        <span className="support-pill">ASCII DXF · 最大 50 MB</span>
      </div>
      <div className="cad-grid">
        <div className="upload-card">
          <div className="field-grid">
            <label>所属项目<select value={projectId} onChange={(event) => setProjectId(event.target.value)} disabled={!projects.length}><option value="">请先创建项目</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select></label>
            <label>CAD 绘图单位<select value={unit} onChange={(event) => setUnit(event.target.value as "mm" | "cm" | "m")}><option value="mm">毫米（mm）</option><option value="cm">厘米（cm）</option><option value="m">米（m）</option></select></label>
            <label>临路方向<select value={roadDirection} onChange={(event) => setRoadDirection(event.target.value)}>{["东", "南", "西", "北", "多面临路"].map((item) => <option key={item}>{item}</option>)}</select></label>
            <label>道路宽度（米）<input type="number" min="0" max="100" step="0.1" value={roadWidth} onChange={(event) => setRoadWidth(event.target.value)} /></label>
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
  );
}

function ResultView({ result }: { result: ParseResult }) {
  const boundary = result.model.boundary;
  return <>
    <div className="preview-top"><div><small>场地轮廓</small><strong>{boundary.majorDimensionsMeters.width} × {boundary.majorDimensionsMeters.height} m</strong></div><button className="quiet-button" type="button" onClick={() => void downloadPng(result.model.previewSvg)}>下载 PNG</button></div>
    <div className="svg-preview" dangerouslySetInnerHTML={{ __html: result.model.previewSvg }} />
    <div className="site-metrics"><div><small>面积</small><strong>{boundary.areaSquareMeters} m²</strong></div><div><small>周长</small><strong>{boundary.perimeterMeters} m</strong></div><div><small>边数</small><strong>{boundary.sideLengthsMeters.length}</strong></div></div>
    <div className="side-list"><small>逐边尺寸</small><div>{boundary.sideLengthsMeters.map((length, index) => <span key={`${index}-${length}`}>边 {index + 1}<strong>{length} m</strong></span>)}</div></div>
  </>;
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
