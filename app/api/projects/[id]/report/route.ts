import type { NextRequest } from "next/server";
import { getD1, getR2 } from "../../../../../db/runtime";
import { apiError, requireApiUser } from "../../../../../lib/api-auth";
import { generateProjectReportHtml, type ReportImage } from "../../../../../lib/report-generator";

type Context = { params: Promise<{ id: string }> };
const parse = (value?: string | null) => { try { return JSON.parse(value || "{}"); } catch { return {}; } };

export async function GET(request: NextRequest, context: Context) {
  try {
    const user = await requireApiUser(request); const { id } = await context.params; const db = getD1();
    const project = await db.prepare("SELECT name, address, updated_at AS updatedAt FROM projects WHERE id = ? AND owner_id = ?").bind(id, user.id).first<{ name: string; address: string | null; updatedAt: string }>();
    if (!project) return Response.json({ error: "PROJECT_NOT_FOUND" }, { status: 404 });
    const versions = await db.prepare("SELECT stage, data_json AS dataJson FROM project_versions WHERE project_id = ? ORDER BY sequence DESC").bind(id).all<{ stage: string; dataJson: string }>();
    const latest = (stage: string) => parse(versions.results.find(row => row.stage === stage)?.dataJson);
    const file = await db.prepare("SELECT metadata_json AS metadataJson FROM file_assets WHERE project_id = ? AND status = 'PARSED' ORDER BY created_at DESC LIMIT 1").bind(id).first<{ metadataJson: string }>();
    const assets = await db.prepare("SELECT id, view, object_key AS objectKey, content_type AS contentType FROM render_assets WHERE project_id = ? AND status = 'READY' ORDER BY selected DESC, created_at DESC LIMIT 3").bind(id).all<{ id: string; view: string; objectKey: string; contentType: string }>();
    const labels: Record<string,string> = { MAIN_ENTRANCE: "主入口视角", AERIAL: "鸟瞰视角", COURTYARD: "庭院视角" }; const renders: ReportImage[] = [];
    for (const asset of assets.results) { const object = await getR2().get(asset.objectKey); if (!object) continue; const bytes = new Uint8Array(await object.arrayBuffer()); let binary = ""; for (let offset=0;offset<bytes.length;offset+=8192) binary += String.fromCharCode(...bytes.subarray(offset,offset+8192)); renders.push({ label: labels[asset.view] || asset.view, src: `data:${asset.contentType};base64,${btoa(binary)}` }); }
    const result = generateProjectReportHtml({ project, site: parse(file?.metadataJson).dxf, requirements: latest("REQUIREMENTS"), plan: latest("PLAN"), style: latest("STYLE"), renders });
    return new Response(result.html, { headers: { "content-type": "text/html; charset=utf-8", "content-disposition": `attachment; filename*=UTF-8''${encodeURIComponent(project.name)}-方案报告.html`, "x-report-sections": String(result.qa.sectionCount), "x-report-metrics-consistent": String(result.qa.metricsConsistent) } });
  } catch (error) { return apiError(error); }
}
