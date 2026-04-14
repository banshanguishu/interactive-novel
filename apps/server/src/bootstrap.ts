import type { StartGameRequest } from "../../../shared/api.js";
import type { Choice, GameState, StartGamePayload, StatusTag, StoryFlag } from "../../../shared/game.js";
import { createEmptyGameState } from "../../../shared/game.js";

function uniqueTags(tags: StatusTag[]): StatusTag[] {
  return [...new Set(tags)];
}

function uniqueFlags(flags: StoryFlag[]): StoryFlag[] {
  return [...new Set(flags)];
}

export function buildOpeningChoices(state: GameState): Choice[] {
  const baseChoices: Choice[] = [
    {
      id: "head_to_inn",
      label: "先去云来酒楼探探消息",
      intent: "在酒楼打听临河县的局势，并寻找愿意搭话的人。",
    },
    {
      id: "try_market",
      label: "先去早市找活路和吃食",
      intent: "优先解决温饱问题，观察本地最底层的运行方式。",
    },
  ];

  if (state.playerProfile.background === "落魄读书人" || state.playerProfile.talent === "诗词才情") {
    baseChoices.push({
      id: "visit_academy",
      label: "去松风书院附近碰碰运气",
      intent: "尝试接近书院圈子，用才学换到一个翻身机会。",
    });
  } else if (state.playerProfile.background === "小商贩学徒" || state.playerProfile.talent === "商业头脑") {
    baseChoices.push({
      id: "inspect_dock",
      label: "去安平码头看看有没有生意",
      intent: "寻找可以靠脑子赚到第一笔钱的机会。",
    });
  } else {
    baseChoices.push({
      id: "find_contact",
      label: "先想办法找能靠上的人",
      intent: "利用观察和试探，找一个愿意给你机会的本地人物。",
    });
  }

  return baseChoices;
}

export function buildOpeningNarrative(state: GameState): string {
  const { name, background, talent, startingAsset } = state.playerProfile;

  const backgroundText =
    background === "落魄读书人"
      ? "你醒来时，身上只剩半旧长衫，脑海里却多出一段寒门书生的模糊记忆。"
      : background === "小商贩学徒"
        ? "你醒来时正躺在一处破棚下，手心全是茧，像是常年替人搬货跑腿。"
        : "你在河堤边醒来，腹中空空，四周尽是对流民的冷眼与提防。";

  const talentText =
    talent === "诗词才情"
      ? "幸好，那些你在现代背过的诗词与文章，此刻像烙进骨子里一样清晰。"
      : talent === "商业头脑"
        ? "更重要的是，你对成本、买卖和人心算计的敏感，还稳稳留在脑子里。"
        : "你很快稳住情绪，开始下意识观察每个人的表情、站位和说话分寸。";

  const assetText =
    startingAsset === "一点碎银"
      ? "袖口里还藏着几枚碎银，虽然不多，却足够你抢下第一口喘息。"
      : startingAsset === "一封旧人情信"
        ? "贴身藏着的一封旧信最惹眼，信纸发黄，但落款显然不是普通人物。"
        : "你身边只剩一件还能换钱的旧物，值不值钱，全看你怎么开口。";

  return [
    `你叫${name}。加班后的最后一个念头还停在电脑屏幕前，再睁眼时，已经置身承晔朝临河县。`,
    backgroundText,
    talentText,
    assetText,
    "临河县不大，却处处有门道。云来酒楼最藏消息，早市最见人情冷暖，松风书院能改命，安平码头则能见真金白银。",
    "你很清楚，自己现在不是天命之子，只是一个随时会被这座小县城吞下去的草民。第一步，必须先活下去，再想办法让别人看见你的价值。",
  ].join("");
}

function applyBackgroundBonuses(state: GameState): void {
  switch (state.playerProfile.background) {
    case "落魄读书人":
      state.stats.reputation += 1;
      state.stats.statusTags = uniqueTags([...state.stats.statusTags, "得书院赏识"]);
      break;
    case "小商贩学徒":
      state.stats.wealth += 1;
      break;
    case "流民出身的机灵人":
      state.stats.statusTags = uniqueTags([...state.stats.statusTags, "手头拮据"]);
      state.stats.favor.liu_sanniang += 1;
      break;
  }
}

function applyTalentBonuses(state: GameState): void {
  switch (state.playerProfile.talent) {
    case "诗词才情":
      state.stats.reputation += 1;
      break;
    case "商业头脑":
      state.stats.wealth += 1;
      break;
    case "察言观色":
      state.stats.favor.liu_sanniang += 1;
      break;
  }
}

function applyAssetBonuses(state: GameState): void {
  switch (state.playerProfile.startingAsset) {
    case "一点碎银":
      state.storyFlags = uniqueFlags([...state.storyFlags, "earned_first_silver"]);
      break;
    case "一封旧人情信":
      state.storyFlags = uniqueFlags([...state.storyFlags, "heard_of_xiao_qingyi"]);
      break;
    case "一件可变卖旧物":
      state.stats.statusTags = uniqueTags([...state.stats.statusTags, "欠下人情"]);
      break;
  }
}

export function createBootstrappedState(input: StartGameRequest): GameState {
  const state = createEmptyGameState(input);

  applyBackgroundBonuses(state);
  applyTalentBonuses(state);
  applyAssetBonuses(state);

  return state;
}

export function buildFallbackOpening(state: GameState): StartGamePayload["opening"] {
  return {
    narrative: buildOpeningNarrative(state),
    choices: buildOpeningChoices(state),
    suggestedStateChanges: {},
    events: ["game_started", "entered_chapter_1"],
    summary: `${state.playerProfile.name}在临河县醒来，开始寻找第一个立足机会。`,
  };
}

export function finalizeOpeningState(
  state: GameState,
  opening: StartGamePayload["opening"],
): StartGamePayload {
  state.progression.turn = 1;
  state.currentAnchorId = "ch1_survive";
  state.lastChoices = opening.choices;
  state.recentSummaries = [opening.summary];
  state.recentScenes = [state.progression.sceneId];
  state.recentEvents = [...opening.events];
  state.lastUpdatedAt = new Date().toISOString();

  return { state, opening };
}

export function bootstrapGame(input: StartGameRequest): StartGamePayload {
  const state = createBootstrappedState(input);

  return finalizeOpeningState(state, buildFallbackOpening(state));
}
