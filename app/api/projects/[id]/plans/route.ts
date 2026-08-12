import type { NextRequest } from "next/server";
import { getD1 } from "../../../../../db/runtime";
import { apiError, requireApiUser } from "../../../../../lib/api-auth";
import { generatePlanCandidates } from "../../../../../lib/plan-generator";
import type { RequirementSubmission } from "../../../../../lib/requirements";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: Context) {
  try {
    const user = await requireApiUser(request); const { id } = await context.params; const body = await request.json() as { action?: "generate" | "confirm"; planId?: string };
    const db = getD1();
    const project = await db.prepare("SELECT id, current_version_id AS currentVersionId FROM projects WHERE id = ? AND owner_id = ?").bind(id, user.id).first<{ id: string; currentVersionId: string | null }>();
    if (!project) return Response.json({ error: "PROJECT_NOT_FOUND" }, { status: 404 });
    if (body.action === "confirm") {
      const current = await db.prepare("SELECT data_json AS dataJson FROM project_versions WHERE id = ? AND project_id = ? AND stage = 'PLAN'").bind(project.currentVersionId, id).first<{ dataJson: string }>();
      if (!current) return Response.json({ error: "PLAN_VERSION_NOT_FOUND" }, { status: 404 });
      const data = JSON.parse(current.dataJson) as { plans: Array<{ id: string }>; selectedPlanId?: string }; if (!data.plans.some(plan => plan.id === body.planId)) return Response.json({ error: "PLAN_NOT_FOUND" }, { status: 422 });
      data.selectedPlanId = body.planId; await db.batch([db.prepare("UPDATE project_versions SET status = 'CONFIRMED', data_json = ? WHERE id = ?").bind(JSON.stringify(data), project.currentVersionId), db.prepare("UPDATE projects SET status = 'PLAN_REVIEW', current_stage = 'STYLE', updated_at = ? WHERE id = ?").bind(new Date().toISOString(), id)]);
      return Response.json({ selectedPlanId: body.planId });
    }
    const requirement = await db.prepare("SELECT id, data_json AS dataJson FROM project_versions WHERE project_id = ? AND stage = 'REQUIREMENTS' ORDER BY sequence DESC LIMIT 1").bind(id).first<{ id: string; dataJson: string }>();
    if (!requirement) return Response.json({ error: "REQUIREMENTS_NOT_FOUND" }, { status: 409 });
    const plans = generatePlanCandidates(JSON.parse(requirement.dataJson) as RequirementSubmission); if (!plans.length) return Response.json({ error: "NO_PLAN_FITS_SITE", message: "没有模板能完整放入当前可建设范围，请调整面积需求或复核控制线与保留对象。" }, { status: 422 }); const sequence = (await db.prepare("SELECT COALESCE(MAX(sequence), 0) + 1 AS sequence FROM project_versions WHERE project_id = ?").bind(id).first<{ sequence: number }>())?.sequence ?? 1; const versionId = crypto.randomUUID(); const now = new Date().toISOString();
    await db.batch([db.prepare("INSERT INTO project_versions (id, project_id, parent_id, sequence, stage, status, data_json, created_by, created_at) VALUES (?, ?, ?, ?, 'PLAN', 'DRAFT', ?, ?, ?)").bind(versionId, id, requirement.id, sequence, JSON.stringify({ templateCount: 16, plans }), user.id, now), db.prepare("UPDATE projects SET current_version_id = ?, status = 'PLAN_REVIEW', current_stage = 'PLAN', updated_at = ? WHERE id = ?").bind(versionId, now, id)]);
    return Response.json({ version: { id: versionId, sequence }, templateCount: 16, plans }, { status: 201 });
  } catch (error) { return apiError(error); }
}
