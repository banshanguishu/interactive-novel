import type {
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

export type TurnStreamEnvelope = {
  type: "chunk" | "result" | "error";
  text?: string;
  result?: TurnResult;
  error?: string;
};

export type StartGameRequest = StartGameInput;
export type StartGameResponse = StartGamePayload;
