"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { useFormState } from "react-dom";
import { createCandidateAssessment } from "@/app/actions/participants";
import { CreateAssessmentForm } from "@/components/dashboard/create-assessment-form";
import { INITIAL_CREATE_ASSESSMENT_MODAL_STATE } from "@/components/dashboard/create-assessment-modal-state";

type CreateAssessmentModalProps = {
  onClose: () => void;
};

export function CreateAssessmentModal({ onClose }: CreateAssessmentModalProps) {
  const [state, formAction] = useFormState(
    createCandidateAssessment,
    INITIAL_CREATE_ASSESSMENT_MODAL_STATE,
  );
  const [isMounted, setIsMounted] = useState(false);
  const titleId = useId();
  const descriptionId = useId();
  const router = useRouter();
  const hasRefreshedRef = useRef(false);

  useEffect(() => {
    setIsMounted(true);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    if (state.status === "success" && !hasRefreshedRef.current) {
      hasRefreshedRef.current = true;
      router.refresh();
    }
  }, [router, state.status]);

  function closeAndFocusTable() {
    onClose();

    requestAnimationFrame(() => {
      document.getElementById("candidate-assessments-table")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  }

  if (!isMounted) {
    return null;
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-[rgba(7,59,76,0.30)] p-4 backdrop-blur-md"
      data-modal-layer="overlay"
    >
      <button
        aria-label="Zatvori modal"
        className="absolute inset-0 m-0 min-h-0 min-w-0 appearance-none rounded-none border-0 bg-transparent p-0 shadow-none hover:bg-transparent"
        data-modal-layer="dismiss"
        onClick={onClose}
        type="button"
      />

      <div
        aria-describedby={descriptionId}
        aria-labelledby={titleId}
        aria-modal="true"
        className="relative z-[10000] w-[calc(100%-32px)] max-w-[620px] overflow-hidden rounded-[28px] px-8 py-7"
        data-modal-layer="card"
        style={{
          background: "rgba(255, 255, 255, 0.97)",
          border: "1px solid rgba(255, 255, 255, 0.78)",
          boxShadow: "0 28px 80px rgba(7, 59, 76, 0.20)",
        }}
        role="dialog"
      >
        {state.status === "success" ? (
          <div className="space-y-[18px]">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1.5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-teal-700">
                  NOVA PROCJENA
                </p>
                <h2
                  className="font-headline text-[1.8rem] font-bold tracking-[-0.04em] text-slate-950"
                  id={titleId}
                >
                  Procjena je kreirana
                </h2>
                <p className="text-sm leading-5 text-slate-600" id={descriptionId}>
                  Kandidat je uspješno provisioniran i dodijeljena mu je standardna baterija testova.
                </p>
              </div>
              <button
                aria-label="Zatvori modal"
                className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-slate-500 shadow-none transition hover:border-slate-300 hover:bg-slate-100 hover:text-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/15"
                onClick={onClose}
                type="button"
              >
                <span className="text-[14px] font-semibold leading-none">×</span>
              </button>
            </div>

            <div
              className="rounded-[16px] border px-4 py-4 text-sm leading-6 text-slate-700"
              style={{ background: "rgba(6, 214, 160, 0.08)", borderColor: "rgba(6, 214, 160, 0.18)" }}
            >
              <p className="font-semibold text-[#073b4c]">Procjena je kreirana</p>
              <div className="mt-2 space-y-1">
                <p>
                  <strong>Kandidat:</strong> {state.participantName ?? "Novi kandidat"}
                </p>
                <p>
                  <strong>Email:</strong> {state.email ?? "Nije dostupan"}
                </p>
                <div className="pt-1">
                  <p className="text-xs font-medium uppercase tracking-[0.14em] text-slate-500">
                    Dodijeljeni testovi
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {(state.assignedTests ?? ["IPIP-NEO-120", "SAFRAN", "MWMS"]).map((test) => (
                      <span
                        className="rounded-full border border-cyan-100 bg-white/80 px-3 py-1 text-xs font-semibold text-slate-700"
                        key={test}
                      >
                        {test}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {state.temporaryPassword ? (
              <div className="rounded-[16px] border border-slate-200 bg-white/80 px-4 py-4 text-sm leading-6 text-slate-700">
                <p className="font-semibold text-[#073b4c]">Pristupni podaci</p>
                <p className="mt-2">
                  <strong>Privremena lozinka:</strong> {state.temporaryPassword}
                </p>
              </div>
            ) : null}

            <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
              <button
                className="min-h-0 w-full rounded-full border border-slate-200 bg-white px-5 py-3 text-xs font-bold uppercase tracking-[0.16em] text-slate-700 transition-all duration-200 hover:border-slate-300 hover:text-slate-900 sm:w-auto"
                onClick={onClose}
                type="button"
              >
                Zatvori
              </button>
              <button
                className="min-h-0 w-full rounded-full border border-teal-700 bg-teal-600 px-5 py-3 text-xs font-bold uppercase tracking-[0.16em] text-white shadow-[0_18px_36px_rgba(13,148,136,0.24)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-teal-700 hover:shadow-[0_22px_40px_rgba(13,148,136,0.3)] sm:w-auto"
                onClick={closeAndFocusTable}
                type="button"
              >
                Pogledaj u tabeli
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-[18px]">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1.5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-teal-700">
                  NOVA PROCJENA
                </p>
                <h2
                  className="font-headline text-[1.8rem] font-bold tracking-[-0.04em] text-slate-950"
                  id={titleId}
                >
                  Nova procjena kandidata
                </h2>
                <p className="text-sm leading-5 text-slate-600" id={descriptionId}>
                  Kandidat će odmah dobiti osnovnu bateriju testova nakon kreiranja.
                </p>
              </div>
              <button
                aria-label="Zatvori modal"
                className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-slate-500 shadow-none transition hover:border-slate-300 hover:bg-slate-100 hover:text-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/15"
                onClick={onClose}
                type="button"
              >
                <span className="text-[14px] font-semibold leading-none">×</span>
              </button>
            </div>

            <CreateAssessmentForm
              action={formAction}
              errorMessage={state.status === "error" ? state.message : null}
              onCancel={onClose}
              submitLabel="Kreiraj procjenu"
            />
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
