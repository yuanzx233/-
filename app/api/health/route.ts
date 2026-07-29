export async function GET() {
  return Response.json({
    status: "ok",
    service: "筑想家 Day 2 API",
    capabilities: ["D1", "R2", "DXF", "TASK_QUEUE"],
    timestamp: new Date().toISOString(),
  });
}
