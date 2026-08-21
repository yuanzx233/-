import type { NextRequest } from "next/server";
import { ensureDatabase } from "../../../../db/bootstrap";
import { getD1, getR2 } from "../../../../db/runtime";
import { apiError, requireApiUser } from "../../../../lib/api-auth";

type Context = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: Context) {
  try {
    await ensureDatabase(); const user = await requireApiUser(request); const { id } = await context.params;
    const asset = await getD1().prepare("SELECT object_key AS objectKey, content_type AS contentType FROM render_assets WHERE id = ? AND owner_id = ? AND status = 'READY'").bind(id, user.id).first<{ objectKey: string; contentType: string }>();
    if (!asset) return Response.json({ error: "RENDER_ASSET_NOT_FOUND" }, { status: 404 });
    const object = await getR2().get(asset.objectKey); if (!object) return Response.json({ error: "RENDER_OBJECT_NOT_FOUND" }, { status: 404 });
    return new Response(object.body, { headers: { "content-type": asset.contentType, "cache-control": "private, max-age=3600", "content-disposition": "inline" } });
  } catch (error) { return apiError(error); }
}
