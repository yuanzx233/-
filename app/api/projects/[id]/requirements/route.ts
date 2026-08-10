import type { NextRequest } from "next/server";
import { getD1 } from "../../../../../db/runtime";
import { apiError, requireApiUser } from "../../../../../lib/api-auth";
import { type RequirementSubmission, validateRequirementSubmission } from "../../../../../lib/requirements";

type Context = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: Context) {
  try {
    const user = await requireApiUser(request);
    const { id } = await context.params;
    const row = await getD1().prepare(
      `SELECT v.id, v.sequence, v.data_json AS dataJson, v.created_at AS createdAt
       FROM project_versions v JOIN projects p ON p.id = v.project_id
       WHERE v.project_id = ? AND p.owner_id = ? AND v.stage = 'REQUIREMENTS'
       ORDER BY v.sequence DESC LIMIT 1`,
    ).bind(id, user.id).first<{ id: string; sequence: number; dataJson: string; createdAt: string }>();
    return Response.json({ submission: row ? { ...row, data: JSON.parse(row.dataJson) } : null });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: NextRequest, context: Context) {
  try {
    const user = await requireApiUser(request);
    const { id } = await context.params;
    const body = await request.json() as RequirementSubmission;
    const issues = validateRequirementSubmission(body);
    if (issues.length) return Response.json({ error: "REQUIREMENTS_INVALID", issues }, { status: 422 });

    const db = getD1();
    const project = await db.prepare("SELECT id, current_version_id AS currentVersionId FROM projects WHERE id = ? AND owner_id = ?")
      .bind(id, user.id).first<{ id: string; currentVersionId: string | null }>();
    if (!project) return Response.json({ error: "PROJECT_NOT_FOUND" }, { status: 404 });
    const sequenceRow = await db.prepare("SELECT COALESCE(MAX(sequence), 0) + 1 AS sequence FROM project_versions WHERE project_id = ?")
      .bind(id).first<{ sequence: number }>();
    const versionId = crypto.randomUUID();
    const sequence = sequenceRow?.sequence ?? 1;
    const now = new Date().toISOString();
    await db.batch([
      db.prepare(
        `INSERT INTO project_versions
          (id, project_id, parent_id, sequence, stage, status, data_json, created_by, created_at)
         VALUES (?, ?, ?, ?, 'REQUIREMENTS', 'CONFIRMED', ?, ?, ?)`,
      ).bind(versionId, id, project.currentVersionId, sequence, JSON.stringify(body), user.id, now),
      db.prepare(
        "UPDATE projects SET current_version_id = ?, status = 'PLAN_READY', current_stage = 'PLAN', updated_at = ? WHERE id = ?",
      ).bind(versionId, now, id),
    ]);
    return Response.json({ version: { id: versionId, sequence, stage: "REQUIREMENTS", status: "CONFIRMED", createdAt: now } }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
