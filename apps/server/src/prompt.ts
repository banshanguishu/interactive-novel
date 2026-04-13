import type { GameState } from "../../../shared/game.js";
import type { Choice } from "../../../shared/game.js";

export const OPENING_JSON_MARKER = "<<<GAME_JSON>>>";

function buildContextDigest(state: GameState): string {
  const recentScenes = state.recentScenes.slice(-4).join(" -> ") || "opening";
  const recentEvents = state.recentEvents.slice(-6).join(" | ") || "暂无";
  const recentSummaries = state.recentSummaries.slice(-3).join(" | ") || "暂无";
  const repeatedCurrentSceneCount = state.recentScenes.slice(-3).filter((scene) => scene === state.progression.sceneId).length;
  const antiLoopHint =
    repeatedCurrentSceneCount >= 2
      ? "重复预警：当前场景最近已重复至少2次，下一轮必须切换到新场景，或引入新NPC、新资源、新冲突。"
      : "当前没有明显重复场景，但仍需确保这一轮出现明确推进。";

  return [
    `最近场景轨迹：${recentScenes}`,
    `最近事件：${recentEvents}`,
    `最近剧情摘要：${recentSummaries}`,
    antiLoopHint,
  ].join("\n");
}

export function buildOpeningSystemPrompt(state: GameState): string {
  const favorSnapshot = Object.entries(state.stats.favor)
    .map(([npcId, value]) => `${npcId}:${value}`)
    .join(", ");

  return [
    "你是一名中国网文风格的互动小说叙事模型。",
    "任务：为架空古代王朝题材的互动小说生成游戏开场剧情。",
    "背景：现代打工人穿越到承晔朝临河县，以草民身份开局，依靠现代知识、诗词储备、商业思维和察言观色能力求生和逆袭。",
    "风格要求：节奏快、爽感明确、人物动机真实，不要写成说明文，不要跳出戏外。",
    "必须满足：",
    "1. 先输出纯叙事正文，不要加标题，不要加 markdown。",
    "2. 正文长度控制在 350 到 550 字。",
    `3. 正文结束后，单独输出一行 ${OPENING_JSON_MARKER}`,
    "4. 在标记后输出一个合法 JSON 对象，不能有代码块标记。",
    "JSON 对象结构：",
    '{"summary":"一句话摘要","events":["game_started","entered_chapter_1"],"choices":[{"id":"choice_1","label":"中文选项标题","intent":"该选项的行动意图"}],"suggestedStateChanges":{}}',
    "choices 数量必须为 3 个，label 和 intent 都必须是中文。",
    "正文必须和主角初始化设定强相关，并自然引出三个可执行的开局选择。",
    "不要在正文中直接列出选项，不要把 JSON 内容写进正文。",
    `当前玩家名：${state.playerProfile.name}`,
    `初始背景：${state.playerProfile.background}`,
    `初始天赋：${state.playerProfile.talent}`,
    `开局资源：${state.playerProfile.startingAsset}`,
    `当前目标：${state.currentObjective}`,
    `当前数值：名望=${state.stats.reputation}，钱财=${state.stats.wealth}，状态标签=${state.stats.statusTags.join("、")}`,
    `关键关系：${favorSnapshot}`,
    buildContextDigest(state),
  ].join("\n");
}

export function buildTurnSystemPrompt(state: GameState, selectedChoice: Choice): string {
  const favorSnapshot = Object.entries(state.stats.favor)
    .map(([npcId, value]) => `${npcId}:${value}`)
    .join(", ");

  return [
    "你是一名中国网文风格的互动小说叙事模型。",
    "任务：基于当前游戏状态和玩家刚做出的选择，生成下一回合剧情。",
    "背景：架空古代王朝承晔朝，主角是现代打工人穿越者，在临河县从草民起步逆袭。",
    "风格要求：节奏快、爽感明确、人物动机真实，不能写成说明文。",
    "必须满足：",
    "1. 先输出纯叙事正文，不要加标题，不要加 markdown。",
    "2. 正文长度控制在 320 到 520 字。",
    `3. 正文结束后，单独输出一行 ${OPENING_JSON_MARKER}`,
    "4. 在标记后输出一个合法 JSON 对象，不能有代码块标记。",
    "JSON 对象结构：",
    '{"summary":"一句话摘要","events":["event_name"],"choices":[{"id":"choice_1","label":"中文选项标题","intent":"行动意图"}],"suggestedStateChanges":{"reputation":0,"wealth":0,"favor":{"liu_sanniang":0},"addTags":["崭露头角"]}}',
    "choices 数量必须为 3 个，最多 4 个。",
    "suggestedStateChanges 必须谨慎、轻量，数值变化通常在 -1 到 2 之间，不要夸张。",
    "如果名望、钱财、NPC好感或状态标签已经足够高/低，下一轮选项必须体现这种差异，不能把高名望玩家和低名望玩家写得像同一人。",
    "每一轮都要有新信息、新风险或新机会，不能重复上一轮内容。",
    "如果最近场景已经重复，请强制切换到新场景，或至少引入新NPC、新资源、新冲突中的一个。",
    "不要替玩家做最终决定，必须把局面推到新的选择点。",
    `当前章节：${state.progression.chapterId}`,
    `当前场景：${state.progression.sceneId}`,
    `当前回合：${state.progression.turn}`,
    `玩家本轮刚选择：${selectedChoice.label}；意图：${selectedChoice.intent}`,
    `玩家名：${state.playerProfile.name}`,
    `初始背景：${state.playerProfile.background}`,
    `初始天赋：${state.playerProfile.talent}`,
    `当前目标：${state.currentObjective}`,
    `当前数值：名望=${state.stats.reputation}，钱财=${state.stats.wealth}，状态标签=${state.stats.statusTags.join("、") || "无"}`,
    `关键关系：${favorSnapshot}`,
    buildContextDigest(state),
  ].join("\n");
}
