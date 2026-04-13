import cors from "cors";
import dotenv from "dotenv";
import express from "express";

dotenv.config();

const app = express();
const port = Number(process.env.PORT ?? 3001);
const allowedOrigin = process.env.WEB_ORIGIN ?? "http://localhost:5173";

app.use(cors({ origin: allowedOrigin }));
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "interactive-novel-server",
    time: new Date().toISOString(),
  });
});

app.listen(port, () => {
  console.log(`server listening on http://localhost:${port}`);
});
