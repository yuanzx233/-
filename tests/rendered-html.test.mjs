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
  assert.match(uploadRoute, /body\.sourceUnit &&/);
  assert.doesNotMatch(uploadRoute, /!body\.sourceUnit/);
  assert.match(parseRoute, /parseDxf/);
});

test("Day 4 site confirmation and structured requirements are present", async () => {
  const [workspace, uploadWorkspace, rules, route] = await Promise.all([
    readFile("app/requirements-workspace.tsx", "utf8"),
    readFile("app/site-upload-workspace.tsx", "utf8"),
    readFile("lib/requirements.ts", "utf8"),
    readFile("app/api/projects/[id]/requirements/route.ts", "utf8"),
  ]);
  assert.match(workspace, /确认场地并提交需求/);
  assert.match(workspace, /临路方向/);
  assert.match(uploadWorkspace, /siteAnalysis/);
  assert.match(uploadWorkspace, /RequirementsWorkspace/);
  assert.match(uploadWorkspace, /preview-lightbox/);
  assert.match(uploadWorkspace, /event\.key === "Escape"/);
  assert.match(uploadWorkspace, /aria-label="放大查看场地轮廓图"/);
  assert.match(uploadWorkspace, /主要道路宽度（米）/);
  assert.match(uploadWorkspace, /function formatMetric/);
  assert.doesNotMatch(uploadWorkspace, /<small>主要方向<\/small>/);
  assert.match(uploadWorkspace, /各方向退界距离/);
  assert.match(uploadWorkspace, /<small>用地面积<\/small>/);
  assert.match(uploadWorkspace, /自动读取 DXF（推荐）/);
  assert.match(uploadWorkspace, /已识别 · 顺时针自图纸上方/);
  assert.match(rules, /老人房必须设在首层/);
  assert.match(rules, /面积上限超过概念容量/);
  assert.match(route, /'REQUIREMENTS', 'CONFIRMED'/);
  assert.match(route, /PLAN_READY/);
});
