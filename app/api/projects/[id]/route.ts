import type { NextRequest } from "next/server";
import { getD1 } from "../../../../db/runtime";
import { apiError, requireApiUser } from "../../../../lib/api-auth";

type Context = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: Context) {
  try {
    const user = await requireApiUser(request);
    const { id } = await context.params;
    const project = await getD1().prepare(
      `SELECT id, name, address, status, current_stage AS currentStage,
              current_version_id AS currentVersionId, created_at AS createdAt, updated_at AS updatedAt
       FROM projects WHERE id = ? AND owner_id = ?`,
    ).bind(id, user.id).first();
    if (!project) return Response.json({ error: "PROJECT_NOT_FOUND" }, { status: 404 });
    return Response.json({ project });
  } catch (error) {
    return apiError(error);
  }
}

export async function PATCH(request: NextRequest, context: Context) {
  try {
    const user = await requireApiUser(request);
    const { id } = await context.params;
    const body = await request.json() as { name?: string; address?: string; archived?: boolean };
    const current = await getD1().prepare("SELECT id FROM projects WHERE id = ? AND owner_id = ?")
      .bind(id, user.id).first();
    if (!current) return Response.json({ error: "PROJECT_NOT_FOUND" }, { status: 404 });
    const now = new Date().toISOString();
    await getD1().prepare(
      `UPDATE projects SET
        name = COALESCE(?, name),
        address = CASE WHEN ? IS NULL THEN address ELSE ? END,
        archived_at = CASE WHEN ? = 1 THEN ? WHEN ? = 0 THEN NULL ELSE archived_at END,
        updated_at = ?
       WHERE id = ? AND owner_id = ?`,
    ).bind(
      body.name?.trim() || null,
      body.address === undefined ? null : body.address,
      body.address?.trim() || null,
      body.archived === true ? 1 : body.archived === false ? 0 : null,
      now,
      body.archived === true ? 1 : body.archived === false ? 0 : null,
      now,
      id,
      user.id,
    ).run();
    return GET(request, context);
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(request: NextRequest, context: Context) {
  try {
    const user = await requireApiUser(request);
    const { id } = await context.params;
    const now = new Date().toISOString();
    const result = await getD1().prepare(
      "UPDATE projects SET archived_at = ?, updated_at = ? WHERE id = ? AND owner_id = ?",
    ).bind(now, now, id, user.id).run();
    if (!result.meta.changes) return Response.json({ error: "PROJECT_NOT_FOUND" }, { status: 404 });
    return new Response(null, { status: 204 });
  } catch (error) {
    return apiError(error);
  }
}
