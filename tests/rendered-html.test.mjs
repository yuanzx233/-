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
  assert.match(uploadWorkspace, /请重新上传更正后的 DXF 图纸/);
  assert.match(uploadWorkspace, /确认以上事项并上传更正图纸/);
  assert.match(uploadWorkspace, /!result\.model\.diagnostics\?\.blockDownstreamGeneration/);
  assert.doesNotMatch(uploadWorkspace, /manualDiagnosticsConfirmed/);
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

test("Day 5 plan generation, comparison and confirmation are present", async () => {
  const [workspace, generator, library, route] = await Promise.all([readFile("app/plan-workspace.tsx", "utf8"), readFile("lib/plan-generator.ts", "utf8"), readFile("lib/plan-template-library.ts", "utf8"), readFile("app/api/projects/[id]/plans/route.ts", "utf8")]);
  assert.match(workspace, /生成候选方案/); assert.match(workspace, /确认此方案/); assert.match(workspace, /需求满足度|plan-satisfaction/); assert.match(workspace, /场地条件通过/);
  assert.match(library, /HT-T001/); assert.match(library, /STANDARDIZED_AC1032\.dxf/); assert.match(generator, /generatePlanCandidates/); assert.match(generator, /bestPlacement/); assert.match(generator, /renderTemplateSvg/);
  assert.match(route, /action === "confirm"/); assert.match(route, /stage, status, data_json/);
});

test("Day 6 comparison, locked plan and style render brief are present", async () => {
  const [workspace, route, styleBrief] = await Promise.all([
    readFile("app/plan-workspace.tsx", "utf8"),
    readFile("app/api/projects/[id]/plans/route.ts", "utf8"),
    readFile("lib/style-brief.ts", "utf8"),
  ]);
  assert.match(workspace, /多方案对比/);
  assert.match(workspace, /面积指标与需求满足度/);
  assert.match(workspace, /平面版本已锁定/);
  assert.match(workspace, /选择建筑风格与效果图参数/);
  assert.match(workspace, /参考图链接/);
  assert.match(route, /status = 'LOCKED'/);
  assert.match(route, /PLAN_VERSION_ALREADY_LOCKED/);
  assert.match(route, /RENDER_GENERATE/);
  assert.match(styleBrief, /assembleRenderPrompt/);
  assert.match(styleBrief, /preserveLockedPlan: true/);
});

test("Day 7 render generation, gallery, retry and final selection are present", async () => {
  const [gallery, route, service, schema] = await Promise.all([
    readFile("app/render-gallery.tsx", "utf8"),
    readFile("app/api/projects/[id]/renders/route.ts", "utf8"),
    readFile("lib/render-service.ts", "utf8"),
    readFile("db/schema.ts", "utf8"),
  ]);
  assert.match(gallery, /主入口、鸟瞰与庭院视角/);
  assert.match(gallery, /重新生成三种视角/);
  assert.match(gallery, /选择为最终图/);
  assert.match(route, /RENDER_TIMEOUT/);
  assert.match(route, /retryTask/);
  assert.match(route, /render_assets/);
  assert.match(service, /IMAGE_API_URL/);
  assert.match(service, /MAIN_ENTRANCE/);
  assert.match(schema, /renderAssets/);
});
