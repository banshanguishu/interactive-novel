import { useEffect, useState } from "react";

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3001";

type HealthPayload = {
  status: string;
  service: string;
  time: string;
};

export default function App() {
  const [health, setHealth] = useState<HealthPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

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

        <section className="grid gap-4 md:grid-cols-2">
          <article className="rounded-2xl border border-stone-800 bg-stone-900/70 p-5">
            <h2 className="text-lg font-semibold text-stone-100">世界题材</h2>
            <p className="mt-3 text-sm leading-7 text-stone-300">
              现代牛马穿越到架空古代王朝，从草民起步，靠诗词、商业头脑和察言观色一路逆袭。
            </p>
          </article>

          <article className="rounded-2xl border border-stone-800 bg-stone-900/70 p-5">
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
        </section>
      </div>
    </main>
  );
}
