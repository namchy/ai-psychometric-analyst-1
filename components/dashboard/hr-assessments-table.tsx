"use client";

import { useState } from "react";
import Link from "next/link";
import { createStandardAssessmentBattery } from "@/app/actions/participants";
import { CreateAssessmentModal } from "@/components/dashboard/create-assessment-modal";
import { DashboardActionRow, DashboardSectionShell } from "@/components/dashboard/primitives";
import {
  DEFAULT_ASSESSMENT_LOCALE,
  SUPPORTED_ASSESSMENT_LOCALES,
  getAssessmentLocaleLabel,
  toLegacyAssessmentLocale,
} from "@/lib/assessment/locale";

type AssessmentFilterKey = "all" | "in-progress" | "review-ready" | "attention";
type AssessmentAggregateStatus =
  | "Čeka kandidata"
  | "U toku"
  | "Djelimično završeno"
  | "Spremno za pregled"
  | "Traži pažnju";
type HrFriendlyTestStatus =
  | "Završeno"
  | "U toku"
  | "Čeka"
  | "Nije dodijeljeno"
  | "Arhivirano"
  | "Greška";

type HrAssessmentsTableRow = {
  participant: {
    id: string;
    email: string;
    full_name: string;
    user_id: string | null;
  };
  totalTests: number;
  completedTests: number;
  aggregateStatus: AssessmentAggregateStatus;
  primaryAction:
    | {
        kind: "create";
        label: "Dodijeli procjenu";
      }
    | {
        kind: "info";
        label: "Čeka kandidata" | "Traži pažnju";
        note: string;
      }
    | {
        kind: "link";
        label: "Pogledaj procjenu";
        href: string;
      };
  testItems: Array<{
    key: string;
    shortLabel: string;
    status: HrFriendlyTestStatus;
  }>;
};

type StandardBatteryTest = {
  id: string;
  slug: string;
  name: string;
};

type HrAssessmentsTableProps = {
  initialFilter: AssessmentFilterKey;
  initialSearchTerm: string;
  rows: HrAssessmentsTableRow[];
  openAttemptFor: string | null;
  standardBatteryTests: StandardBatteryTest[];
  createActionMessage: string | null;
  inlineBatterySuccessMessage: string | null;
  createAttemptDetails: string | null;
};

function matchesFilter(row: HrAssessmentsTableRow, filter: AssessmentFilterKey): boolean {
  switch (filter) {
    case "in-progress":
      return row.aggregateStatus === "U toku" || row.aggregateStatus === "Djelimično završeno";
    case "review-ready":
      return row.aggregateStatus === "Spremno za pregled";
    case "attention":
      return row.aggregateStatus === "Traži pažnju";
    default:
      return true;
  }
}

function getStandardBatteryShortLabel(slug: string): string {
  switch (slug) {
    case "ipip-neo-120-v1":
      return "IPIP-NEO-120";
    case "safran_v1":
      return "SAFRAN";
    case "mwms_v1":
      return "MWMS";
    default:
      return slug;
  }
}

function getTestStatusClassName(status: HrFriendlyTestStatus): string {
  switch (status) {
    case "Završeno":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "U toku":
      return "border-sky-200 bg-sky-50 text-sky-700";
    case "Čeka":
      return "border-amber-200 bg-amber-50 text-amber-700";
    case "Nije dodijeljeno":
      return "border-slate-200 bg-slate-50 text-slate-500";
    case "Arhivirano":
      return "border-slate-200 bg-slate-100 text-slate-600";
    case "Greška":
      return "border-rose-200 bg-rose-50 text-rose-700";
    default:
      return "border-slate-200 bg-slate-100 text-slate-600";
  }
}

export function HrAssessmentsTable({
  initialFilter,
  initialSearchTerm,
  rows,
  openAttemptFor,
  standardBatteryTests,
  createActionMessage,
  inlineBatterySuccessMessage,
  createAttemptDetails,
}: HrAssessmentsTableProps) {
  const [activeFilter, setActiveFilter] = useState<AssessmentFilterKey>(initialFilter);
  const [searchTerm, setSearchTerm] = useState(initialSearchTerm);
  const [isCreateAssessmentModalOpen, setIsCreateAssessmentModalOpen] = useState(false);

  const normalizedSearch = searchTerm.trim().toLocaleLowerCase("hr");
  const visibleRows = rows.filter((row) => {
    const matchesSearch =
      normalizedSearch.length === 0 ||
      row.participant.full_name.toLocaleLowerCase("hr").includes(normalizedSearch) ||
      row.participant.email.toLocaleLowerCase("hr").includes(normalizedSearch);

    return matchesSearch && matchesFilter(row, activeFilter);
  });

  const filterCounts: Record<AssessmentFilterKey, number> = {
    all: rows.length,
    "in-progress": rows.filter((row) => matchesFilter(row, "in-progress")).length,
    "review-ready": rows.filter((row) => matchesFilter(row, "review-ready")).length,
    attention: rows.filter((row) => matchesFilter(row, "attention")).length,
  };

  return (
    <>
      <DashboardSectionShell className="overflow-hidden rounded-[2rem] border border-slate-200/90 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(242,247,250,0.95))] px-0 py-0 shadow-[0_30px_70px_rgba(15,23,42,0.1)]">
        <div className="border-b border-slate-200/80 px-4 py-5 sm:px-5">
          <div className="flex flex-col gap-3.5">
            <div className="min-w-0">
              <h2 className="font-headline text-[1.8rem] font-bold tracking-[-0.04em] text-slate-950">
                Procjene kandidata
              </h2>
              <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">
                Prati status testova, dostupne rezultate i sljedeću HR akciju za svakog kandidata.
              </p>
            </div>

            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="relative min-w-0 max-w-[24rem] flex-1">
                <input
                  aria-label="Pretraži kandidata"
                  className="w-full rounded-full border border-slate-200 bg-white px-4 py-3 pr-12 text-sm text-slate-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] outline-none transition focus:border-teal-300 focus:ring-2 focus:ring-teal-500/15"
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Pretraži kandidata"
                  type="search"
                  value={searchTerm}
                />
                {searchTerm ? (
                  <button
                    aria-label="Obriši pretragu"
                    className="absolute right-4 top-1/2 m-0 inline-flex h-6 w-6 min-h-0 min-w-0 -translate-y-1/2 appearance-none items-center justify-center rounded-full border border-cyan-200/70 bg-cyan-50 p-0 text-cyan-700 shadow-none transition hover:border-cyan-300 hover:bg-cyan-100 hover:text-cyan-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200"
                    onClick={() => setSearchTerm("")}
                    type="button"
                  >
                    <span className="text-[14px] font-semibold leading-none">×</span>
                  </button>
                ) : null}
              </div>

              <button
                className="min-h-0 w-fit rounded-full border border-teal-700 bg-teal-600 px-5 py-3 text-xs font-bold uppercase tracking-[0.16em] text-white shadow-[0_18px_36px_rgba(13,148,136,0.24)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-teal-700 hover:shadow-[0_22px_40px_rgba(13,148,136,0.3)]"
                onClick={() => setIsCreateAssessmentModalOpen(true)}
                type="button"
              >
                Kreiraj procjenu
              </button>
            </div>

            <div className="flex flex-nowrap items-center gap-2 overflow-x-auto pb-1">
              <span className="shrink-0 pr-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                Filteri
              </span>
              {(
                [
                  { key: "all", label: "Svi" },
                  { key: "in-progress", label: "U toku" },
                  { key: "review-ready", label: "Spremno za pregled" },
                  { key: "attention", label: "Traži pažnju" },
                ] satisfies Array<{ key: AssessmentFilterKey; label: string }>
              ).map((filterOption) => {
                const isActive = activeFilter === filterOption.key;

                return (
                  <button
                    key={filterOption.key}
                    className={`group shrink-0 whitespace-nowrap rounded-full border px-3.5 py-2.5 text-xs font-semibold transition ${
                      isActive
                        ? "border-teal-300 bg-teal-100 text-teal-800 shadow-[0_14px_28px_rgba(13,148,136,0.16)] hover:border-teal-700 hover:bg-teal-700"
                        : "border-slate-200 bg-white/90 text-slate-700 shadow-[0_8px_18px_rgba(15,23,42,0.05)] hover:border-teal-700 hover:bg-teal-700"
                    }`}
                    onClick={() => setActiveFilter(filterOption.key)}
                    type="button"
                  >
                    <span className="group-hover:text-white">{filterOption.label}</span>
                    <span className="ml-1.5 rounded-full bg-black/5 px-1.5 py-0.5 text-[11px] font-bold text-current group-hover:bg-white group-hover:text-teal-800">
                      {filterCounts[filterOption.key]}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {visibleRows.length === 0 ? (
          <div className="px-5 py-8 text-sm leading-6 text-slate-600">
            Nema kandidata koji odgovaraju trenutnoj pretrazi ili filteru.
          </div>
        ) : (
          <div className="overflow-x-auto px-3 pb-3 sm:px-4" id="candidate-assessments-table">
            <table className="min-w-[1120px] w-full border-separate border-spacing-x-0 border-spacing-y-3">
              <colgroup>
                <col className="w-[23%]" />
                <col className="w-[20%]" />
                <col className="w-[40%]" />
                <col className="w-[17%]" />
              </colgroup>
              <thead>
                <tr className="text-left">
                  {["Kandidat", "Napredak", "Testovi", "Akcija"].map((header) => (
                    <th
                      key={header}
                      className="px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500"
                      scope="col"
                    >
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((row) => {
                  const progressRatio = row.totalTests > 0 ? row.completedTests / row.totalTests : 0;

                  return (
                    <tr key={row.participant.id} className="group transition hover:-translate-y-[1px]">
                      <td className="align-middle rounded-l-[1.1rem] border-y border-l border-slate-200/70 bg-[rgba(255,255,255,0.94)] pr-4 pl-5 py-5 transition-colors group-hover:bg-white">
                        <div className="space-y-1.5">
                          <div>
                            <p className="text-[15px] font-semibold leading-6 text-slate-950">
                              {row.participant.full_name}
                            </p>
                            <p className="text-sm text-slate-600">{row.participant.email}</p>
                          </div>
                          <span
                            className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-medium ${
                              row.participant.user_id
                                ? "bg-emerald-50 text-emerald-700"
                                : "bg-slate-100 text-slate-600"
                            }`}
                          >
                            {row.participant.user_id ? "Povezan nalog" : "Nalog nije povezan"}
                          </span>
                        </div>
                      </td>
                      <td className="align-middle border-y border-slate-200/70 bg-[rgba(255,255,255,0.94)] pl-3 pr-5 py-5 transition-colors group-hover:bg-white">
                        <div className="min-w-[9.5rem] max-w-[11rem] space-y-2">
                          <span className="block whitespace-nowrap text-[15px] font-semibold leading-5 text-slate-900">
                            {row.completedTests}/{row.totalTests} završeno
                          </span>
                          <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-teal-500 to-sky-500"
                              style={{ width: `${Math.max(progressRatio * 100, row.totalTests > 0 ? 6 : 0)}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="align-middle border-y border-slate-200/70 bg-[rgba(255,255,255,0.94)] px-5 py-5 transition-colors group-hover:bg-white">
                        <div className="space-y-2">
                          {row.testItems.map((testItem) => (
                            <div
                              key={testItem.key}
                              className="grid max-w-[18rem] grid-cols-[minmax(0,1fr)_auto] items-start gap-x-2.5 gap-y-0.5"
                            >
                              <div className="min-w-0">
                                <p className="text-[14px] font-semibold leading-5 text-slate-900">
                                  {testItem.shortLabel}
                                </p>
                              </div>
                              <span
                                className={`mt-0.5 shrink-0 self-start whitespace-nowrap rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] ${getTestStatusClassName(testItem.status)}`}
                              >
                                {testItem.status}
                              </span>
                            </div>
                          ))}
                        </div>
                      </td>
                      <td className="align-middle rounded-r-[1.1rem] border-y border-r border-slate-200/70 bg-[rgba(255,255,255,0.94)] px-5 py-5 transition-colors group-hover:bg-white">
                        {row.primaryAction.kind === "link" ? (
                          <Link
                            className="inline-flex min-h-0 rounded-full border border-teal-700 bg-teal-600 px-4 py-2.5 text-[12px] font-bold uppercase tracking-[0.14em] text-white shadow-[0_16px_30px_rgba(13,148,136,0.22)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-teal-700"
                            href={row.primaryAction.href}
                          >
                            {row.primaryAction.label}
                          </Link>
                        ) : row.primaryAction.kind === "info" ? (
                          <div className="max-w-[14rem] space-y-1.5">
                            <p className="text-[14px] font-semibold leading-5 text-slate-700">
                              {row.primaryAction.label}
                            </p>
                            <p className="text-[11px] leading-4 text-slate-400">{row.primaryAction.note}</p>
                          </div>
                        ) : (
                          <details
                            className="group w-[16rem] rounded-[1.2rem] border border-slate-200 bg-white/85 shadow-[0_12px_28px_rgba(15,23,42,0.05)]"
                            id={`row-action-${row.participant.id}`}
                            open={openAttemptFor === row.participant.id}
                          >
                            <summary className="cursor-pointer list-none rounded-[1.2rem] px-4 py-3 [&::-webkit-details-marker]:hidden">
                              <span className="inline-flex min-h-0 rounded-full border border-teal-700 bg-teal-600 px-4 py-2.5 text-[11px] font-bold uppercase tracking-[0.16em] text-white shadow-[0_16px_30px_rgba(13,148,136,0.22)] transition-all duration-200 group-open:bg-teal-700">
                                {row.primaryAction.label}
                              </span>
                            </summary>
                            <form
                              action={createStandardAssessmentBattery}
                              className="space-y-4 border-t border-slate-200/90 px-4 py-4"
                            >
                              <input name="participantId" type="hidden" value={row.participant.id} />
                              <div className="rounded-[1rem] border border-slate-200 bg-slate-50/80 px-4 py-3">
                                <p className="text-sm font-semibold text-slate-900">Standardna baterija</p>
                                <ul className="mt-2 space-y-2 text-sm text-slate-600">
                                  {standardBatteryTests.map((test) => (
                                    <li key={test.id} className="flex items-center justify-between gap-3">
                                      <span>{getStandardBatteryShortLabel(test.slug)}</span>
                                      <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-700">
                                        Dostupno
                                      </span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                              <div className="space-y-2">
                                <label
                                  className="text-sm font-medium text-slate-700"
                                  htmlFor={`attempt-locale-${row.participant.id}`}
                                >
                                  Jezik
                                </label>
                                <select
                                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-teal-300 focus:ring-2 focus:ring-teal-500/15"
                                  defaultValue={toLegacyAssessmentLocale(DEFAULT_ASSESSMENT_LOCALE)}
                                  id={`attempt-locale-${row.participant.id}`}
                                  name="locale"
                                  required
                                >
                                  {SUPPORTED_ASSESSMENT_LOCALES.map((locale) => (
                                    <option key={locale} value={locale}>
                                      {getAssessmentLocaleLabel(locale)}
                                    </option>
                                  ))}
                                </select>
                              </div>
                              {openAttemptFor === row.participant.id && createActionMessage ? (
                                <p className="rounded-[1rem] border border-rose-200 bg-rose-50 px-4 py-3 text-sm leading-6 text-rose-700">
                                  {createAttemptDetails ?? createActionMessage}
                                </p>
                              ) : null}
                              {openAttemptFor === row.participant.id && inlineBatterySuccessMessage ? (
                                <p className="rounded-[1rem] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm leading-6 text-emerald-700">
                                  {inlineBatterySuccessMessage}
                                </p>
                              ) : null}
                              <DashboardActionRow>
                                <button
                                  className="w-full min-h-0 rounded-full border border-teal-700 bg-teal-600 px-5 py-3 text-xs font-bold uppercase tracking-[0.16em] text-white shadow-[0_18px_36px_rgba(13,148,136,0.24)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-teal-700 hover:shadow-[0_22px_40px_rgba(13,148,136,0.3)]"
                                  type="submit"
                                >
                                  Kreiraj procjenu
                                </button>
                              </DashboardActionRow>
                            </form>
                          </details>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </DashboardSectionShell>

      {isCreateAssessmentModalOpen ? (
        <CreateAssessmentModal onClose={() => setIsCreateAssessmentModalOpen(false)} />
      ) : null}
    </>
  );
}
