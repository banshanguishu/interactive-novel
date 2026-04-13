import type { SaveMeta, SaveSlot, StartGamePayload, TurnResult } from "./game.js";

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

export type TurnStreamEnvelope = {
  type: "chunk" | "result" | "error";
  text?: string;
  result?: TurnResult;
  error?: string;
};

export type StartGameResponse = StartGamePayload;
