import type { NextRequest } from "next/server";
import { ensureDatabase } from "../../../../db/bootstrap";
import { getD1, getR2 } from "../../../../db/runtime";
import { apiError } from "../../../../lib/api-auth";

type Context = { params: Promise<{ token: string }> };

export async function PUT(request: NextRequest, context: Context) {
  try {
    await ensureDatabase();
    const { token } = await context.params;
    const session = await getD1().prepare(
      `SELECT s.file_id AS fileId, s.expires_at AS expiresAt, s.consumed_at AS consumedAt,
              f.object_key AS objectKey, f.size, f.content_type AS contentType
       FROM upload_sessions s JOIN file_assets f ON f.id = s.file_id WHERE s.token = ?`,
    ).bind(token).first<{
      fileId: string;
      expiresAt: string;
      consumedAt: string | null;
      objectKey: string;
      size: number;
      contentType: string;
    }>();
    if (!session) return Response.json({ error: "UPLOAD_CREDENTIAL_NOT_FOUND" }, { status: 404 });
    if (session.consumedAt) return Response.json({ error: "UPLOAD_CREDENTIAL_USED" }, { status: 409 });
    if (new Date(session.expiresAt) < new Date()) return Response.json({ error: "UPLOAD_CREDENTIAL_EXPIRED" }, { status: 410 });
    const contentLength = Number(request.headers.get("content-length") ?? 0);
    if (contentLength && contentLength !== session.size) {
      return Response.json({ error: "UPLOAD_SIZE_MISMATCH" }, { status: 400 });
    }
    if (!request.body) return Response.json({ error: "EMPTY_UPLOAD" }, { status: 400 });

    await getR2().put(session.objectKey, request.body, {
      httpMetadata: { contentType: session.contentType },
      customMetadata: { fileId: session.fileId },
    });
    const now = new Date().toISOString();
    await getD1().batch([
      getD1().prepare("UPDATE upload_sessions SET consumed_at = ? WHERE token = ?").bind(now, token),
      getD1().prepare("UPDATE file_assets SET status = 'UPLOADED', updated_at = ? WHERE id = ?").bind(now, session.fileId),
    ]);
    return Response.json({ fileId: session.fileId, status: "UPLOADED" });
  } catch (error) {
    return apiError(error);
  }
}
