import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import type { GameSchemaPayload, HealthPayload, StartGameRequest } from "../../../shared/api.js";
import {
  PLAYER_BACKGROUNDS,
  PLAYER_TALENTS,
  STARTING_ASSETS,
  type GameState,
} from "../../../shared/game.js";
import { bootstrapGame } from "./bootstrap.js";

dotenv.config();

const app = express();
const port = Number(process.env.PORT ?? 3001);
const allowedOrigin = process.env.WEB_ORIGIN ?? "http://localhost:5173";

app.use(cors({ origin: allowedOrigin }));
app.use(express.json());

const gameStore = new Map<string, GameState>();

function isValidStartGameRequest(input: unknown): input is StartGameRequest {
  if (!input || typeof input !== "object") {
    return false;
  }

  const candidate = input as Record<string, unknown>;

  return (
    typeof candidate.name === "string" &&
    candidate.name.trim().length >= 1 &&
    candidate.name.trim().length <= 20 &&
    typeof candidate.background === "string" &&
    PLAYER_BACKGROUNDS.includes(candidate.background as (typeof PLAYER_BACKGROUNDS)[number]) &&
    typeof candidate.talent === "string" &&
    PLAYER_TALENTS.includes(candidate.talent as (typeof PLAYER_TALENTS)[number]) &&
    typeof candidate.startingAsset === "string" &&
    STARTING_ASSETS.includes(candidate.startingAsset as (typeof STARTING_ASSETS)[number])
  );
}

app.get("/health", (_req, res) => {
  const payload: HealthPayload = {
    status: "ok",
    service: "interactive-novel-server",
    time: new Date().toISOString(),
  };

  res.json(payload);
});

app.get("/game/schema", (_req, res) => {
  const payload: GameSchemaPayload = {
    backgrounds: PLAYER_BACKGROUNDS,
    talents: PLAYER_TALENTS,
    startingAssets: STARTING_ASSETS,
  };

  res.json(payload);
});

app.get("/game/state-example", (_req, res) => {
  const payload = bootstrapGame({
      name: "韩小满",
      background: "落魄读书人",
      talent: "诗词才情",
      startingAsset: "一封旧人情信",
    });

  res.json(payload);
});

app.post("/game/start", (req, res) => {
  if (!isValidStartGameRequest(req.body)) {
    res.status(400).json({
      error: "Invalid start game payload.",
    });
    return;
  }

  const payload = bootstrapGame({
    ...req.body,
    name: req.body.name.trim(),
  });

  gameStore.set(payload.state.gameId, payload.state);
  res.status(201).json(payload);
});

app.get("/game/:id", (req, res) => {
  const state = gameStore.get(req.params.id);

  if (!state) {
    res.status(404).json({ error: "Game not found." });
    return;
  }

  res.json({ state });
});

app.listen(port, () => {
  console.log(`server listening on http://localhost:${port}`);
});
