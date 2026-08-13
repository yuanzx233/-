export type PlanTemplateResource = {
  id: string;
  resourcePath: string;
  name: string;
  aspect: number;
  floors: number;
  bedrooms: number;
  layout: "central" | "side" | "courtyard";
  tags: string[];
  adjustable: { rotate: boolean; minScale: number; maxScale: number };
};

const names = ["南向通厅", "中央楼梯", "侧厅紧凑", "双面采光", "适老首层", "庭院联动", "动静分层", "方正经济"];
const tags = [
  ["采光", "通风"], ["动静分区", "适老"], ["收纳", "经济"], ["采光", "通风"],
  ["适老", "动静分区"], ["庭院", "采光"], ["动静分区", "收纳"], ["经济", "收纳"],
];

/** 项目内置户型资源库；每个条目代表一份可检索、可调正的既有模板。 */
export const projectPlanTemplateLibrary: PlanTemplateResource[] = Array.from({ length: 16 }, (_, index) => ({
  id: `LIB-${String(index + 1).padStart(2, "0")}`,
  resourcePath: `/plan-library/base-${String(index + 1).padStart(2, "0")}.json`,
  name: names[index % names.length],
  aspect: [0.72, 0.8, 0.9, 1, 1.12, 1.25, 1.38, 1.5][index % 8],
  floors: index < 5 ? 1 : index < 12 ? 2 : 3,
  bedrooms: 2 + (index % 5),
  layout: (["central", "side", "courtyard"] as const)[index % 3],
  tags: tags[index % tags.length],
  adjustable: { rotate: true, minScale: 0.88, maxScale: 1.12 },
}));
