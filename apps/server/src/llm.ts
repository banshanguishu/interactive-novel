import type { Choice, GameState, NpcId, StartGamePayload, StateDelta, StatusTag, StoryFlag, TurnResult } from "../../../shared/game.js";
import { buildFallbackOpening } from "./bootstrap.js";
import { OPENING_JSON_MARKER, buildOpeningSystemPrompt, buildTurnSystemPrompt } from "./prompt.js";

type LlmConfig = {
  baseUrl: string;
  apiKey: string;
  model: string;
};

type StreamSceneParams = {
  state: GameState;
  fallback: TurnResult;
  userInstruction: string;
  systemPrompt: string;
  onTextChunk: (text: string) => Promise<void> | void;
};

type StreamSceneResult = {
  turn: TurnResult;
  source: "llm" | "fallback";
};

type StreamOpeningResult = {
  opening: StartGamePayload["opening"];
  source: "llm" | "fallback";
};

function getLlmConfig(): LlmConfig | null {
  const baseUrl = process.env.OPENAI_BASE_URL?.trim();
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  const model = process.env.OPENAI_MODEL?.trim();

  if (!baseUrl || !apiKey || !model) {
    return null;
  }

  return { baseUrl, apiKey, model };
}

function createUrl(baseUrl: string, path: string): string {
  const normalized = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
  return `${normalized}${path}`;
}

function splitNarrativeForStreaming(text: string): string[] {
  return text.match(/.{1,28}/gu) ?? [text];
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isStatusTag(value: string): value is StatusTag {
  return ["初来乍到", "小有名气", "欠下人情", "被豪强盯上", "得书院赏识", "手头拮据", "崭露头角"].includes(value);
}

function isStoryFlag(value: string): value is StoryFlag {
  return [
    "met_shen_yanshu",
    "met_gu_mingzhu",
    "met_liu_sanniang",
    "met_ma_huichuan",
    "heard_of_xiao_qingyi",
    "earned_first_silver",
    "gained_local_reputation",
    "entered_academy_circle",
    "entered_business_circle",
  ].includes(value);
}

function isNpcId(value: string): value is NpcId {
  return ["shen_yanshu", "gu_mingzhu", "liu_sanniang", "ma_huichuan", "xiao_qingyi"].includes(value);
}

function parseStateDelta(raw: unknown): StateDelta {
  if (!isObject(raw)) {
    return {};
  }

  const favor: Partial<Record<NpcId, number>> = {};
  if (isObject(raw.favor)) {
    for (const [key, value] of Object.entries(raw.favor)) {
      if (isNpcId(key) && typeof value === "number" && Number.isFinite(value)) {
        favor[key] = Math.max(-2, Math.min(2, Math.round(value)));
      }
    }
  }

  return {
    reputation: typeof raw.reputation === "number" ? Math.max(-1, Math.min(2, Math.round(raw.reputation))) : undefined,
    wealth: typeof raw.wealth === "number" ? Math.max(-1, Math.min(2, Math.round(raw.wealth))) : undefined,
    favor,
    addTags: Array.isArray(raw.addTags)
      ? raw.addTags.filter((item): item is StatusTag => typeof item === "string" && isStatusTag(item))
      : undefined,
    removeTags: Array.isArray(raw.removeTags)
      ? raw.removeTags.filter((item): item is StatusTag => typeof item === "string" && isStatusTag(item))
      : undefined,
    addItems: Array.isArray(raw.addItems)
      ? raw.addItems.filter((item): item is string => typeof item === "string" && item.trim().length > 0).slice(0, 2)
      : undefined,
    removeItems: Array.isArray(raw.removeItems)
      ? raw.removeItems.filter((item): item is string => typeof item === "string" && item.trim().length > 0).slice(0, 2)
      : undefined,
    addFlags: Array.isArray(raw.addFlags)
      ? raw.addFlags.filter((item): item is StoryFlag => typeof item === "string" && isStoryFlag(item))
      : undefined,
  };
}

function parseTurnJson(rawJson: string, fallback: TurnResult): TurnResult {
  const parsed: unknown = JSON.parse(rawJson);

  if (!isObject(parsed)) {
    return fallback;
  }

  const summary = typeof parsed.summary === "string" && parsed.summary.trim() ? parsed.summary.trim() : fallback.summary;

  const events = Array.isArray(parsed.events)
    ? parsed.events.filter((item): item is string => typeof item === "string" && item.length > 0)
    : fallback.events;

  const choices = Array.isArray(parsed.choices)
    ? parsed.choices
        .filter(isObject)
        .map((choice, index) => ({
          id: typeof choice.id === "string" && choice.id.trim() ? choice.id.trim() : `choice_${index + 1}`,
          label:
            typeof choice.label === "string" && choice.label.trim()
              ? choice.label.trim()
              : fallback.choices[index]?.label ?? `行动 ${index + 1}`,
          intent:
            typeof choice.intent === "string" && choice.intent.trim()
              ? choice.intent.trim()
              : fallback.choices[index]?.intent ?? "继续寻找对自己最有利的推进方式。",
        }))
        .slice(0, 4)
    : fallback.choices;

  if (choices.length < 2) {
    return fallback;
  }

  return {
    narrative: fallback.narrative,
    summary,
    events: events.length > 0 ? events : fallback.events,
    choices,
    suggestedStateChanges: parseStateDelta(parsed.suggestedStateChanges),
  };
}

function normalizeForCompare(value: string): string {
  return value.replace(/\s+/g, "").replace(/[，。、“”‘’：；！？,.!?]/g, "");
}

function looksRepetitive(state: GameState, candidate: TurnResult): boolean {
  const normalizedSummary = normalizeForCompare(candidate.summary);
  const recentSummaryHit = state.recentSummaries
    .slice(-2)
    .some((summary) => normalizeForCompare(summary) === normalizedSummary);

  const repeatedChoices =
    candidate.choices.filter((choice) => state.lastChoices.some((lastChoice) => lastChoice.label === choice.label)).length >= 2;

  const repeatedScene = state.recentScenes.slice(-2).filter((scene) => scene === state.progression.sceneId).length >= 2;

  return recentSummaryHit || (repeatedChoices && repeatedScene);
}

async function streamFallbackScene({ fallback, onTextChunk }: StreamSceneParams): Promise<StreamSceneResult> {
  for (const chunk of splitNarrativeForStreaming(fallback.narrative)) {
    await onTextChunk(chunk);
    await new Promise((resolve) => setTimeout(resolve, 20));
  }

  return {
    turn: fallback,
    source: "fallback",
  };
}

async function streamStructuredScene({
  state,
  fallback,
  userInstruction,
  systemPrompt,
  onTextChunk,
}: StreamSceneParams): Promise<StreamSceneResult> {
  const config = getLlmConfig();

  if (!config) {
    return streamFallbackScene({ state, fallback, userInstruction, systemPrompt, onTextChunk });
  }

  const response = await fetch(createUrl(config.baseUrl, "/chat/completions"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      stream: true,
      temperature: 0.9,
      messages: [
        {
          role: "system",
          content: systemPrompt,
        },
        {
          role: "user",
          content: userInstruction,
        },
      ],
    }),
  });

  if (!response.ok || !response.body) {
    throw new Error(`LLM request failed with status ${response.status}.`);
  }

  const decoder = new TextDecoder();
  const markerLength = OPENING_JSON_MARKER.length;
  const rawBufferState = {
    streamBuffer: "",
    markerFound: false,
    jsonBuffer: "",
    narrativeBuffer: "",
  };

  const processTextDelta = async (delta: string) => {
    rawBufferState.streamBuffer += delta;

    if (rawBufferState.markerFound) {
      rawBufferState.jsonBuffer += rawBufferState.streamBuffer;
      rawBufferState.streamBuffer = "";
      return;
    }

    const markerIndex = rawBufferState.streamBuffer.indexOf(OPENING_JSON_MARKER);

    if (markerIndex >= 0) {
      const narrativePart = rawBufferState.streamBuffer.slice(0, markerIndex);

      if (narrativePart) {
        rawBufferState.narrativeBuffer += narrativePart;
        await onTextChunk(narrativePart);
      }

      rawBufferState.markerFound = true;
      rawBufferState.jsonBuffer += rawBufferState.streamBuffer.slice(markerIndex + markerLength);
      rawBufferState.streamBuffer = "";
      return;
    }

    const safeLength = Math.max(0, rawBufferState.streamBuffer.length - (markerLength - 1));

    if (safeLength > 0) {
      const narrativePart = rawBufferState.streamBuffer.slice(0, safeLength);
      rawBufferState.narrativeBuffer += narrativePart;
      rawBufferState.streamBuffer = rawBufferState.streamBuffer.slice(safeLength);
      await onTextChunk(narrativePart);
    }
  };

  const reader = response.body.getReader();
  let sseBuffer = "";

  while (true) {
    const { done, value } = await reader.read();

    if (done) {
      break;
    }

    sseBuffer += decoder.decode(value, { stream: true });

    while (sseBuffer.includes("\n\n")) {
      const separatorIndex = sseBuffer.indexOf("\n\n");
      const rawEvent = sseBuffer.slice(0, separatorIndex);
      sseBuffer = sseBuffer.slice(separatorIndex + 2);

      const dataLines = rawEvent
        .split("\n")
        .filter((line) => line.startsWith("data:"))
        .map((line) => line.slice(5).trim());

      for (const line of dataLines) {
        if (line === "[DONE]") {
          break;
        }

        if (!line) {
          continue;
        }

        const payload = JSON.parse(line) as {
          choices?: Array<{
            delta?: {
              content?: string;
            };
          }>;
        };

        const deltaText = payload.choices?.[0]?.delta?.content ?? "";

        if (deltaText) {
          await processTextDelta(deltaText);
        }
      }
    }
  }

  if (!rawBufferState.markerFound && rawBufferState.streamBuffer) {
    rawBufferState.narrativeBuffer += rawBufferState.streamBuffer;
    await onTextChunk(rawBufferState.streamBuffer);
    rawBufferState.streamBuffer = "";
  }

  const parsedTurn =
    rawBufferState.markerFound && rawBufferState.jsonBuffer.trim()
      ? parseTurnJson(rawBufferState.jsonBuffer.trim(), fallback)
      : fallback;

  const useFallback = looksRepetitive(state, parsedTurn);
  const finalTurn = useFallback ? fallback : parsedTurn;

  return {
    source: useFallback ? "fallback" : "llm",
    turn: useFallback
      ? fallback
      : {
          ...finalTurn,
          narrative: rawBufferState.narrativeBuffer.trim() || fallback.narrative,
        },
  };
}

export async function streamOpeningScene({
  state,
  onTextChunk,
}: {
  state: StartGamePayload["state"];
  onTextChunk: (text: string) => Promise<void> | void;
}): Promise<StreamOpeningResult> {
  const fallback = buildFallbackOpening(state);
  const result = await streamStructuredScene({
    state,
    fallback,
    systemPrompt: buildOpeningSystemPrompt(state),
    userInstruction: "请生成游戏开场剧情，并严格按要求在末尾输出 JSON。",
    onTextChunk,
  });

  return {
    source: result.source,
    opening: result.turn,
  };
}

export async function streamTurnScene({
  state,
  selectedChoice,
  fallback,
  onTextChunk,
}: {
  state: GameState;
  selectedChoice: Choice;
  fallback: TurnResult;
  onTextChunk: (text: string) => Promise<void> | void;
}): Promise<StreamSceneResult> {
  return streamStructuredScene({
    state,
    fallback,
    systemPrompt: buildTurnSystemPrompt(state, selectedChoice),
    userInstruction: `玩家刚刚做出的选择是：${selectedChoice.label}。请继续推进下一回合剧情，并严格按要求在末尾输出 JSON。`,
    onTextChunk,
  });
}
