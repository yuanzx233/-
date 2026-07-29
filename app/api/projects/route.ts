import type { NextRequest } from "next/server";
import { getD1 } from "../../../db/runtime";
import { apiError, requireApiUser } from "../../../lib/api-auth";

export async function GET(request: NextRequest) {
  try {
    const user = await requireApiUser(request);
    const result = await getD1().prepare(
      `SELECT id, name, address, status, current_stage AS currentStage,
              created_at AS createdAt, updated_at AS updatedAt
       FROM projects WHERE owner_id = ? AND archived_at IS NULL ORDER BY updated_at DESC`,
    ).bind(user.id).all();
    return Response.json({ projects: result.results });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireApiUser(request);
    const body = await request.json() as { name?: string; address?: string };
    const name = body.name?.trim();
    if (!name || name.length > 80) return Response.json({ error: "项目名称应为 1–80 个字符" }, { status: 400 });
    if ((body.address?.length ?? 0) > 200) return Response.json({ error: "项目地址不能超过 200 个字符" }, { status: 400 });

    const id = crypto.randomUUID();
    const versionId = crypto.randomUUID();
    const now = new Date().toISOString();
    const db = getD1();
    await db.batch([
      db.prepare(
        `INSERT INTO projects
          (id, owner_id, name, address, status, current_stage, current_version_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, 'DRAFT', 'SITE', ?, ?, ?)`,
      ).bind(id, user.id, name, body.address?.trim() || null, versionId, now, now),
      db.prepare(
        `INSERT INTO project_versions
          (id, project_id, parent_id, sequence, stage, status, data_json, created_by, created_at)
         VALUES (?, ?, NULL, 1, 'PROJECT', 'CONFIRMED', ?, ?, ?)`,
      ).bind(versionId, id, JSON.stringify({ name, address: body.address?.trim() || null }), user.id, now),
    ]);
    const project = await db.prepare(
      `SELECT id, name, address, status, current_stage AS currentStage,
              created_at AS createdAt, updated_at AS updatedAt FROM projects WHERE id = ?`,
    ).bind(id).first();
    return Response.json({ project }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
