export const MAX_DXF_BYTES = 50 * 1024 * 1024;

export const allowedDxfContentTypes = new Set([
  "application/dxf",
  "application/x-dxf",
  "application/octet-stream",
  "text/plain",
  "",
]);

export type DxfUploadMetadata = {
  fileName?: string;
  contentType?: string;
  size?: number;
  sourceUnit?: "mm" | "cm" | "m" | string;
};

export type UploadPolicyResult = { ok: true } | { ok: false; status: number; error: string };

export function validateDxfUploadMetadata(input: DxfUploadMetadata): UploadPolicyResult {
  if (!input.fileName || input.size === undefined) return { ok: false, status: 400, error: "缺少 fileName 或 size" };
  if (!input.fileName.toLowerCase().endsWith(".dxf")) return { ok: false, status: 400, error: "MVP 仅支持 DXF 文件" };
  if (!allowedDxfContentTypes.has(input.contentType ?? "")) return { ok: false, status: 415, error: "DXF_FILE_TYPE_INVALID" };
  if (input.size <= 0) return { ok: false, status: 400, error: "DXF_FILE_EMPTY" };
  if (input.size > MAX_DXF_BYTES) return { ok: false, status: 413, error: "DXF 文件不能超过 50 MB" };
  if (input.sourceUnit && !["mm", "cm", "m"].includes(input.sourceUnit)) return { ok: false, status: 400, error: "DXF_UNIT_INVALID" };
  return { ok: true };
}
