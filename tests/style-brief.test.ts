import assert from "node:assert/strict";
import test from "node:test";
import { assembleRenderPrompt, validateStyleSelection } from "../lib/style-brief";

test("requires the complete Day 6 style selection", () => {
  assert.deepEqual(validateStyleSelection({}), ["请选择建筑风格", "请至少选择一种外立面材质", "请选择主色方案", "请选择屋顶形式"]);
  assert.deepEqual(validateStyleSelection({ architecturalStyle: "现代简约", materials: ["米白真石漆"], colorScheme: "米白与深灰", roofType: "平屋顶" }), []);
});

test("assembles a downstream render task bound to the locked plan", () => {
  const payload = assembleRenderPrompt({
    planVersionId: "plan-v6",
    selectedPlanId: "P1",
    templateId: "HT-T005",
    style: { architecturalStyle: "新中式", materials: ["米白真石漆", "暖色木饰面"], colorScheme: "暖白与木色", roofType: "双坡屋顶", referenceImage: "https://example.com/reference.jpg" },
  });
  assert.equal(payload.planVersionId, "plan-v6");
  assert.equal(payload.downstream.taskType, "RENDER_GENERATE");
  assert.equal(payload.promptVersion, "DAY7_V1");
  assert.deepEqual(payload.views, ["MAIN_ENTRANCE", "AERIAL", "COURTYARD"]);
  assert.equal(payload.minimumDeliverables, 2);
  assert.equal(payload.downstream.preserveLockedPlan, true);
  assert.match(payload.prompt, /严格保持已锁定平面方案/);
  assert.match(payload.prompt, /新中式/);
  assert.match(payload.prompt, /HT-T005|参考图/);
});
