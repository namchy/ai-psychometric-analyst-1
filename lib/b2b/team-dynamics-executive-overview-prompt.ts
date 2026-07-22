import "server-only";

import type { TeamDynamicsReportInputSnapshot } from "@/lib/b2b/team-dynamics-report-input";
import {
  TEAM_DYNAMICS_EXECUTIVE_OVERVIEW_REPORT_TYPE,
  TEAM_DYNAMICS_EXECUTIVE_OVERVIEW_SCHEMA_VERSION,
} from "@/lib/b2b/team-dynamics-executive-overview-contract";

export function buildSystemPrompt(): string {
  return [
    "You generate one Team Dynamics Executive Overview snapshot.",
    "Return JSON only.",
    "Output must match the supplied JSON schema exactly.",
    "Use only the deterministic input_snapshot provided by the caller.",
    "Do not request, infer, summarize, quote or reconstruct individual answers, raw responses or response-level evidence.",
    "Do not output individual score values, member score tables, participant rankings or any person-level comparison.",
    "Do not name any individual as the problem, blocker, risk or weak link.",
    "Do not produce Team Fit output, fit scores, fit labels or fit recommendations.",
    "Do not use hiring, selection, hire/no-hire or candidate recommendation language.",
    'Do not describe the team as "loš tim" or "disfunkcionalan tim".',
    "Do not produce a unified overall team score.",
    "Treat outcome pulse as a separate signal, not as the diagnostic core of the report.",
    "Tone: HR and leadership-facing, Bosnian, Latin script, ijekavica, cautious, developmental, non-diagnostic.",
    "Use the input snapshot as a team-level development signal only.",
  ].join(" ");
}

export function buildUserPrompt(inputSnapshot: TeamDynamicsReportInputSnapshot): string {
  return JSON.stringify({
    instructions: {
      output_contract:
        "Return one Team Dynamics Executive Overview snapshot in contract team_dynamics_executive_overview_v1.",
      source_rule:
        "Use only input_snapshot. Do not read a database, do not rerun scoring, do not rerun aggregation and do not use raw responses.",
      scope_rule:
        "This is team-level only. No individual answers, no individual score values, no individual naming and no team-fit output.",
      outcome_pulse_rule:
        "Outcome pulse is a separate signal and must not be framed as the core score or a unified overall team score.",
      tone_rule:
        "Write in bosanski, latinica, ijekavica, for HR and leadership stakeholders. Keep tone calm, operational, cautious and developmental.",
      structure_rules: [
        "Return valid JSON only.",
        `Keep reportType exactly ${TEAM_DYNAMICS_EXECUTIVE_OVERVIEW_REPORT_TYPE}.`,
        `Keep reportVersion exactly ${TEAM_DYNAMICS_EXECUTIVE_OVERVIEW_SCHEMA_VERSION}.`,
        "Keep locale as bs.",
        "Use at least 1 item in keyTeamSignals, dimensionOverview.dimensions, alignmentAndFriction.alignmentSignals, alignmentAndFriction.frictionSignals, risksToWatch, leadershipRecommendations, suggestedNextConversation.prompts and interpretationLimits.",
        "Do not add unified overall score fields.",
      ],
      hard_guardrails: [
        "No raw responses.",
        "No individual answers.",
        "No individual scores.",
        "No member ranking.",
        "No Team Fit output.",
        "No hire/no-hire language.",
        "No naming individuals as the problem.",
        'No phrases "loš tim" or "disfunkcionalan tim".',
      ],
    },
    input_snapshot: inputSnapshot,
  });
}
