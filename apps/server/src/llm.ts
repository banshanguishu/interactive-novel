import type { StartGamePayload } from "../../../shared/game.js";
import { buildFallbackOpening } from "./bootstrap.js";
import { OPENING_JSON_MARKER, buildOpeningSystemPrompt } from "./prompt.js";

type LlmConfig = {
  baseUrl: string;
  apiKey: string;
  model: string;
};

type StreamOpeningParams = {
  state: StartGamePayload["state"];
  onTextChunk: (text: string) => Promise<void> | void;
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

function parseOpeningJson(rawJson: string, state: StartGamePayload["state"]): StartGamePayload["opening"] {
  const parsed: unknown = JSON.parse(rawJson);
  const fallback = buildFallbackOpening(state);

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
              : fallback.choices[index]?.label ?? `开局行动 ${index + 1}`,
          intent:
            typeof choice.intent === "string" && choice.intent.trim()
              ? choice.intent.trim()
              : fallback.choices[index]?.intent ?? "继续观察局势，寻找机会。",
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
    suggestedStateChanges: {},
  };
}

async function streamFallbackOpening({
  state,
  onTextChunk,
}: StreamOpeningParams): Promise<StreamOpeningResult> {
  const opening = buildFallbackOpening(state);

  for (const chunk of splitNarrativeForStreaming(opening.narrative)) {
    await onTextChunk(chunk);
    await new Promise((resolve) => setTimeout(resolve, 20));
  }

  return {
    opening,
    source: "fallback",
  };
}

export async function streamOpeningScene({
  state,
  onTextChunk,
}: StreamOpeningParams): Promise<StreamOpeningResult> {
  const config = getLlmConfig();

  if (!config) {
    return streamFallbackOpening({ state, onTextChunk });
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
          content: buildOpeningSystemPrompt(state),
        },
        {
          role: "user",
          content: "请生成游戏开场剧情，并严格按要求在末尾输出 JSON。",
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

  const fallback = buildFallbackOpening(state);
  const parsedOpening =
    rawBufferState.markerFound && rawBufferState.jsonBuffer.trim()
      ? parseOpeningJson(rawBufferState.jsonBuffer.trim(), state)
      : fallback;

  return {
    source: "llm",
    opening: {
      ...parsedOpening,
      narrative: rawBufferState.narrativeBuffer.trim() || fallback.narrative,
    },
  };
}
