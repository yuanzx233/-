import { getBindings } from "../db/runtime";
import type { RenderPromptPayload } from "./style-brief";

export const renderViews = ["MAIN_ENTRANCE", "AERIAL", "COURTYARD"] as const;
export type RenderView = (typeof renderViews)[number];

export const renderViewLabels: Record<RenderView, string> = {
  MAIN_ENTRANCE: "主入口视角",
  AERIAL: "鸟瞰视角",
  COURTYARD: "庭院视角",
};

const viewDirections: Record<RenderView, string> = {
  MAIN_ENTRANCE: "人视高度 1.6 米，正对主入口略带侧向透视，清晰表现门廊、入口雨棚与主要立面",
  AERIAL: "约 35 度低空鸟瞰，完整表现屋顶、建筑体量、入口和场地关系",
  COURTYARD: "庭院内部人视角，表现室内外联系、绿化、铺地和生活尺度",
};

export function buildViewPrompt(payload: RenderPromptPayload, view: RenderView) {
  return {
    ...payload,
    renderVersion: "DAY7_V1" as const,
    view,
    viewLabel: renderViewLabels[view],
    prompt: `${payload.prompt} 预置镜头：${viewDirections[view]}。保持同一建筑、同一材质和同一色彩方案。`,
    negativePrompt: `${payload.negativePrompt} 不得改变相机视角要求，不得生成多栋住宅。`,
  };
}

export async function generateRenderAsset(payload: RenderPromptPayload, view: RenderView) {
  const prompt = buildViewPrompt(payload, view);
  const bindings = getBindings() as ReturnType<typeof getBindings> & { IMAGE_API_URL?: string; IMAGE_API_KEY?: string };
  if (bindings.IMAGE_API_URL) {
    const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), 45_000);
    try {
      const response = await fetch(bindings.IMAGE_API_URL, { method: "POST", headers: { "content-type": "application/json", ...(bindings.IMAGE_API_KEY ? { authorization: `Bearer ${bindings.IMAGE_API_KEY}` } : {}) }, body: JSON.stringify({ prompt: prompt.prompt, negativePrompt: prompt.negativePrompt, aspectRatio: "4:3", outputFormat: "png" }), signal: controller.signal });
      if (!response.ok) throw new Error(`IMAGE_PROVIDER_${response.status}`);
      return { bytes: new Uint8Array(await response.arrayBuffer()), contentType: response.headers.get("content-type") ?? "image/png", provider: "external-image-api", prompt };
    } finally { clearTimeout(timeout); }
  }
  const svg = conceptRenderSvg(payload, view);
  return { bytes: new TextEncoder().encode(svg), contentType: "image/svg+xml", provider: "built-in-concept-renderer", prompt };
}

function conceptRenderSvg(payload: RenderPromptPayload, view: RenderView) {
  const palette = payload.style.colorScheme.includes("木") ? ["#e9e0d0", "#9b7658", "#3e4c48"] : payload.style.colorScheme.includes("炭黑") ? ["#dddcd7", "#4d514f", "#9f704f"] : ["#eee7db", "#b68662", "#314a43"];
  const roof = payload.style.roofType.includes("坡") ? `<path d="M180 310 L600 120 L1020 310 Z" fill="${palette[1]}"/><path d="M600 120 L1040 310 L930 345 L600 195 Z" fill="#765845"/>` : `<path d="M180 285 H1020 V340 H180 Z" fill="${palette[1]}"/>`;
  const transform = view === "AERIAL" ? "translate(0 -50) scale(1 .88) skewX(-4)" : view === "COURTYARD" ? "translate(-70 20) scale(1.08)" : "";
  const courtyard = view === "COURTYARD" ? `<path d="M0 650 Q310 540 620 650 T1200 650 V800 H0Z" fill="#b9c9a6"/><circle cx="180" cy="590" r="72" fill="#718b63"/><circle cx="1080" cy="570" r="88" fill="#78946a"/>` : `<path d="M0 690 H1200 V800 H0Z" fill="#c7d2b7"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800" viewBox="0 0 1200 800" role="img" aria-label="${escapeXml(renderViewLabels[view])}"><defs><linearGradient id="sky" x2="0" y2="1"><stop stop-color="#cddde0"/><stop offset="1" stop-color="#f5efe4"/></linearGradient></defs><rect width="1200" height="800" fill="url(#sky)"/>${courtyard}<g transform="${transform}">${roof}<path d="M210 320 H990 V690 H210 Z" fill="${palette[0]}" stroke="${palette[2]}" stroke-width="8"/><path d="M470 430 H730 V690 H470 Z" fill="${palette[1]}"/><path d="M535 470 H665 V690 H535 Z" fill="#59493e"/><g fill="#9fc0ca" stroke="${palette[2]}" stroke-width="7"><rect x="275" y="420" width="150" height="145"/><rect x="775" y="420" width="150" height="145"/></g><path d="M420 690 H780 L850 760 H350 Z" fill="#c7b69d"/><path d="M475 705 H725" stroke="#8d765f" stroke-width="7"/></g><text x="54" y="64" fill="#173d34" font-family="Arial, sans-serif" font-size="25" font-weight="700">${escapeXml(payload.style.architecturalStyle)} · ${escapeXml(renderViewLabels[view])}</text><text x="54" y="99" fill="#586d66" font-family="Arial, sans-serif" font-size="16">${escapeXml(payload.style.materials.join(" · "))} · ${escapeXml(payload.style.roofType)}</text><text x="1145" y="755" text-anchor="end" fill="#6b746f" font-family="Arial, sans-serif" font-size="13">概念效果预览 · 锁定平面 ${escapeXml(payload.selectedPlanId)}</text></svg>`;
}

function escapeXml(value: string) { return value.replace(/[<>&"']/g, char => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" })[char]!); }
