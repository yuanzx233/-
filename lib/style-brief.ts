export const architecturalStyles = ["现代简约", "新中式", "现代乡村", "侘寂自然", "轻法式"] as const;
export const materialOptions = ["米白真石漆", "浅灰石材", "暖色木饰面", "清水混凝土", "深灰金属"] as const;
export const colorOptions = ["米白与深灰", "暖白与木色", "浅灰与炭黑", "砂岩与棕褐"] as const;
export const roofOptions = ["平屋顶", "双坡屋顶", "四坡屋顶", "坡屋顶与平屋顶组合"] as const;

export type StyleSelection = {
  architecturalStyle: string;
  materials: string[];
  colorScheme: string;
  roofType: string;
  referenceImage?: string;
  notes?: string;
};

export type RenderPromptPayload = {
  promptVersion: "DAY6_V1";
  planVersionId: string;
  selectedPlanId: string;
  templateId: string;
  style: StyleSelection;
  prompt: string;
  negativePrompt: string;
  downstream: { taskType: "RENDER_GENERATE"; preserveLockedPlan: true };
};

export function validateStyleSelection(value: Partial<StyleSelection>): string[] {
  const errors: string[] = [];
  if (!value.architecturalStyle) errors.push("请选择建筑风格");
  if (!value.materials?.length) errors.push("请至少选择一种外立面材质");
  if (!value.colorScheme) errors.push("请选择主色方案");
  if (!value.roofType) errors.push("请选择屋顶形式");
  if ((value.materials?.length ?? 0) > 3) errors.push("外立面材质最多选择三种");
  return errors;
}

export function assembleRenderPrompt(input: {
  planVersionId: string;
  selectedPlanId: string;
  templateId: string;
  style: StyleSelection;
}): RenderPromptPayload {
  const { style } = input;
  return {
    promptVersion: "DAY6_V1",
    planVersionId: input.planVersionId,
    selectedPlanId: input.selectedPlanId,
    templateId: input.templateId,
    style,
    prompt: [
      "自建房建筑外观概念效果图，严格保持已锁定平面方案的建筑轮廓、开间进深、入口位置与层数，不改变房间关系。",
      `建筑风格：${style.architecturalStyle}。`,
      `外立面材质：${style.materials.join("、")}。`,
      `主色方案：${style.colorScheme}。`,
      `屋顶形式：${style.roofType}。`,
      style.referenceImage ? `参考图：${style.referenceImage}，仅参考风格、材质和色彩，不复制建筑体量。` : "无参考图，按所选风格建立一致的立面语言。",
      style.notes ? `补充要求：${style.notes}。` : "",
      "真实建筑摄影质感，村镇独栋住宅尺度，日间柔和自然光，结构合理，材质节点清晰，正立面与入口可读。",
    ].filter(Boolean).join(" "),
    negativePrompt: "不得改动锁定平面，不得增减楼层，不得虚构悬挑结构，不得遮挡主入口，不出现文字、水印、人物畸变或不合理门窗。",
    downstream: { taskType: "RENDER_GENERATE", preserveLockedPlan: true },
  };
}
