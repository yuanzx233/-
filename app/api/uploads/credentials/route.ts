import type { NextRequest } from "next/server";
import { getD1 } from "../../../../db/runtime";
import { apiError, requireApiUser } from "../../../../lib/api-auth";

const MAX_DXF_BYTES = 50 * 1024 * 1024;

export async function POST(request: NextRequest) {
  try {
    const user = await requireApiUser(request);
    const body = await request.json() as {
      projectId?: string;
      fileName?: string;
      contentType?: string;
      size?: number;
      kind?: string;
    };
    if (!body.projectId || !body.fileName || !body.size) {
      return Response.json({ error: "缺少 projectId、fileName 或 size" }, { status: 400 });
    }
    if (!body.fileName.toLowerCase().endsWith(".dxf")) {
      return Response.json({ error: "MVP 仅支持 DXF 文件" }, { status: 400 });
    }
    if (body.size > MAX_DXF_BYTES) return Response.json({ error: "DXF 文件不能超过 50 MB" }, { status: 413 });
    const project = await getD1().prepare("SELECT id FROM projects WHERE id = ? AND owner_id = ?")
      .bind(body.projectId, user.id).first();
    if (!project) return Response.json({ error: "PROJECT_NOT_FOUND" }, { status: 404 });

    const fileId = crypto.randomUUID();
    const token = crypto.randomUUID().replaceAll("-", "");
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 15 * 60 * 1000);
    const objectKey = `projects/${body.projectId}/source/${fileId}.dxf`;
    const db = getD1();
    await db.batch([
      db.prepare(
        `INSERT INTO file_assets
          (id, project_id, version_id, owner_id, kind, object_key, file_name, content_type, size, status, metadata_json, created_at, updated_at)
         VALUES (?, ?, NULL, ?, ?, ?, ?, ?, ?, 'PENDING', '{}', ?, ?)`,
      ).bind(fileId, body.projectId, user.id, body.kind ?? "SITE_DXF", objectKey, body.fileName, body.contentType ?? "application/dxf", body.size, now.toISOString(), now.toISOString()),
      db.prepare(
        "INSERT INTO upload_sessions (token, file_id, owner_id, expires_at, consumed_at, created_at) VALUES (?, ?, ?, ?, NULL, ?)",
      ).bind(token, fileId, user.id, expiresAt.toISOString(), now.toISOString()),
    ]);
    return Response.json({
      credential: {
        token,
        uploadUrl: `/api/uploads/${token}`,
        method: "PUT",
        expiresAt: expiresAt.toISOString(),
        fileId,
        maxBytes: MAX_DXF_BYTES,
      },
    }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
