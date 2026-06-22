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
  transportTimeoutApplied: boolean;
  transportHeadersTimeoutMs: number | null;
  transportBodyTimeoutMs: number | null;
};

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
  const fetchImpl =
    typeof undiciModule?.fetch === "function" ? undiciModule.fetch.bind(undiciModule) : fetch;

  return {
    fetchImpl,
    fetchImplementation:
      typeof undiciModule?.fetch === "function" ? "undici.fetch" : "global.fetch",
    dispatcher,
    transportTimeoutApplied: dispatcher !== null,
    transportHeadersTimeoutMs: dispatcher !== null ? timeoutMs : null,
    transportBodyTimeoutMs: dispatcher !== null ? timeoutMs : null,
  };
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
