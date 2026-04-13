import type { GameState } from "../../../shared/game.js";

export const OPENING_JSON_MARKER = "<<<GAME_JSON>>>";

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
  ].join("\n");
}
