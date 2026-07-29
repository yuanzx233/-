import type { NextRequest } from "next/server";
import { apiError, requireApiUser } from "../../../../lib/api-auth";
import { claimNextTask } from "../../../../lib/task-queue";

export async function POST(request: NextRequest) {
  try {
    await requireApiUser(request);
    const task = await claimNextTask();
    return Response.json({ task });
  } catch (error) {
    return apiError(error);
  }
}
