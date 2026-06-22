import "server-only";

export type OpenAiFetchRequestInit = RequestInit & {
  dispatcher?: unknown;
};

type UndiciLikeModule = {
  fetch?: typeof fetch;
  Agent?: new (options: {
    headersTimeout: number;
    bodyTimeout: number;
  }) => unknown;
};

export type OpenAiFetchTransport = {
  fetchImpl: typeof fetch;
  fetchImplementation: "undici.fetch" | "global.fetch";
  dispatcher: unknown | null;
  dispatcherConfigured: boolean;
  transportTimeoutApplied: boolean;
  transportHeadersTimeoutMs: number | null;
  transportBodyTimeoutMs: number | null;
};

export const OPENAI_LONG_TIMEOUT_TRANSPORT_THRESHOLD_MS = 300000;

function loadUndiciModule(): UndiciLikeModule | null {
  try {
    return require("undici") as UndiciLikeModule;
  } catch {
    return null;
  }
}

export function createOpenAiTransportDispatcher(
  timeoutMs: number,
  undiciModule: UndiciLikeModule | null = loadUndiciModule(),
): unknown | null {
  if (typeof undiciModule?.Agent !== "function") {
    return null;
  }

  return new undiciModule.Agent({
    headersTimeout: timeoutMs,
    bodyTimeout: timeoutMs,
  });
}

export function resolveOpenAiFetchTransport(
  timeoutMs: number,
  undiciModule: UndiciLikeModule | null = loadUndiciModule(),
): OpenAiFetchTransport {
  const dispatcher = createOpenAiTransportDispatcher(timeoutMs, undiciModule);
  const hasUndiciFetch = typeof undiciModule?.fetch === "function";
  const fetchImpl =
    hasUndiciFetch ? undiciModule.fetch!.bind(undiciModule) : fetch;

  const transport: OpenAiFetchTransport = {
    fetchImpl,
    fetchImplementation: hasUndiciFetch ? "undici.fetch" : "global.fetch",
    dispatcher,
    dispatcherConfigured: dispatcher !== null,
    transportTimeoutApplied: dispatcher !== null,
    transportHeadersTimeoutMs: dispatcher !== null ? timeoutMs : null,
    transportBodyTimeoutMs: dispatcher !== null ? timeoutMs : null,
  };

  try {
    assertOpenAiTransportReadyForTimeout({
      timeoutMs,
      transport,
      context: "OpenAI transport resolution",
    });
  } catch (error) {
    if (error && typeof error === "object") {
      (error as Error & { transport?: OpenAiFetchTransport }).transport = transport;
    }
    throw error;
  }

  return transport;
}

export function assertOpenAiTransportReadyForTimeout(args: {
  timeoutMs: number;
  transport: OpenAiFetchTransport;
  context: string;
}): void {
  if (args.timeoutMs <= OPENAI_LONG_TIMEOUT_TRANSPORT_THRESHOLD_MS) {
    return;
  }

  const transportReady =
    args.transport.fetchImplementation === "undici.fetch" &&
    args.transport.dispatcher !== null &&
    args.transport.transportTimeoutApplied === true &&
    args.transport.transportHeadersTimeoutMs === args.timeoutMs &&
    args.transport.transportBodyTimeoutMs === args.timeoutMs;

  if (transportReady) {
    return;
  }

  throw new Error(
    [
      `${args.context} requires explicit OpenAI transport timeouts for timeoutMs=${args.timeoutMs}.`,
      `Resolved fetchImplementation=${args.transport.fetchImplementation}.`,
      `transportTimeoutApplied=${args.transport.transportTimeoutApplied}.`,
      `transportHeadersTimeoutMs=${args.transport.transportHeadersTimeoutMs ?? "null"}.`,
      `transportBodyTimeoutMs=${args.transport.transportBodyTimeoutMs ?? "null"}.`,
      "Install/configure undici so long OpenAI calls use undici.fetch with an Agent dispatcher, or lower AI_REPORT_OPENAI_TIMEOUT_MS to 300000 or less.",
    ].join(" "),
  );
}

export function buildOpenAiFetchRequestInit(args: {
  apiKey: string;
  requestBody: unknown;
  signal: AbortSignal;
  dispatcher?: unknown | null;
}): OpenAiFetchRequestInit {
  const requestInit: OpenAiFetchRequestInit = {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${args.apiKey}`,
    },
    body: JSON.stringify(args.requestBody),
    signal: args.signal,
    cache: "no-store",
  };

  if (args.dispatcher) {
    requestInit.dispatcher = args.dispatcher;
  }

  return requestInit;
}
