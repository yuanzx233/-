import type { NextRequest } from "next/server";
import { ensureDatabase } from "../db/bootstrap";
import { getD1 } from "../db/runtime";

export type ApiUser = {
  id: string;
  email: string;
  displayName: string;
};

export async function requireApiUser(request: NextRequest): Promise<ApiUser> {
  const email =
    request.headers.get("oai-authenticated-user-email") ??
    request.headers.get("x-demo-user-email");
  if (!email) throw new Response("UNAUTHORIZED", { status: 401 });

  const encodedName = request.headers.get("oai-authenticated-user-full-name");
  const displayName =
    encodedName && request.headers.get("oai-authenticated-user-full-name-encoding") === "percent-encoded-utf-8"
      ? safeDecode(encodedName) ?? email
      : request.headers.get("x-demo-user-name") ?? email;

  await ensureDatabase();
  const db = getD1();
  const now = new Date().toISOString();
  const existing = await db.prepare("SELECT id FROM users WHERE email = ?").bind(email).first<{ id: string }>();
  if (existing) {
    await db.prepare("UPDATE users SET display_name = ?, updated_at = ? WHERE id = ?")
      .bind(displayName, now, existing.id).run();
    return { id: existing.id, email, displayName };
  }

  const id = crypto.randomUUID();
  await db.prepare(
    "INSERT INTO users (id, email, display_name, role, created_at, updated_at) VALUES (?, ?, ?, 'OWNER', ?, ?)",
  ).bind(id, email, displayName, now, now).run();
  return { id, email, displayName };
}

export function apiError(error: unknown): Response {
  if (error instanceof Response) return error;
  const message = error instanceof Error ? error.message : "INTERNAL_ERROR";
  const status = message.endsWith("_NOT_FOUND") ? 404 : message.includes("UNAVAILABLE") ? 503 : 500;
  return Response.json({ error: message }, { status });
}

function safeDecode(value: string): string | null {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}
