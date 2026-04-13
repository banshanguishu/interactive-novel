import { useEffect, useState } from "react";
import type {
  HealthPayload,
  StartGameRequest,
  StartGameResponse,
  StartGameStreamEnvelope,
} from "../../../shared/api.js";
import {
  PLAYER_BACKGROUNDS,
  PLAYER_TALENTS,
  STARTING_ASSETS,
  type GameState,
  type TurnResult,
} from "../../../shared/game.js";

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3001";

export default function App() {
  const [health, setHealth] = useState<HealthPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [opening, setOpening] = useState<TurnResult | null>(null);
  const [streamedNarrative, setStreamedNarrative] = useState("");
  const [openingSource, setOpeningSource] = useState<"llm" | "fallback" | null>(null);
  const [form, setForm] = useState<StartGameRequest>({
    name: "韩小满",
    background: PLAYER_BACKGROUNDS[0],
    talent: PLAYER_TALENTS[0],
    startingAsset: STARTING_ASSETS[0],
  });

  useEffect(() => {
    void fetch(`${apiBaseUrl}/health`)
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`Request failed with ${response.status}`);
        }

        return (await response.json()) as HealthPayload;
      })
      .then(setHealth)
      .catch((err: Error) => {
        setError(err.message);
      });
  }, []);

  function updateForm<K extends keyof StartGameRequest>(key: K, value: StartGameRequest[K]) {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  }

  async function handleStartGame(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setStartError(null);
    setStreamedNarrative("");
    setOpeningSource(null);
    setGameState(null);
    setOpening(null);

    try {
      const response = await fetch(`${apiBaseUrl}/game/start/stream`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(form),
      });

      if (!response.ok) {
        throw new Error(`创建游戏失败：${response.status}`);
      }

      if (!response.body) {
        throw new Error("创建游戏失败：未收到流式响应。");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          break;
        }

        buffer += decoder.decode(value, { stream: true });

        while (buffer.includes("\n\n")) {
          const eventEndIndex = buffer.indexOf("\n\n");
          const rawEvent = buffer.slice(0, eventEndIndex);
          buffer = buffer.slice(eventEndIndex + 2);

          const dataLines = rawEvent
            .split("\n")
            .filter((line) => line.startsWith("data:"))
            .map((line) => line.slice(5).trim());

          for (const line of dataLines) {
            if (!line) {
              continue;
            }

            const envelope = JSON.parse(line) as StartGameStreamEnvelope;

            if (envelope.type === "chunk") {
              setStreamedNarrative((current) => current + envelope.text);
              continue;
            }

            if (envelope.type === "error") {
              throw new Error(envelope.error);
            }

            if (envelope.type === "result") {
              const payload = envelope.payload as StartGameResponse;
              setOpeningSource(envelope.source);
              setGameState(payload.state);
              setOpening(payload.opening);
            }
          }
        }
      }
    } catch (requestError) {
      const message =
        requestError instanceof Error ? requestError.message : "创建游戏失败，请稍后重试。";
      setStartError(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-stone-950 text-stone-100">
      <div className="mx-auto flex min-h-screen max-w-5xl flex-col gap-8 px-6 py-10">
        <header className="space-y-4 border-b border-stone-800 pb-6">
          <p className="text-sm uppercase tracking-[0.35em] text-amber-400">
            Phase 1 Skeleton
          </p>
          <h1 className="text-4xl font-bold tracking-tight">AI 驱动互动小说</h1>
          <p className="max-w-2xl text-sm leading-7 text-stone-300">
            当前版本只完成前后端骨架与联通验证。下一步会接入初始化流程、游戏状态和剧情回合。
          </p>
        </header>

        {!gameState || !opening ? (
          <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
            <form
              className="rounded-3xl border border-stone-800 bg-stone-900/70 p-6"
              onSubmit={handleStartGame}
            >
              <div className="space-y-2">
                <p className="text-sm uppercase tracking-[0.3em] text-amber-400">初始化设定</p>
                <h2 className="text-2xl font-semibold">创建你的穿越开局</h2>
                <p className="max-w-2xl text-sm leading-7 text-stone-300">
                  提交后，后端会创建一局新游戏，并以流式方式返回首轮叙事文本，结束后再落下可选行动。
                </p>
              </div>

              <div className="mt-6 grid gap-5">
                <label className="grid gap-2 text-sm text-stone-200">
                  <span>角色名</span>
                  <input
                    className="rounded-2xl border border-stone-700 bg-stone-950 px-4 py-3 text-stone-100 outline-none transition focus:border-amber-400"
                    maxLength={20}
                    value={form.name}
                    onChange={(event) => updateForm("name", event.target.value)}
                  />
                </label>

                <label className="grid gap-2 text-sm text-stone-200">
                  <span>初始背景</span>
                  <select
                    className="rounded-2xl border border-stone-700 bg-stone-950 px-4 py-3 text-stone-100 outline-none transition focus:border-amber-400"
                    value={form.background}
                    onChange={(event) => updateForm("background", event.target.value as StartGameRequest["background"])}
                  >
                    {PLAYER_BACKGROUNDS.map((background) => (
                      <option key={background} value={background}>
                        {background}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="grid gap-2 text-sm text-stone-200">
                  <span>初始天赋</span>
                  <select
                    className="rounded-2xl border border-stone-700 bg-stone-950 px-4 py-3 text-stone-100 outline-none transition focus:border-amber-400"
                    value={form.talent}
                    onChange={(event) => updateForm("talent", event.target.value as StartGameRequest["talent"])}
                  >
                    {PLAYER_TALENTS.map((talent) => (
                      <option key={talent} value={talent}>
                        {talent}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="grid gap-2 text-sm text-stone-200">
                  <span>开局资源</span>
                  <select
                    className="rounded-2xl border border-stone-700 bg-stone-950 px-4 py-3 text-stone-100 outline-none transition focus:border-amber-400"
                    value={form.startingAsset}
                    onChange={(event) =>
                      updateForm("startingAsset", event.target.value as StartGameRequest["startingAsset"])
                    }
                  >
                    {STARTING_ASSETS.map((asset) => (
                      <option key={asset} value={asset}>
                        {asset}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              {startError ? <p className="mt-4 text-sm text-rose-300">{startError}</p> : null}

              {submitting ? (
                <div className="mt-5 rounded-2xl border border-stone-800 bg-stone-950/70 p-4">
                  <p className="text-xs uppercase tracking-[0.24em] text-amber-400">流式生成中</p>
                  <div className="mt-3 min-h-28 whitespace-pre-wrap text-sm leading-7 text-stone-200">
                    {streamedNarrative || "正在从临河县拉开序幕..."}
                  </div>
                </div>
              ) : null}

              <button
                className="mt-6 rounded-2xl bg-amber-400 px-5 py-3 text-sm font-semibold text-stone-950 transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:bg-stone-700 disabled:text-stone-300"
                disabled={submitting}
                type="submit"
              >
                {submitting ? "正在创建开局..." : "进入临河县"}
              </button>
            </form>

            <aside className="grid gap-4">
              <article className="rounded-3xl border border-stone-800 bg-stone-900/70 p-6">
                <h2 className="text-lg font-semibold text-stone-100">世界题材</h2>
                <p className="mt-3 text-sm leading-7 text-stone-300">
                  现代牛马穿越到架空古代王朝，从草民起步，靠诗词、商业头脑和察言观色一路逆袭。
                </p>
                <div className="mt-4 space-y-3 text-sm text-stone-300">
                  <p>初始背景：{PLAYER_BACKGROUNDS.join(" / ")}</p>
                  <p>初始天赋：{PLAYER_TALENTS.join(" / ")}</p>
                  <p>开局资源：{STARTING_ASSETS.join(" / ")}</p>
                </div>
              </article>

              <article className="rounded-3xl border border-stone-800 bg-stone-900/70 p-6">
                <h2 className="text-lg font-semibold text-stone-100">服务状态</h2>
                <div className="mt-3 text-sm leading-7 text-stone-300">
                  {health ? (
                    <div className="space-y-1">
                      <p>后端状态：{health.status}</p>
                      <p>服务名：{health.service}</p>
                      <p>时间：{health.time}</p>
                    </div>
                  ) : error ? (
                    <p className="text-rose-300">健康检查失败：{error}</p>
                  ) : (
                    <p>正在请求后端健康检查...</p>
                  )}
                </div>
              </article>
            </aside>
          </section>
        ) : (
          <section className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
            <aside className="grid gap-4">
              <article className="rounded-3xl border border-stone-800 bg-stone-900/70 p-6">
                <p className="text-sm uppercase tracking-[0.3em] text-amber-400">当前状态</p>
                <h2 className="mt-2 text-2xl font-semibold">{gameState.playerProfile.name}</h2>
                <div className="mt-4 space-y-2 text-sm leading-7 text-stone-300">
                  <p>背景：{gameState.playerProfile.background}</p>
                  <p>天赋：{gameState.playerProfile.talent}</p>
                  <p>开局资源：{gameState.playerProfile.startingAsset}</p>
                  <p>章节：{gameState.progression.chapterId}</p>
                  <p>回合：{gameState.progression.turn}</p>
                  <p>目标：{gameState.currentObjective}</p>
                  <p>名望：{gameState.stats.reputation}</p>
                  <p>钱财：{gameState.stats.wealth}</p>
                  <p>状态：{gameState.stats.statusTags.join(" / ") || "无"}</p>
                  <p>道具：{gameState.stats.inventory.join(" / ") || "无"}</p>
                </div>
              </article>

              <article className="rounded-3xl border border-stone-800 bg-stone-900/70 p-6">
                <h2 className="text-lg font-semibold text-stone-100">首轮摘要</h2>
                <p className="mt-3 text-sm leading-7 text-stone-300">{opening.summary}</p>
                <p className="mt-3 text-xs uppercase tracking-[0.24em] text-stone-500">
                  内容来源：{openingSource === "llm" ? "LLM 流式生成" : "本地回退生成"}
                </p>
              </article>
            </aside>

            <article className="rounded-3xl border border-stone-800 bg-stone-900/70 p-6">
              <p className="text-sm uppercase tracking-[0.3em] text-amber-400">首轮剧情</p>
              <div className="mt-4 whitespace-pre-wrap text-sm leading-8 text-stone-200">
                {opening.narrative}
              </div>

              <div className="mt-6 grid gap-3">
                {opening.choices.map((choice) => (
                  <button
                    key={choice.id}
                    className="rounded-2xl border border-stone-700 bg-stone-950/70 px-4 py-4 text-left text-sm leading-7 text-stone-100 transition hover:border-amber-400 hover:bg-stone-950"
                    type="button"
                  >
                    <span className="block font-medium text-amber-300">{choice.label}</span>
                    <span className="mt-1 block text-stone-400">{choice.intent}</span>
                  </button>
                ))}
              </div>

              <p className="mt-5 text-sm text-stone-400">
                初始化流程已打通。下一步会把这些选项真正接到回合推进接口和流式输出。
              </p>
            </article>
          </section>
        )}
      </div>
    </main>
  );
}
