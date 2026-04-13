import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import type { HealthPayload } from "../../../shared/api.js";
import {
  PLAYER_BACKGROUNDS,
  PLAYER_TALENTS,
  STARTING_ASSETS,
  createEmptyGameState,
} from "../../../shared/game.js";

dotenv.config();

const app = express();
const port = Number(process.env.PORT ?? 3001);
const allowedOrigin = process.env.WEB_ORIGIN ?? "http://localhost:5173";

app.use(cors({ origin: allowedOrigin }));
app.use(express.json());

app.get("/health", (_req, res) => {
  const payload: HealthPayload = {
    status: "ok",
    service: "interactive-novel-server",
    time: new Date().toISOString(),
  };

  res.json(payload);
});

app.get("/game/schema", (_req, res) => {
  res.json({
    backgrounds: PLAYER_BACKGROUNDS,
    talents: PLAYER_TALENTS,
    startingAssets: STARTING_ASSETS,
  });
});

app.get("/game/state-example", (_req, res) => {
  res.json(
    createEmptyGameState({
      name: "韩小满",
      background: "落魄读书人",
      talent: "诗词才情",
      startingAsset: "一封旧人情信",
    }),
  );
});

app.listen(port, () => {
  console.log(`server listening on http://localhost:${port}`);
});
