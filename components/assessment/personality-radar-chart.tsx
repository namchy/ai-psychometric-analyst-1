"use client";

import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
} from "recharts";

export type PersonalityRadarDomain = {
  key: string;
  label: string;
  score: number | string | null | undefined;
};

export type PersonalityRadarChartProps = {
  domains: PersonalityRadarDomain[];
  className?: string;
};

type PersonalityRadarSnapshot = {
  highest: PersonalityRadarDomain | null;
  secondHighest: PersonalityRadarDomain | null;
  lowest: PersonalityRadarDomain | null;
};

type ChartDatum = {
  subject: string;
  score: number;
  fullMark: 5;
};

const CHART_STROKE = "#155E75";
const CHART_FILL = "#0E7490";
const GRID_STROKE = "rgba(100, 116, 139, 0.24)";
const LABEL_FILL = "#334155";
const RADIUS_TICKS = [1, 2, 3, 4, 5] as const;

function toFiniteNumber(value: PersonalityRadarDomain["score"]): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }

    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function clampScore(score: number): number {
  return Math.min(5, Math.max(1, score));
}

function getValidDomains(domains: PersonalityRadarDomain[]) {
  return domains.flatMap((domain) => {
    const numericScore = toFiniteNumber(domain.score);

    if (numericScore === null) {
      return [];
    }

    return [
      {
        domain,
        numericScore,
      },
    ];
  });
}

export function getPersonalityRadarSnapshot(
  domains: PersonalityRadarDomain[],
): PersonalityRadarSnapshot {
  const sortedDomains = [...getValidDomains(domains)].sort(
    (left, right) => right.numericScore - left.numericScore,
  );

  return {
    highest: sortedDomains[0]?.domain ?? null,
    secondHighest: sortedDomains[1]?.domain ?? null,
    lowest: sortedDomains.at(-1)?.domain ?? null,
  };
}

export function PersonalityRadarChart({
  domains,
  className,
}: PersonalityRadarChartProps) {
  const chartData: ChartDatum[] = getValidDomains(domains).map(({ domain, numericScore }) => ({
    subject: domain.label,
    score: clampScore(numericScore),
    fullMark: 5,
  }));

  if (chartData.length === 0) {
    return null;
  }

  return (
    <div className={["h-[300px] w-full", className].filter(Boolean).join(" ")}>
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart data={chartData} margin={{ top: 8, right: 42, bottom: 18, left: 42 }}>
          <PolarGrid gridType="polygon" stroke={GRID_STROKE} strokeWidth={1} />
          <PolarAngleAxis
            dataKey="subject"
            tick={{ fill: LABEL_FILL, fontSize: 12 }}
            tickLine={false}
          />
          <PolarRadiusAxis
            angle={90}
            axisLine={false}
            domain={[1, 5]}
            tick={false}
            tickCount={RADIUS_TICKS.length}
            tickLine={false}
            ticks={[...RADIUS_TICKS]}
          />
          <Radar
            activeDot={false}
            dataKey="score"
            dot={false}
            fill={CHART_FILL}
            fillOpacity={0.1}
            isAnimationActive={false}
            stroke={CHART_STROKE}
            strokeWidth={2.5}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}

export default PersonalityRadarChart;
