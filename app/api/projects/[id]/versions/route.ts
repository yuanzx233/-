import type { NextRequest } from "next/server";
import { getD1 } from "../../../../../db/runtime";
import { apiError, requireApiUser } from "../../../../../lib/api-auth";

type Context = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: Context) {
  try {
    const user = await requireApiUser(request);
    const { id } = await context.params;
    const rows = await getD1().prepare(
      `SELECT v.id, v.parent_id AS parentId, v.sequence, v.stage, v.status,
              v.data_json AS dataJson, v.created_at AS createdAt
       FROM project_versions v JOIN projects p ON p.id = v.project_id
       WHERE v.project_id = ? AND p.owner_id = ? ORDER BY v.sequence DESC`,
    ).bind(id, user.id).all();
    return Response.json({ versions: rows.results });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: NextRequest, context: Context) {
  try {
    const user = await requireApiUser(request);
    const { id } = await context.params;
    const body = await request.json() as { stage?: string; data?: unknown; parentId?: string };
    const project = await getD1().prepare("SELECT id FROM projects WHERE id = ? AND owner_id = ?")
      .bind(id, user.id).first();
    if (!project) return Response.json({ error: "PROJECT_NOT_FOUND" }, { status: 404 });
    const sequenceRow = await getD1().prepare(
      "SELECT COALESCE(MAX(sequence), 0) + 1 AS sequence FROM project_versions WHERE project_id = ?",
    ).bind(id).first<{ sequence: number }>();
    const versionId = crypto.randomUUID();
    const now = new Date().toISOString();
    await getD1().batch([
      getD1().prepare(
        `INSERT INTO project_versions
          (id, project_id, parent_id, sequence, stage, status, data_json, created_by, created_at)
         VALUES (?, ?, ?, ?, ?, 'DRAFT', ?, ?, ?)`,
      ).bind(versionId, id, body.parentId ?? null, sequenceRow?.sequence ?? 1, body.stage ?? "SITE", JSON.stringify(body.data ?? {}), user.id, now),
      getD1().prepare("UPDATE projects SET current_version_id = ?, updated_at = ? WHERE id = ?")
        .bind(versionId, now, id),
    ]);
    return Response.json({ id: versionId, sequence: sequenceRow?.sequence ?? 1 }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
