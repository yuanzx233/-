import assert from "node:assert/strict";
import test from "node:test";
import { generateProjectReportHtml } from "../lib/report-generator";

test("generates fourteen fixed report sections with consistent metrics", () => {
  const result = generateProjectReportHtml({
    project: { name: "测试住宅", address: "示例村", updatedAt: "2026-08-21T00:00:00Z" },
    site: { boundary: { areaSquareMeters: 432, perimeterMeters: 84 }, siteAnalysis: { northAngleDegrees: 0, roadSides: ["south"], entranceSide: "south" }, previewSvg: '<svg viewBox="0 0 10 10"></svg>' },
    requirements: { requirements: { floors: 1, bedroomCount: 2, bathroomCount: 1, areaMin: 80, areaMax: 120, priorities: ["采光"] } },
    plan: { selectedPlanId: "P1", plans: [{ id: "P1", totalArea: 80, svg: '<svg viewBox="0 0 10 10"></svg>', rooms: [{ name: "客厅", floor: 1, area: 50 }, { name: "卧室", floor: 1, area: 30 }] }] },
    style: { style: { architecturalStyle: "现代简约", roofType: "平屋顶", colorScheme: "米白与深灰", materials: ["米白真石漆"] } }, renders: [],
  });
  assert.equal((result.html.match(/data-section=/g) || []).length, 14);
  assert.equal(result.qa.metricsConsistent, true);
  assert.match(result.html, /80\.0 ㎡/);
  assert.match(result.html, /window\.__REPORT_QA__/);
});
