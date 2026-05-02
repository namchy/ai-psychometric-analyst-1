"use client";

import { useFormStatus } from "react-dom";
import {
  DEFAULT_ASSESSMENT_LOCALE,
  getAssessmentLocaleLabel,
  toLegacyAssessmentLocale,
} from "@/lib/assessment/locale";

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();

  return (
    <button
      className="min-h-0 w-full rounded-full border border-teal-700 bg-teal-600 px-5 py-3 text-xs font-bold uppercase tracking-[0.16em] text-white shadow-[0_18px_36px_rgba(13,148,136,0.24)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-teal-700 hover:shadow-[0_22px_40px_rgba(13,148,136,0.3)] disabled:cursor-not-allowed disabled:border-slate-300 disabled:bg-slate-200 disabled:text-slate-500 disabled:shadow-none sm:w-auto"
      disabled={pending}
      type="submit"
    >
      {pending ? "Kreiranje..." : label}
    </button>
  );
}

export function CreateAssessmentForm({
  action,
  errorMessage,
  onCancel,
  submitLabel,
}: {
  action: (formData: FormData) => void | Promise<void>;
  errorMessage?: string | null;
  onCancel: () => void;
  submitLabel: string;
}) {
  return (
    <form action={action} className="space-y-[18px]">
      <input name="participantType" type="hidden" value="candidate" />
      <input name="status" type="hidden" value="active" />
      <input
        name="locale"
        type="hidden"
        value={toLegacyAssessmentLocale(DEFAULT_ASSESSMENT_LOCALE)}
      />

      <div className="space-y-2">
        <label className="text-sm font-medium text-slate-700" htmlFor="new-assessment-full-name">
          Ime i prezime
        </label>
        <input
          autoFocus
          className="h-11 w-full rounded-[12px] border bg-white px-4 text-sm text-slate-700 outline-none transition focus:border-cyan-500/50 focus:ring-2 focus:ring-cyan-500/10"
          style={{ borderColor: "rgba(148, 163, 184, 0.45)" }}
          id="new-assessment-full-name"
          name="fullName"
          required
          type="text"
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-slate-700" htmlFor="new-assessment-email">
          Email
        </label>
        <input
          className="h-11 w-full rounded-[12px] border bg-white px-4 text-sm text-slate-700 outline-none transition focus:border-cyan-500/50 focus:ring-2 focus:ring-cyan-500/10"
          style={{ borderColor: "rgba(148, 163, 184, 0.45)" }}
          id="new-assessment-email"
          name="email"
          required
          type="email"
        />
      </div>

      <div
        className="rounded-[16px] border px-4 py-4 text-sm text-slate-600"
        style={{ background: "rgba(17, 138, 178, 0.07)", borderColor: "rgba(17, 138, 178, 0.14)" }}
      >
        <p className="font-semibold text-[#073b4c]">Standardna baterija</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {["IPIP-NEO-120", "SAFRAN", "MWMS"].map((test) => (
            <span
              className="rounded-full border border-cyan-100 bg-white/80 px-3 py-1 text-xs font-semibold text-slate-700"
              key={test}
            >
              {test}
            </span>
          ))}
        </div>
        <p className="mt-3 text-xs text-slate-500">
          Jezik procjene: {getAssessmentLocaleLabel(DEFAULT_ASSESSMENT_LOCALE)}
        </p>
      </div>

      {errorMessage ? (
        <p
          className="rounded-[16px] border px-4 py-3 text-sm leading-6 text-rose-900"
          style={{ background: "rgba(239, 71, 111, 0.08)", borderColor: "rgba(239, 71, 111, 0.18)" }}
        >
          {errorMessage}
        </p>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
        <button
          className="min-h-0 w-full rounded-full border border-slate-200 bg-white px-5 py-3 text-xs font-bold uppercase tracking-[0.16em] text-slate-700 transition-all duration-200 hover:border-slate-300 hover:text-slate-900 sm:order-1 sm:w-auto"
          onClick={onCancel}
          type="button"
        >
          Odustani
        </button>
        <div className="sm:order-2">
          <SubmitButton label={submitLabel} />
        </div>
      </div>
    </form>
  );
}
