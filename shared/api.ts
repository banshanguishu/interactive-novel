import type {
  GameState,
  PlayerBackground,
  PlayerTalent,
  SaveMeta,
  SaveSlot,
  StartGameInput,
  StartGamePayload,
  StartingAsset,
  TurnResult,
} from "./game.js";

export type HealthPayload = {
  status: "ok";
  service: string;
  time: string;
};

export type LoadSavePayload = {
  slot: SaveSlot;
};

export type SaveListPayload = {
  latestSlotId: string | null;
  slots: SaveMeta[];
};

export type GameSchemaPayload = {
  backgrounds: readonly PlayerBackground[];
  talents: readonly PlayerTalent[];
  startingAssets: readonly StartingAsset[];
};

export type StartGameStreamEnvelope =
  | {
      type: "chunk";
      text: string;
    }
  | {
      type: "result";
      source: "llm" | "fallback";
      payload: StartGamePayload;
    }
  | {
      type: "error";
      error: string;
    };

export type TurnStreamEnvelope = {
  type: "chunk" | "result" | "error";
  text?: string;
  source?: "llm" | "fallback";
  payload?: {
    state: GameState;
    turn: TurnResult;
  };
  error?: string;
};

export type StartGameRequest = StartGameInput;
export type StartGameResponse = StartGamePayload;
export type TurnRequest = {
  gameId: string;
  choiceId: string;
};
export type TurnResponse = {
  state: GameState;
  turn: TurnResult;
};

export type GetGameResponse = {
  state: GameState;
};
