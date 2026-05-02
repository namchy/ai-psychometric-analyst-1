"use client";

import { useEffect, useMemo, useState } from "react";

type ReportGenerationLoadingScreenProps = {
  status?: string | null;
  testSlug?: string | null;
  testName?: string | null;
  participantName?: string | null;
};

const DEFAULT_REPORT_LOADING_MESSAGES = [
  "Pripremam tvoj izvještaj na osnovu završenog testa...",
  "Provjeravam strukturu odgovora prije interpretacije...",
  "Povezujem rezultate sa odgovarajućim interpretacijskim modelom...",
  "Usklađujem nalaze tako da izvještaj bude jasan i čitljiv...",
  "Provjeravam da interpretacija ostane vezana za izmjerene rezultate...",
  "Finalizujem izvještaj i spremam ga za prikaz...",
] as const;

const REPORT_LOADING_MESSAGES_BY_TEST: Record<string, readonly string[]> = {
  "ipip-neo-120-v1": [
    "Analiziram pet glavnih dimenzija ličnosti...",
    "Povezujem dimenzije i subdimenzije u širi obrazac profila...",
    "Provjeravam koje crte su izraženije, a koje uravnotežene...",
  ],
  "safran-v1": [
    "Analiziram verbalni, figuralni i numerički dio testa...",
    "Provjeravam odnos rezultata po kognitivnim domenima...",
    "Usklađujem ukupni rezultat sa pojedinačnim domenima testa...",
  ],
  mwms_v1: [
    "Analiziram obrasce radne motivacije...",
    "Povezujem unutrašnje i vanjske motivacijske signale...",
    "Provjeravam koji motivacijski faktori su izraženiji u profilu...",
  ],
};

type NetworkNode = {
  id: number;
  x: number;
  y: number;
  color: string;
};

const NETWORK_NODES: readonly NetworkNode[] = [
  { id: 0, x: 70, y: 78, color: "#ef476f" },
  { id: 1, x: 154, y: 42, color: "#118ab2" },
  { id: 2, x: 265, y: 50, color: "#06d6a0" },
  { id: 3, x: 366, y: 84, color: "#8b5cf6" },
  { id: 4, x: 334, y: 178, color: "#073b4c" },
  { id: 5, x: 224, y: 214, color: "#118ab2" },
  { id: 6, x: 120, y: 194, color: "#06d6a0" },
  { id: 7, x: 44, y: 144, color: "#073b4c" },
  { id: 8, x: 220, y: 124, color: "#ef476f" },
] as const;

const NETWORK_LINKS: ReadonlyArray<readonly [number, number]> = [
  [0, 1],
  [0, 7],
  [0, 8],
  [1, 2],
  [1, 8],
  [2, 3],
  [2, 8],
  [3, 4],
  [3, 8],
  [4, 5],
  [4, 8],
  [5, 6],
  [5, 8],
  [6, 7],
  [6, 8],
  [7, 8],
] as const;

const SIGNAL_TRAVEL_MS = 850;
const SIGNAL_GLOW_MS = 320;
const SIGNAL_PAUSE_MS = 120;
const MESSAGE_ROTATION_MS = 3800;

function getLoadingMessages(testSlug?: string | null): string[] {
  const specificMessages = testSlug ? REPORT_LOADING_MESSAGES_BY_TEST[testSlug] ?? [] : [];
  return [...specificMessages, ...DEFAULT_REPORT_LOADING_MESSAGES];
}

function getLinkKey(leftId: number, rightId: number): string {
  return leftId < rightId ? `${leftId}-${rightId}` : `${rightId}-${leftId}`;
}

export function ReportGenerationLoadingScreen({
  status,
  testSlug,
  testName,
  participantName,
}: ReportGenerationLoadingScreenProps) {
  const messages = useMemo(() => getLoadingMessages(testSlug), [testSlug]);
  const nodesById = useMemo(
    () => new Map(NETWORK_NODES.map((node) => [node.id, node])),
    [],
  );
  const neighborsByNodeId = useMemo(() => {
    const neighborMap = new Map<number, number[]>();

    for (const [leftId, rightId] of NETWORK_LINKS) {
      neighborMap.set(leftId, [...(neighborMap.get(leftId) ?? []), rightId]);
      neighborMap.set(rightId, [...(neighborMap.get(rightId) ?? []), leftId]);
    }

    return neighborMap;
  }, []);

  const [activeMessageIndex, setActiveMessageIndex] = useState(0);
  const [currentNodeId, setCurrentNodeId] = useState<number>(0);
  const [glowingNodeId, setGlowingNodeId] = useState<number | null>(null);
  const [activeLinkKey, setActiveLinkKey] = useState<string | null>(null);
  const [signalPosition, setSignalPosition] = useState(() => {
    const initialNode = NETWORK_NODES[0];
    return { x: initialNode.x, y: initialNode.y };
  });
  const [reducedMotion, setReducedMotion] = useState(false);

  const contextLabel = participantName || testName || "izvještaj";
  const statusLabel = status === "processing" ? "u obradi" : "u redu čekanja";
  const activeMessage = messages[activeMessageIndex] ?? "";
  const nextMessage = messages[(activeMessageIndex + 1) % messages.length] ?? "";

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const syncReducedMotion = () => {
      setReducedMotion(mediaQuery.matches);
    };

    syncReducedMotion();
    mediaQuery.addEventListener("change", syncReducedMotion);

    return () => {
      mediaQuery.removeEventListener("change", syncReducedMotion);
    };
  }, []);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setActiveMessageIndex((currentIndex) => (currentIndex + 1) % messages.length);
    }, MESSAGE_ROTATION_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [messages.length]);

  useEffect(() => {
    if (reducedMotion) {
      const restingNode = nodesById.get(currentNodeId) ?? NETWORK_NODES[0];
      setSignalPosition({ x: restingNode.x, y: restingNode.y });
      setActiveLinkKey(null);
      setGlowingNodeId(restingNode.id);
      return undefined;
    }

    let cancelled = false;
    let travelTimer: number | null = null;
    let glowTimer: number | null = null;
    let nextHopTimer: number | null = null;

    const runHop = (fromNodeId: number) => {
      const neighbors = neighborsByNodeId.get(fromNodeId) ?? [];

      if (neighbors.length === 0 || cancelled) {
        return;
      }

      const targetNodeId = neighbors[Math.floor(Math.random() * neighbors.length)] ?? fromNodeId;
      const targetNode = nodesById.get(targetNodeId);

      if (!targetNode) {
        return;
      }

      setActiveLinkKey(getLinkKey(fromNodeId, targetNodeId));
      setSignalPosition({ x: targetNode.x, y: targetNode.y });

      travelTimer = window.setTimeout(() => {
        if (cancelled) {
          return;
        }

        setCurrentNodeId(targetNodeId);
        setGlowingNodeId(targetNodeId);
        setActiveLinkKey(null);

        glowTimer = window.setTimeout(() => {
          if (cancelled) {
            return;
          }

          setGlowingNodeId(null);
        }, SIGNAL_GLOW_MS);

        nextHopTimer = window.setTimeout(() => {
          runHop(targetNodeId);
        }, SIGNAL_GLOW_MS + SIGNAL_PAUSE_MS);
      }, SIGNAL_TRAVEL_MS);
    };

    const startNode = nodesById.get(currentNodeId) ?? NETWORK_NODES[0];
    setSignalPosition({ x: startNode.x, y: startNode.y });
    runHop(currentNodeId);

    return () => {
      cancelled = true;

      if (travelTimer !== null) {
        window.clearTimeout(travelTimer);
      }

      if (glowTimer !== null) {
        window.clearTimeout(glowTimer);
      }

      if (nextHopTimer !== null) {
        window.clearTimeout(nextHopTimer);
      }
    };
  }, [currentNodeId, neighborsByNodeId, nodesById, reducedMotion]);

  return (
    <section
      aria-busy="true"
      aria-live="polite"
      className="report-generation-loading-screen"
      role="status"
    >
      <p className="report-generation-loading-screen__eyebrow">
        Deep Profile AI Orchestrator
      </p>

      <div className="report-generation-loading-screen__heading-row">
        <h3 className="report-generation-loading-screen__title">
          Deep Profile priprema tvoj izvještaj
        </h3>
        <span className="report-generation-loading-screen__status-pill">{statusLabel}</span>
      </div>

      <p className="sr-only">
        Deep Profile priprema izvještaj za {contextLabel}. Trenutni korak:{" "}
        {activeMessage} Stranica će se automatski osvježiti kada izvještaj bude
        spreman.
      </p>

      <div className="report-generation-loading-screen__visual" aria-hidden="true">
        <svg
          className="report-generation-loading-screen__network"
          viewBox="0 0 450 250"
          fill="none"
        >
          <defs>
            <linearGradient id="report-loading-link" x1="44" y1="42" x2="366" y2="214">
              <stop offset="0%" stopColor="#118ab2" stopOpacity="0.24" />
              <stop offset="55%" stopColor="#06d6a0" stopOpacity="0.22" />
              <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0.18" />
            </linearGradient>
          </defs>

          {NETWORK_LINKS.map(([leftId, rightId]) => {
            const leftNode = nodesById.get(leftId);
            const rightNode = nodesById.get(rightId);

            if (!leftNode || !rightNode) {
              return null;
            }

            const linkKey = getLinkKey(leftId, rightId);
            const isActive = activeLinkKey === linkKey;

            return (
              <line
                key={linkKey}
                className={
                  isActive
                    ? "report-generation-loading-screen__link report-generation-loading-screen__link--active"
                    : "report-generation-loading-screen__link"
                }
                x1={leftNode.x}
                y1={leftNode.y}
                x2={rightNode.x}
                y2={rightNode.y}
              />
            );
          })}

          {NETWORK_NODES.map((node) => {
            const isGlowing = glowingNodeId === node.id;

            return (
              <g key={node.id}>
                <circle
                  className={
                    isGlowing
                      ? "report-generation-loading-screen__node-glow report-generation-loading-screen__node-glow--active"
                      : "report-generation-loading-screen__node-glow"
                  }
                  cx={node.x}
                  cy={node.y}
                  r="18"
                  fill={node.color}
                />
                <circle
                  className="report-generation-loading-screen__node-core"
                  cx={node.x}
                  cy={node.y}
                  r="7"
                  fill={node.color}
                />
                <circle
                  className="report-generation-loading-screen__node-ring"
                  cx={node.x}
                  cy={node.y}
                  r="10"
                  stroke={node.color}
                />
              </g>
            );
          })}

          <g
            className="report-generation-loading-screen__signal-group"
            style={{
              transform: `translate(${signalPosition.x}px, ${signalPosition.y}px)`,
              transition: reducedMotion ? "none" : `transform ${SIGNAL_TRAVEL_MS}ms ease-in-out`,
            }}
          >
            <circle className="report-generation-loading-screen__signal-glow" cx="0" cy="0" r="12" />
            <circle className="report-generation-loading-screen__signal-dot" cx="0" cy="0" r="5.8" />
          </g>
        </svg>
      </div>

      <div className="report-generation-loading-screen__message-box">
        <p className="report-generation-loading-screen__message-label">AI status</p>
        <p className="report-generation-loading-screen__message-current">
          <span className="report-generation-loading-screen__message-prefix">→</span>
          {activeMessage}
        </p>
        <p aria-hidden="true" className="report-generation-loading-screen__message-next">
          {nextMessage}
        </p>
      </div>

      <style jsx>{`
        .report-generation-loading-screen {
          width: min(100%, 35rem);
          max-width: 35rem;
          margin: 0 auto;
          border: 1px solid rgba(203, 213, 225, 0.84);
          border-radius: 28px;
          background: linear-gradient(
            180deg,
            rgba(255, 255, 255, 0.985),
            rgba(247, 250, 252, 0.975)
          );
          box-shadow: 0 24px 56px -40px rgba(15, 23, 42, 0.32);
          padding: 1.35rem 1.2rem 1.15rem;
        }

        .report-generation-loading-screen__eyebrow {
          margin: 0;
          color: #073b4c;
          font-size: 0.68rem;
          font-weight: 800;
          letter-spacing: 0.18em;
          line-height: 1;
          text-transform: uppercase;
        }

        .report-generation-loading-screen__heading-row {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 0.9rem;
          margin-top: 0.8rem;
        }

        .report-generation-loading-screen__title {
          margin: 0;
          color: #0f172a;
          font-size: clamp(1.85rem, 2.5vw, 2.15rem);
          font-weight: 800;
          line-height: 1.08;
          letter-spacing: -0.04em;
          flex: 1 1 auto;
          min-width: 0;
        }

        .report-generation-loading-screen__status-pill {
          display: inline-flex;
          align-items: center;
          flex: 0 0 auto;
          border: 1px solid rgba(17, 138, 178, 0.22);
          border-radius: 999px;
          background: rgba(17, 138, 178, 0.08);
          padding: 0.34rem 0.62rem;
          color: #118ab2;
          font-size: 0.71rem;
          font-weight: 700;
          line-height: 1;
          text-transform: lowercase;
        }

        .report-generation-loading-screen__visual {
          margin-top: 1rem;
          border: 1px solid rgba(226, 232, 240, 0.92);
          border-radius: 22px;
          background:
            radial-gradient(circle at top, rgba(17, 138, 178, 0.08), transparent 54%),
            linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(248, 250, 252, 0.99));
          padding: 0.8rem 0.75rem 0.6rem;
        }

        .report-generation-loading-screen__network {
          display: block;
          width: 100%;
          height: 240px;
          overflow: visible;
        }

        .report-generation-loading-screen__link {
          stroke: url(#report-loading-link);
          stroke-width: 1.5;
          opacity: 0.7;
          transition: opacity 220ms ease, stroke-width 220ms ease;
        }

        .report-generation-loading-screen__link--active {
          stroke-width: 2.2;
          opacity: 1;
        }

        .report-generation-loading-screen__node-glow {
          opacity: 0;
          transition: opacity 180ms ease;
        }

        .report-generation-loading-screen__node-glow--active {
          opacity: 0.28;
          animation: report-loading-node-glow 340ms ease-out forwards;
        }

        .report-generation-loading-screen__node-core {
          filter: drop-shadow(0 8px 14px rgba(15, 23, 42, 0.16));
        }

        .report-generation-loading-screen__node-ring {
          stroke-width: 1.4;
          opacity: 0.42;
        }

        .report-generation-loading-screen__signal-group {
          transform-box: fill-box;
          transform-origin: center;
        }

        .report-generation-loading-screen__signal-glow {
          fill: rgba(255, 209, 102, 0.28);
        }

        .report-generation-loading-screen__signal-dot {
          fill: #ffd166;
          filter: drop-shadow(0 0 8px rgba(255, 209, 102, 0.72));
        }

        .report-generation-loading-screen__message-box {
          min-height: 7.75rem;
          height: 7.75rem;
          display: grid;
          grid-template-rows: auto 1fr auto;
          align-content: start;
          margin-top: 0.95rem;
          border: 1px solid rgba(203, 213, 225, 0.88);
          border-radius: 16px;
          background: rgba(255, 255, 255, 0.84);
          padding: 0.72rem 0.9rem 0.68rem;
          overflow: hidden;
        }

        .report-generation-loading-screen__message-label {
          margin: 0 0 0.65rem;
          color: rgb(100, 116, 139);
          font-size: 0.7rem;
          font-weight: 800;
          letter-spacing: 0.14em;
          line-height: 1;
          text-transform: uppercase;
        }

        .report-generation-loading-screen__message-current,
        .report-generation-loading-screen__message-next {
          font-family:
            ui-monospace,
            SFMono-Regular,
            Menlo,
            Monaco,
            Consolas,
            "Liberation Mono",
            "Courier New",
            monospace;
        }

        .report-generation-loading-screen__message-current {
          display: -webkit-box;
          min-height: 3.2rem;
          margin: 0;
          color: #073b4c;
          font-size: 0.78rem;
          font-weight: 700;
          line-height: 1.55;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        .report-generation-loading-screen__message-next {
          display: -webkit-box;
          min-height: 2.2rem;
          margin: 0.55rem 0 0;
          margin-bottom: 0;
          color: rgba(7, 59, 76, 0.48);
          font-size: 0.64rem;
          font-weight: 500;
          line-height: 1.45;
          opacity: 0.48;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        .report-generation-loading-screen__message-prefix {
          display: inline-block;
          margin-right: 0.55rem;
          color: #118ab2;
          font-weight: 800;
        }

        @keyframes report-loading-node-glow {
          0% {
            transform: scale(0.92);
            opacity: 0.12;
          }
          45% {
            transform: scale(1.08);
            opacity: 0.28;
          }
          100% {
            transform: scale(1);
            opacity: 0;
          }
        }

        @media (min-width: 640px) {
          .report-generation-loading-screen {
            padding: 1.55rem 1.45rem 1.25rem;
          }
        }

        @media (max-width: 639px) {
          .report-generation-loading-screen__heading-row {
            flex-direction: column;
            align-items: flex-start;
          }

          .report-generation-loading-screen__status-pill {
            margin-top: 0.15rem;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .report-generation-loading-screen__link,
          .report-generation-loading-screen__node-glow,
          .report-generation-loading-screen__signal-group {
            transition: none;
          }

          .report-generation-loading-screen__node-glow--active {
            animation: none;
            opacity: 0.2;
          }
        }
      `}</style>
    </section>
  );
}
