declare module "cloudflare:workers" {
  export const env: Record<string, unknown>;
}

interface D1ResultMeta {
  changes?: number;
}

interface D1Result<T = unknown> {
  results?: T[];
  success: boolean;
  meta: D1ResultMeta;
}

interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<D1Result<T>>;
  run<T = Record<string, unknown>>(): Promise<D1Result<T>>;
}

interface D1Database {
  prepare(sql: string): D1PreparedStatement;
  batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]>;
}

interface R2ObjectBody {
  text(): Promise<string>;
}

interface R2Bucket {
  put(
    key: string,
    value: ReadableStream,
    options?: {
      httpMetadata?: { contentType?: string };
      customMetadata?: Record<string, string>;
    },
  ): Promise<unknown>;
  get(key: string): Promise<R2ObjectBody | null>;
}

interface Fetcher {
  fetch(request: Request): Promise<Response>;
}
