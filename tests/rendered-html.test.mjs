import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("project dashboard replaces the disposable starter", async () => {
  const [page, dashboard, layout, styles, packageJson] = await Promise.all([
    readFile("app/page.tsx", "utf8"),
    readFile("app/project-dashboard.tsx", "utf8"),
    readFile("app/layout.tsx", "utf8"),
    readFile("app/globals.css", "utf8"),
    readFile("package.json", "utf8"),
  ]);
  assert.match(page, /ProjectDashboard/);
  assert.match(dashboard, /从一张地块图/);
  assert.match(dashboard, /创建新项目/);
  assert.match(dashboard, /\/api\/projects/);
  assert.match(layout, /筑想家/);
  assert.match(styles, /--terracotta/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
});

test("login and API routes are present in the production build", async () => {
  const [login, projectsRoute, uploadRoute, parseRoute] = await Promise.all([
    readFile("app/login/page.tsx", "utf8"),
    readFile("app/api/projects/route.ts", "utf8"),
    readFile("app/api/uploads/credentials/route.ts", "utf8"),
    readFile("app/api/files/[id]/parse/route.ts", "utf8"),
  ]);
  assert.match(login, /使用 ChatGPT 登录/);
  assert.match(projectsRoute, /export async function POST/);
  assert.match(uploadRoute, /uploadUrl/);
  assert.match(parseRoute, /parseDxf/);
});
