import type { TurnRequest } from "../../../shared/api.js";
import type { Choice, GameState, SceneId, StateDelta, StatusTag, StoryFlag, TurnResult } from "../../../shared/game.js";

type ChoiceOutcome = {
  sceneId: SceneId;
  objective?: string;
  preSceneDelta: StateDelta;
  events: string[];
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function uniqueStrings<T extends string>(items: T[]): T[] {
  return [...new Set(items)];
}

function normalizeText(value: string): string {
  return value.trim().toLowerCase();
}

function normalizeChineseText(value: string): string {
  return value.replace(/\s+/g, "");
}

function textContains(text: string, keywords: string[]): boolean {
  return keywords.some((keyword) => text.includes(keyword));
}

function createOutcome(
  sceneId: SceneId,
  objective: string,
  preSceneDelta: StateDelta,
  events: string[],
): ChoiceOutcome {
  return {
    sceneId,
    objective,
    preSceneDelta,
    events,
  };
}

function mergeDelta(base: StateDelta, extra: StateDelta): StateDelta {
  const mergedFavor: NonNullable<StateDelta["favor"]> = { ...(base.favor ?? {}) };

  for (const [key, value] of Object.entries(extra.favor ?? {})) {
    mergedFavor[key as keyof typeof mergedFavor] = (mergedFavor[key as keyof typeof mergedFavor] ?? 0) + value;
  }

  return {
    reputation: (base.reputation ?? 0) + (extra.reputation ?? 0),
    wealth: (base.wealth ?? 0) + (extra.wealth ?? 0),
    favor: mergedFavor,
    addTags: uniqueStrings([...(base.addTags ?? []), ...(extra.addTags ?? [])]),
    removeTags: uniqueStrings([...(base.removeTags ?? []), ...(extra.removeTags ?? [])]),
    addItems: uniqueStrings([...(base.addItems ?? []), ...(extra.addItems ?? [])]),
    removeItems: uniqueStrings([...(base.removeItems ?? []), ...(extra.removeItems ?? [])]),
    addFlags: uniqueStrings([...(base.addFlags ?? []), ...(extra.addFlags ?? [])]),
  };
}

export function findChoiceById(state: GameState, choiceId: string): Choice | null {
  return state.lastChoices.find((choice) => choice.id === choiceId) ?? null;
}

export function buildChoiceOutcome(state: GameState, choice: Choice): ChoiceOutcome {
  const rawText = normalizeText(`${choice.id} ${choice.label} ${choice.intent}`);
  const text = normalizeChineseText(rawText);

  const exactOutcome = buildExactChoiceOutcome(state, choice.id);

  if (exactOutcome) {
    return exactOutcome;
  }

  let outcome: ChoiceOutcome = {
    sceneId: "crossroads",
    objective: "在临河县站稳脚跟，把刚得到的机会变成真正的人脉或收益。",
    preSceneDelta: {},
    events: ["choice_committed"],
  };

  if (textContains(text, ["酒楼", "探消息", "消息", "打听", "掌柜", "柳三娘"])) {
    outcome = mergeChoiceOutcome(outcome, {
      sceneId: state.progression.sceneId === "inn" ? "crossroads" : "inn",
      objective:
        state.progression.sceneId === "inn"
          ? "把在酒楼里换到的消息，立刻转成更具体的行动和机会。"
          : "从云来酒楼撬出临河县最有价值的消息。",
      preSceneDelta: {
        favor: { liu_sanniang: 1 },
        reputation: state.stats.reputation >= 3 ? 1 : 0,
        addFlags: ["met_liu_sanniang"],
      },
      events: ["entered_inn_network"],
    });
  }

  if (textContains(text, ["早市", "吃食", "活路", "摊", "生计", "布货街"])) {
    outcome = mergeChoiceOutcome(outcome, {
      sceneId: "market",
      objective: "先把温饱和立足问题处理掉，再从早市里找第一个机会。",
      preSceneDelta: {
        wealth: state.stats.wealth <= 2 ? 2 : 1,
        addTags: state.stats.wealth <= 1 ? ["手头拮据"] : [],
      },
      events: ["entered_market_loop"],
    });
  }

  if (textContains(text, ["书院", "诗", "文会", "教谕", "才学"])) {
    outcome = mergeChoiceOutcome(outcome, {
      sceneId: state.progression.sceneId === "academy" ? "crossroads" : "academy",
      objective:
        state.progression.sceneId === "academy"
          ? "把刚在书院得来的名声，转成真正能落地的人情或邀约。"
          : "用才学在书院圈子里打开局面，换一张往上走的门票。",
      preSceneDelta: {
        reputation: state.playerProfile.talent === "诗词才情" ? 2 : 1,
        favor: { shen_yanshu: state.stats.reputation >= 3 ? 2 : 1 },
        addTags: ["得书院赏识"],
        addFlags: ["met_shen_yanshu", "entered_academy_circle", "gained_local_reputation"],
      },
      events: ["entered_academy_circle"],
    });
  }

  if (textContains(text, ["码头", "货", "商", "分账", "生意", "顾家", "银钱"])) {
    outcome = mergeChoiceOutcome(outcome, {
      sceneId: state.progression.sceneId === "dock" ? "crossroads" : "dock",
      objective:
        state.progression.sceneId === "dock"
          ? "把码头上的试手，推进成更稳定的商路或更高层的合作。"
          : "把一次买卖做成，让临河县真正有人开始记住你的本事。",
      preSceneDelta: {
        wealth: state.playerProfile.talent === "商业头脑" ? 3 : 2,
        favor: {
          ma_huichuan: 1,
          gu_mingzhu: text.includes("顾") || state.stats.wealth >= 4 ? 1 : 0,
        },
        addFlags: ["met_ma_huichuan", "entered_business_circle"],
      },
      events: ["entered_business_circle"],
    });
  }

  if (textContains(text, ["旧信", "人情", "贵人", "靠上的人", "求见", "拜访"])) {
    outcome = mergeChoiceOutcome(outcome, {
      sceneId: "crossroads",
      objective: "把这份人情或线索转成真正能依靠的人脉。",
      preSceneDelta: {
        reputation: 1,
        addTags: ["欠下人情"],
        addItems: state.stats.inventory.includes("旧人情信") ? ["密约线索"] : [],
        removeItems: state.stats.inventory.includes("旧人情信") ? ["旧人情信"] : [],
        addFlags: ["heard_of_xiao_qingyi"],
      },
      events: ["used_social_leverage"],
    });
  }

  if (textContains(text, ["县衙", "文书", "官", "手续"])) {
    outcome = mergeChoiceOutcome(outcome, {
      sceneId: "county_office",
      objective: "在规矩和人情之间找缝隙，给自己争一个合法立足点。",
      preSceneDelta: {
        reputation: 1,
      },
      events: ["approached_county_office"],
    });
  }

  return outcome;
}

function buildExactChoiceOutcome(state: GameState, choiceId: string): ChoiceOutcome | null {
  switch (choiceId) {
    case "head_to_inn":
    case "return_to_inn":
      return createOutcome(
        "inn",
        "先在酒楼里摸清局势，找出最值得下注的人和消息。",
        {
          favor: { liu_sanniang: 1 },
          addFlags: ["met_liu_sanniang"],
        },
        ["entered_inn_network"],
      );
    case "try_market":
      return createOutcome(
        "market",
        "先在早市把吃饭和立足问题解决，再找第一个能赚钱的口子。",
        {
          wealth: 1,
        },
        ["entered_market_loop"],
      );
    case "visit_academy":
    case "seek_academy_route":
      return createOutcome(
        "academy",
        "用才学和见识在书院圈子里打开局面。",
        {
          reputation: state.playerProfile.talent === "诗词才情" ? 2 : 1,
          favor: { shen_yanshu: 1 },
          addTags: ["得书院赏识"],
          addFlags: ["met_shen_yanshu", "entered_academy_circle"],
        },
        ["entered_academy_circle"],
      );
    case "inspect_dock":
    case "seek_business_route":
      return createOutcome(
        "dock",
        "去码头试一把，把脑子换成真正的银钱和门路。",
        {
          wealth: 2,
          favor: { ma_huichuan: 1 },
          addFlags: ["met_ma_huichuan", "entered_business_circle"],
        },
        ["entered_business_circle"],
      );
    case "find_contact":
      return createOutcome(
        "crossroads",
        "把手里的线索和人情变成真正可依靠的人脉。",
        {
          reputation: 1,
          addFlags: ["heard_of_xiao_qingyi"],
        },
        ["used_social_leverage"],
      );
    case "ask_liu_for_rumor":
      return createOutcome(
        "crossroads",
        "顺着柳三娘给出的消息去找真正能改局的人或事。",
        {
          favor: { liu_sanniang: 1 },
          reputation: 1,
          addFlags: ["met_liu_sanniang"],
        },
        ["secured_key_rumor"],
      );
    case "observe_guests":
      return createOutcome(
        "crossroads",
        "从酒楼里的细节里挑出最值得接近的对象。",
        {
          favor: { liu_sanniang: 1 },
        },
        ["profiled_key_figures"],
      );
    case "quote_poem_to_stand_out":
      return createOutcome(
        "academy",
        "借一段诗句闯进读书人圈子，让真正有分量的人注意到你。",
        {
          reputation: 2,
          favor: { shen_yanshu: 1 },
          addTags: ["得书院赏识"],
          addFlags: ["met_shen_yanshu", "entered_academy_circle", "gained_local_reputation"],
        },
        ["poetry_reputation_triggered"],
      );
    case "liu_private_lead":
      return createOutcome(
        "county_office",
        "把柳三娘递来的暗线，换成更有分量的门路。",
        {
          favor: { liu_sanniang: 1 },
          reputation: 1,
        },
        ["received_private_lead"],
      );
    case "barter_for_profit":
      return createOutcome(
        "market",
        "用算账和讲价把第一笔真正像样的钱攥在手里。",
        {
          wealth: 2,
          addFlags: ["earned_first_silver"],
        },
        ["earned_market_profit"],
      );
    case "help_vendor_gain_trust":
      return createOutcome(
        "crossroads",
        "先换人情，再把这份人情导向更大的机会。",
        {
          reputation: 1,
          addTags: ["欠下人情"],
        },
        ["earned_vendor_trust"],
      );
    case "follow_supply_clue":
      return createOutcome(
        "dock",
        "顺着货路线索去码头，把零散消息变成更大的盘子。",
        {
          wealth: 1,
          favor: { ma_huichuan: 1 },
          addFlags: ["met_ma_huichuan", "entered_business_circle"],
        },
        ["followed_supply_chain"],
      );
    case "buy_information_bundle":
      return createOutcome(
        "crossroads",
        "花小钱买来的情报，需要立刻兑现成更大的推进。",
        {
          wealth: -1,
          reputation: 1,
        },
        ["purchased_information"],
      );
    case "join_poetry_gathering":
      return createOutcome(
        "crossroads",
        "把文会上的惊艳，转成真正能落地的邀约和背书。",
        {
          reputation: 2,
          favor: { shen_yanshu: 1 },
          addFlags: ["entered_academy_circle", "gained_local_reputation"],
        },
        ["won_poetry_gathering"],
      );
    case "speak_with_shen":
      return createOutcome(
        "crossroads",
        "把沈砚书的赏识变成下一步更稳的上升路线。",
        {
          favor: { shen_yanshu: 2 },
          reputation: 1,
          addFlags: ["met_shen_yanshu"],
        },
        ["secured_shen_support"],
      );
    case "watch_rivals":
      return createOutcome(
        "inn",
        "先摸清谁在针对你，再决定该先联手谁、先防谁。",
        {
          addTags: ["被豪强盯上"],
          reputation: 1,
        },
        ["detected_hidden_rivals"],
      );
    case "accept_patron_notice":
      return createOutcome(
        "county_office",
        "顺着高位人物的试探往上走，看看谁真的愿意给你机会。",
        {
          reputation: 2,
          addFlags: ["heard_of_xiao_qingyi"],
        },
        ["received_patron_notice"],
      );
    case "pitch_business_plan":
      return createOutcome(
        "dock",
        "让码头上的人明白，你不是只会动嘴的人。",
        {
          wealth: 2,
          favor: { ma_huichuan: 1 },
        },
        ["pitched_business_plan"],
      );
    case "approach_gu_family":
      return createOutcome(
        "crossroads",
        "把一桩买卖做成进顾家视线的敲门砖。",
        {
          wealth: 1,
          favor: { gu_mingzhu: 2 },
          addFlags: ["met_gu_mingzhu"],
        },
        ["approached_gu_family"],
      );
    case "probe_ma":
      return createOutcome(
        "inn",
        "先摸清马会川的底牌，省得以后被他牵着走。",
        {
          favor: { ma_huichuan: 1 },
          addTags: ["被豪强盯上"],
        },
        ["probed_ma_huichuan"],
      );
    case "expand_trade_scope":
      return createOutcome(
        "crossroads",
        "把眼前的小买卖扩成更像样的局，逼更大的人物出手。",
        {
          wealth: 2,
          favor: { gu_mingzhu: 1, ma_huichuan: 1 },
          addFlags: ["entered_business_circle"],
        },
        ["expanded_trade_scope"],
      );
    case "secure_document":
      return createOutcome(
        "county_office",
        "拿到能让自己站稳脚跟的文书，不再任人拿捏。",
        {
          reputation: 1,
          wealth: -1,
        },
        ["secured_document"],
      );
    case "trade_information":
      return createOutcome(
        "crossroads",
        "把消息变成官面上的方便，再顺势往更高处走。",
        {
          reputation: 1,
          favor: { liu_sanniang: 1 },
        },
        ["traded_information"],
      );
    case "retreat_to_inn":
      return createOutcome(
        "inn",
        "先退一步，在酒楼重新盘算，再决定下一步往哪边压。",
        {
          favor: { liu_sanniang: 1 },
        },
        ["retreated_to_inn"],
      );
    case "use_reputation_pressure":
      return createOutcome(
        "crossroads",
        "借着现有名声逼对方正视你，换来更像样的机会。",
        {
          reputation: 1,
        },
        ["used_reputation_pressure"],
      );
    case "answer_high_level_invite":
      return createOutcome(
        "crossroads",
        "赴一场更高层的邀约，把临河县的小局接到更大的桌上。",
        {
          reputation: 2,
          favor: { gu_mingzhu: 1, shen_yanshu: 1 },
          addFlags: ["heard_of_xiao_qingyi"],
        },
        ["answered_high_level_invite"],
      );
    default:
      return null;
  }
}

function mergeChoiceOutcome(base: ChoiceOutcome, extra: ChoiceOutcome): ChoiceOutcome {
  return {
    sceneId: extra.sceneId,
    objective: extra.objective ?? base.objective,
    preSceneDelta: mergeDelta(base.preSceneDelta, extra.preSceneDelta),
    events: uniqueStrings([...base.events, ...extra.events]),
  };
}

function getRecentSceneCount(state: GameState, sceneId: SceneId): number {
  return state.recentScenes.slice(-3).filter((scene) => scene === sceneId).length;
}

function getBreakoutScene(state: GameState, currentScene: SceneId): SceneId {
  switch (currentScene) {
    case "academy":
      return state.stats.reputation >= 4 ? "county_office" : "crossroads";
    case "inn":
      return state.stats.reputation >= 3 ? "academy" : "market";
    case "dock":
      return state.stats.wealth >= 5 ? "crossroads" : "inn";
    case "market":
      return state.stats.wealth >= 3 ? "dock" : "inn";
    case "county_office":
      return "crossroads";
    case "crossroads":
      return state.stats.reputation >= state.stats.wealth ? "academy" : "dock";
    case "opening":
    default:
      return "inn";
  }
}

function getBreakoutObjective(sceneId: SceneId): string {
  switch (sceneId) {
    case "academy":
      return "别再原地消耗了，去书院把名声换成真正能往上走的台阶。";
    case "dock":
      return "局面需要新的变量，去码头把消息变成收益和合作。";
    case "inn":
      return "先回到消息场，换一条新线，不要在旧局里空转。";
    case "market":
      return "先把局面落到现实收益上，再谈下一步的名声和人情。";
    case "county_office":
      return "该把前面的名声和线索，推进到更有分量的官面节点了。";
    case "crossroads":
    default:
      return "现在必须换一条路，把已有成果接到新的节点上。";
  }
}

function enforceForwardMotion(state: GameState, outcome: ChoiceOutcome): ChoiceOutcome {
  const repeated = getRecentSceneCount(state, outcome.sceneId);

  if (repeated < 2) {
    return outcome;
  }

  const breakoutScene = getBreakoutScene(state, outcome.sceneId);

  return {
    ...outcome,
    sceneId: breakoutScene,
    objective: getBreakoutObjective(breakoutScene),
    events: uniqueStrings([...outcome.events, "loop_breaker_transition"]),
  };
}

function syncDerivedStatus(state: GameState): void {
  const tags = new Set<StatusTag>(state.stats.statusTags);

  if (state.stats.reputation >= 3) {
    tags.add("小有名气");
    state.storyFlags = uniqueStrings([...state.storyFlags, "gained_local_reputation"]);
  } else {
    tags.delete("小有名气");
  }

  if (state.stats.reputation >= 6 || state.stats.favor.shen_yanshu >= 3 || state.stats.favor.gu_mingzhu >= 3) {
    tags.add("崭露头角");
  }

  if (state.stats.wealth <= 1) {
    tags.add("手头拮据");
  } else {
    tags.delete("手头拮据");
  }

  if (state.storyFlags.includes("met_ma_huichuan") && state.stats.reputation >= 4) {
    tags.add("被豪强盯上");
  }

  if (state.storyFlags.includes("met_shen_yanshu") || state.stats.favor.shen_yanshu >= 2) {
    tags.add("得书院赏识");
  }

  state.stats.statusTags = [...tags];
}

export function applyStateDelta(state: GameState, delta: StateDelta): void {
  state.stats.reputation = clamp(state.stats.reputation + (delta.reputation ?? 0), 0, 20);
  state.stats.wealth = clamp(state.stats.wealth + (delta.wealth ?? 0), 0, 99);

  if (delta.favor) {
    for (const [npcId, value] of Object.entries(delta.favor)) {
      const current = state.stats.favor[npcId as keyof typeof state.stats.favor] ?? 0;
      state.stats.favor[npcId as keyof typeof state.stats.favor] = clamp(current + value, -10, 20);
    }
  }

  if (delta.addTags?.length) {
    state.stats.statusTags = uniqueStrings([...state.stats.statusTags, ...delta.addTags]);
  }

  if (delta.removeTags?.length) {
    state.stats.statusTags = state.stats.statusTags.filter((tag) => !delta.removeTags?.includes(tag));
  }

  if (delta.addItems?.length) {
    state.stats.inventory = uniqueStrings([...state.stats.inventory, ...delta.addItems]);
  }

  if (delta.removeItems?.length) {
    state.stats.inventory = state.stats.inventory.filter((item) => !delta.removeItems?.includes(item));
  }

  if (delta.addFlags?.length) {
    state.storyFlags = uniqueStrings([...state.storyFlags, ...delta.addFlags]);
  }

  syncDerivedStatus(state);
}

function buildFallbackChoicesForScene(state: GameState): Choice[] {
  switch (state.progression.sceneId) {
    case "inn": {
      const choices: Choice[] = [
        {
          id: "ask_liu_for_rumor",
          label: "请柳三娘指一条最值得押注的线",
          intent: "用你的判断和姿态换一条能改变局面的消息。",
        },
        {
          id: "observe_guests",
          label: "坐在角落里先观察酒楼里的人",
          intent: "不急着出手，先判断谁值得接近，谁碰了会惹祸。",
        },
        {
          id: "quote_poem_to_stand_out",
          label: "借一段诗句试探全场反应",
          intent: "用才情制造存在感，看看谁会先注意到你。",
        },
      ];

      if (state.stats.favor.liu_sanniang >= 2) {
        choices.push({
          id: "liu_private_lead",
          label: "让柳三娘私下引你见一位真正有用的人",
          intent: "把她对你的好感换成一次高价值引荐。",
        });
      }

      return choices.slice(0, 4);
    }
    case "market": {
      const choices: Choice[] = [
        {
          id: "barter_for_profit",
          label: "靠算账和讲价先赚一笔小钱",
          intent: "从最直接的生意里证明你不只是个落魄路人。",
        },
        {
          id: "help_vendor_gain_trust",
          label: "帮摊贩解围，换一份人情和消息",
          intent: "先不急着挣钱，优先换取后续能用的人情。",
        },
        {
          id: "follow_supply_clue",
          label: "顺着货源线索摸去码头",
          intent: "把早市里的零碎消息串成更大的机会。",
        },
      ];

      if (state.stats.wealth >= 4) {
        choices.push({
          id: "buy_information_bundle",
          label: "花点小钱收一圈消息，省得瞎闯",
          intent: "把手里的钱直接换成更高质量的情报。",
        });
      }

      return choices.slice(0, 4);
    }
    case "academy": {
      const choices: Choice[] = [
        {
          id: "join_poetry_gathering",
          label: "主动接下文会上的即兴题目",
          intent: "用一首诗词让真正有分量的人记住你。",
        },
        {
          id: "speak_with_shen",
          label: "私下向沈砚书讨教",
          intent: "争取书院圈子的背书，而不是只做一时惊艳的过客。",
        },
        {
          id: "watch_rivals",
          label: "先看谁在暗中对你不满",
          intent: "避免刚露头就被人借机压下去。",
        },
      ];

      if (state.stats.reputation >= 4 || state.stats.favor.shen_yanshu >= 2) {
        choices.push({
          id: "accept_patron_notice",
          label: "顺势接下一位贵人递来的试探",
          intent: "把书院里的名声变成更高层的敲门砖。",
        });
      }

      return choices.slice(0, 4);
    }
    case "dock": {
      const choices: Choice[] = [
        {
          id: "pitch_business_plan",
          label: "拿出更清晰的分账法说服码头上的人",
          intent: "用效率和利益让别人愿意跟你合作。",
        },
        {
          id: "approach_gu_family",
          label: "借眼前机会试着搭上顾家的人",
          intent: "把一次买卖升级成更稳定的商路入口。",
        },
        {
          id: "probe_ma",
          label: "试探马会川的底线和真实诉求",
          intent: "弄清楚这条地头蛇是短期靠山还是长期隐患。",
        },
      ];

      if (state.stats.wealth >= 5 || state.stats.favor.gu_mingzhu >= 2) {
        choices.push({
          id: "expand_trade_scope",
          label: "把眼前生意扩成一条更像样的路子",
          intent: "趁势扩大盘子，让顾家或更大的买卖注意到你。",
        });
      }

      return choices.slice(0, 4);
    }
    case "county_office": {
      const choices: Choice[] = [
        {
          id: "secure_document",
          label: "想办法拿到一份能自保的文书",
          intent: "让自己在临河县不再轻易被人拿捏。",
        },
        {
          id: "trade_information",
          label: "用消息换取官面上的方便",
          intent: "不拼硬碰硬，走一条更聪明的门路。",
        },
        {
          id: "retreat_to_inn",
          label: "先退回酒楼重新盘算",
          intent: "避免在官面上用力过猛，把局面做死。",
        },
      ];
      if (state.stats.reputation >= 4) {
        choices.push({
          id: "use_reputation_pressure",
          label: "借你现有的名声逼对方正眼看你",
          intent: "让县衙明白，你已经不是可以随便打发的小人物。",
        });
      }

      return choices.slice(0, 4);
    }
    case "crossroads":
    case "opening":
    default: {
      const choices: Choice[] = [
        {
          id: "return_to_inn",
          label: "回酒楼重新摸清局势",
          intent: "先掌握消息，再决定下一步压在哪条线上。",
        },
        {
          id: "seek_academy_route",
          label: "把手里的资本换成书院机会",
          intent: "用才学和名望切入更稳的上升通道。",
        },
        {
          id: "seek_business_route",
          label: "把眼前资源换成生意上的试手",
          intent: "先让手里有钱，再去谈更大的局。",
        },
      ];
      if (state.progression.chapterId === "chapter_2" || state.stats.reputation >= 5) {
        choices.push({
          id: "answer_high_level_invite",
          label: "赴一场只对有名头之人开放的邀约",
          intent: "试着把临河县的小局，接到更高层的人情和权力桌上。",
        });
      }

      return choices.slice(0, 4);
    }
  }
}

export function buildFallbackTurnResult(state: GameState, choice: Choice, outcome: ChoiceOutcome): TurnResult {
  const sceneNameMap: Record<SceneId, string> = {
    opening: "临河县街头",
    market: "早市",
    inn: "云来酒楼",
    academy: "松风书院",
    dock: "安平码头",
    county_office: "县衙",
    crossroads: "临河县的几条路口",
  };

  const sceneName = sceneNameMap[outcome.sceneId];
  const strongestRelation = Object.entries(state.stats.favor)
    .sort((a, b) => b[1] - a[1])[0];
  const strongestRelationText =
    strongestRelation && strongestRelation[1] > 0
      ? `此刻对你态度最松动的人，是${strongestRelation[0] === "shen_yanshu"
          ? "沈砚书"
          : strongestRelation[0] === "gu_mingzhu"
            ? "顾明珠"
            : strongestRelation[0] === "liu_sanniang"
              ? "柳三娘"
              : strongestRelation[0] === "ma_huichuan"
                ? "马会川"
                : "萧清漪"}。`
      : "暂时还没人真正站在你这边，你只能继续靠自己争出位置。";
  const leadText =
    outcome.sceneId === "inn"
      ? "酒香、人声和试探意味一起涌来。"
      : outcome.sceneId === "academy"
        ? "书卷气背后藏着比市井更锋利的评判。"
        : outcome.sceneId === "dock"
          ? "码头上的每一句话都和真金白银绑在一起。"
          : outcome.sceneId === "market"
            ? "讨价还价之间，谁都在盯着自己能多拿几分。"
            : outcome.sceneId === "county_office"
              ? "门内是规矩，门外是人情，谁都想让对方先低头。"
              : "真正的机会往往不在明面上，而在下一句该对谁说。";

  const narrative = [
    `你最终决定按“${choice.label}”这条路走下去，很快便到了${sceneName}。`,
    leadText,
    "你没有真正的身份庇护，只能靠反应、姿态和一点点比旁人更快的判断抢位置。",
    `这一步让局面开始偏向你：名望来到 ${state.stats.reputation}，钱财来到 ${state.stats.wealth}，而临河县里也已经有人开始记住你的名字。`,
    `眼下你的状态标签是：${state.stats.statusTags.join("、") || "暂无"}。${strongestRelationText}`,
    "可你也看得明白，任何一次出头都不只是机会，往往也会顺手带来新的试探、嫉妒和讨价还价。",
    state.progression.chapterId === "chapter_1"
      ? "你现在最重要的，不是一次性赢得太多，而是把这个小机会稳稳接住，变成下一步能用的人情、名声或生意。"
      : "你已经不再只是求生了。眼下更关键的是，如何让临河县里真正有分量的人觉得，不拉你一把就会错过什么。",
  ].join("");

  const postTurnDelta: StateDelta =
    outcome.sceneId === "inn"
      ? {
          favor: { liu_sanniang: 1 },
          reputation: state.stats.reputation >= 3 ? 1 : 0,
        }
      : outcome.sceneId === "market"
        ? {
            wealth: state.stats.wealth <= 3 ? 1 : 0,
          }
        : outcome.sceneId === "academy"
          ? {
              reputation: 1,
              favor: { shen_yanshu: 1 },
            }
          : outcome.sceneId === "dock"
            ? {
                wealth: 1,
                favor: { ma_huichuan: 1, gu_mingzhu: state.stats.favor.gu_mingzhu >= 1 ? 1 : 0 },
              }
            : outcome.sceneId === "county_office"
              ? {
                  reputation: 1,
                }
              : state.stats.reputation >= 4
                ? {
                    reputation: 1,
                  }
                : {};

  const summaryPrefix =
    outcome.sceneId === "academy"
      ? "书院线推进"
      : outcome.sceneId === "dock"
        ? "生意线推进"
        : outcome.sceneId === "inn"
          ? "消息线推进"
          : outcome.sceneId === "county_office"
            ? "官面线推进"
            : "局势推进";

  return {
    narrative,
    choices: buildFallbackChoicesForScene(state),
    suggestedStateChanges: postTurnDelta,
    events: outcome.events,
    summary: `${summaryPrefix}：${state.playerProfile.name}通过“${choice.label}”把局面推进到了${sceneName}。`,
  };
}

export function advanceStateForChoice(state: GameState, choice: Choice): ChoiceOutcome {
  const outcome = enforceForwardMotion(state, buildChoiceOutcome(state, choice));

  applyStateDelta(state, outcome.preSceneDelta);
  state.progression.sceneId = outcome.sceneId;
  state.currentObjective = outcome.objective ?? state.currentObjective;

  const nextTurn = state.progression.turn + 1;
  state.progression.turn = nextTurn;

  if (
    state.progression.chapterId === "chapter_1" &&
    (nextTurn >= 6 || state.stats.reputation >= 4 || state.storyFlags.includes("entered_business_circle"))
  ) {
    state.progression.chapterId = "chapter_2";
    state.currentObjective = "你已经有了些名头，接下来要让真正有分量的人开始争抢你。";
  }

  return outcome;
}

export function finalizeTurnState(state: GameState, turn: TurnResult): void {
  applyStateDelta(state, turn.suggestedStateChanges);
  state.lastChoices = turn.choices;
  state.recentSummaries = [...state.recentSummaries, turn.summary].slice(-10);
  state.recentScenes = [...state.recentScenes, state.progression.sceneId].slice(-6);
  state.recentEvents = [...state.recentEvents, ...turn.events].slice(-12);
  state.lastUpdatedAt = new Date().toISOString();

  if (state.progression.chapterId === "chapter_2") {
    state.currentObjective =
      state.stats.reputation >= 6 || state.stats.favor.gu_mingzhu >= 3
        ? "你的名字已经开始往更高层传开，接下来要把名声换成真正站得住的靠山。"
        : "你已经摸到更高层的门槛，接下来要让人看见你不只是昙花一现。";
  }
}

export function validateTurnRequest(input: unknown): input is TurnRequest {
  if (!input || typeof input !== "object") {
    return false;
  }

  const candidate = input as Record<string, unknown>;
  return typeof candidate.gameId === "string" && typeof candidate.choiceId === "string";
}
