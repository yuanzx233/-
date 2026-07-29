import { env } from "cloudflare:workers";

export type AppBindings = {
  DB: D1Database;
  FILES: R2Bucket;
};

export function getBindings(): AppBindings {
  const bindings = env as unknown as Partial<AppBindings>;
  if (!bindings.DB) throw new Error("D1_BINDING_UNAVAILABLE");
  if (!bindings.FILES) throw new Error("R2_BINDING_UNAVAILABLE");
  return bindings as AppBindings;
}

export function getD1(): D1Database {
  const bindings = env as unknown as Partial<AppBindings>;
  if (!bindings.DB) throw new Error("D1_BINDING_UNAVAILABLE");
  return bindings.DB;
}

export function getR2(): R2Bucket {
  const bindings = env as unknown as Partial<AppBindings>;
  if (!bindings.FILES) throw new Error("R2_BINDING_UNAVAILABLE");
  return bindings.FILES;
}
