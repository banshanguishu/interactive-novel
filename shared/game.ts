export const PLAYER_BACKGROUNDS = [
  "落魄读书人",
  "小商贩学徒",
  "流民出身的机灵人",
] as const;

export const PLAYER_TALENTS = ["诗词才情", "商业头脑", "察言观色"] as const;

export const STARTING_ASSETS = ["一点碎银", "一封旧人情信", "一件可变卖旧物"] as const;

export const CORE_NPC_IDS = [
  "shen_yanshu",
  "gu_mingzhu",
  "liu_sanniang",
  "ma_huichuan",
  "xiao_qingyi",
] as const;

export const CHAPTER_IDS = ["chapter_1", "chapter_2"] as const;

export type PlayerBackground = (typeof PLAYER_BACKGROUNDS)[number];
export type PlayerTalent = (typeof PLAYER_TALENTS)[number];
export type StartingAsset = (typeof STARTING_ASSETS)[number];
export type NpcId = (typeof CORE_NPC_IDS)[number];
export type ChapterId = (typeof CHAPTER_IDS)[number];

export const NPC_LABELS: Record<NpcId, string> = {
  shen_yanshu: "沈砚书",
  gu_mingzhu: "顾明珠",
  liu_sanniang: "柳三娘",
  ma_huichuan: "马会川",
  xiao_qingyi: "萧清漪",
};

export type SceneId =
  | "opening"
  | "market"
  | "inn"
  | "academy"
  | "dock"
  | "county_office"
  | "crossroads";

export type StoryFlag =
  | "met_shen_yanshu"
  | "met_gu_mingzhu"
  | "met_liu_sanniang"
  | "met_ma_huichuan"
  | "heard_of_xiao_qingyi"
  | "earned_first_silver"
  | "gained_local_reputation"
  | "entered_academy_circle"
  | "entered_business_circle";

export type StatusTag =
  | "初来乍到"
  | "小有名气"
  | "欠下人情"
  | "被豪强盯上"
  | "得书院赏识"
  | "手头拮据"
  | "崭露头角";

export type Choice = {
  id: string;
  label: string;
  intent: string;
};

export type PlayerProfile = {
  name: string;
  background: PlayerBackground;
  talent: PlayerTalent;
  startingAsset: StartingAsset;
};

export type GameProgress = {
  chapterId: ChapterId;
  sceneId: SceneId;
  turn: number;
};

export type GameStats = {
  reputation: number;
  wealth: number;
  favor: Record<NpcId, number>;
  statusTags: StatusTag[];
  inventory: string[];
};

export type StateDelta = {
  reputation?: number;
  wealth?: number;
  favor?: Partial<Record<NpcId, number>>;
  addTags?: StatusTag[];
  removeTags?: StatusTag[];
  addItems?: string[];
  removeItems?: string[];
  addFlags?: StoryFlag[];
};

export type TurnResult = {
  narrative: string;
  choices: Choice[];
  suggestedStateChanges: StateDelta;
  events: string[];
  summary: string;
};

export type GameState = {
  gameId: string;
  playerProfile: PlayerProfile;
  progression: GameProgress;
  stats: GameStats;
  storyFlags: StoryFlag[];
  recentSummaries: string[];
  recentScenes: SceneId[];
  recentEvents: string[];
  currentObjective: string;
  lastChoices: Choice[];
  lastUpdatedAt: string;
};

export type SaveMeta = {
  slotId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
};

export type SaveSlot = SaveMeta & {
  state: GameState;
};

export type SaveIndex = {
  latestSlotId: string | null;
  slots: SaveMeta[];
};

export type StartGameInput = PlayerProfile;

export type StartGamePayload = {
  state: GameState;
  opening: TurnResult;
};

export const DEFAULT_FAVOR: Record<NpcId, number> = {
  shen_yanshu: 0,
  gu_mingzhu: 0,
  liu_sanniang: 0,
  ma_huichuan: 0,
  xiao_qingyi: 0,
};

export function createEmptyGameState(input: StartGameInput): GameState {
  return {
    gameId: crypto.randomUUID(),
    playerProfile: input,
    progression: {
      chapterId: "chapter_1",
      sceneId: "opening",
      turn: 0,
    },
    stats: {
      reputation: 0,
      wealth: input.startingAsset === "一点碎银" ? 3 : 1,
      favor: { ...DEFAULT_FAVOR },
      statusTags: ["初来乍到"],
      inventory:
        input.startingAsset === "一封旧人情信"
          ? ["旧人情信"]
          : input.startingAsset === "一件可变卖旧物"
            ? ["可变卖旧物"]
            : ["碎银"],
    },
    storyFlags: [],
    recentSummaries: [],
    recentScenes: ["opening"],
    recentEvents: [],
    currentObjective: "先在临河县活下去，并找到第一个翻身机会。",
    lastChoices: [],
    lastUpdatedAt: new Date().toISOString(),
  };
}
