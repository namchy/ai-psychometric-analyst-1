"use client";

import { useEffect, useId, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { saveParticipantAddressingForm } from "@/app/actions/participants";
import type { AddressingForm } from "@/lib/auth/addressing-form";

const ADDRESSING_FORM_OPTIONS: Array<{
  value: AddressingForm;
  label: string;
}> = [
  { value: "masculine", label: "Muški oblik" },
  { value: "feminine", label: "Ženski oblik" },
];

export function AddressingFormSelectionModal() {
  const [isMounted, setIsMounted] = useState(false);
  const [selectedValue, setSelectedValue] = useState<AddressingForm | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const titleId = useId();
  const descriptionId = useId();
  const router = useRouter();

  useEffect(() => {
    setIsMounted(true);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  function handleSave() {
    if (!selectedValue) {
      setErrorMessage("Odaberi oblik obraćanja prije spremanja.");
      return;
    }

    setErrorMessage(null);

    startTransition(async () => {
      const result = await saveParticipantAddressingForm(selectedValue);

      if (!result.ok) {
        setErrorMessage(result.message);
        return;
      }

      router.refresh();
    });
  }

  if (!isMounted) {
    return null;
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-[rgba(7,59,76,0.22)] p-4 backdrop-blur-md"
      data-modal-layer="overlay"
    >
      <div
        aria-describedby={descriptionId}
        aria-labelledby={titleId}
        aria-modal="true"
        className="relative z-[10000] w-[calc(100%-32px)] max-w-[560px] overflow-hidden rounded-[28px] px-8 py-7"
        data-modal-layer="card"
        style={{
          background: "rgba(255, 255, 255, 0.97)",
          border: "1px solid rgba(255, 255, 255, 0.78)",
          boxShadow: "0 28px 80px rgba(7, 59, 76, 0.20)",
        }}
        role="dialog"
      >
        <div className="space-y-6">
          <div className="space-y-1.5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-teal-700">
              PODEŠAVANJE PROFILA
            </p>
            <h2
              className="font-headline text-[1.8rem] font-bold tracking-[-0.04em] text-slate-950"
              id={titleId}
            >
              Odaberi oblik obraćanja
            </h2>
            <p className="text-sm leading-6 text-slate-600" id={descriptionId}>
              Ovaj izbor koristimo samo da pitanja i izvještaji zvuče prirodnije. Ne utiče na
              rezultat procjene.
            </p>
          </div>

          <div className="grid gap-3">
            {ADDRESSING_FORM_OPTIONS.map((option) => {
              const isSelected = selectedValue === option.value;

              return (
                <button
                  aria-pressed={isSelected}
                  className={`min-h-0 rounded-[20px] border px-4 py-4 text-left transition-all duration-200 ${
                    isSelected
                      ? "border-teal-500 bg-teal-50/80 shadow-[0_14px_28px_rgba(13,148,136,0.14)]"
                      : "border-slate-200 bg-white/85 hover:border-slate-300 hover:bg-slate-50"
                  }`}
                  key={option.value}
                  onClick={() => {
                    setSelectedValue(option.value);
                    setErrorMessage(null);
                  }}
                  type="button"
                >
                  <span className="block text-sm font-semibold text-slate-900">{option.label}</span>
                </button>
              );
            })}
          </div>

          {errorMessage ? (
            <p className="text-sm font-medium text-rose-700" role="alert">
              {errorMessage}
            </p>
          ) : null}

          <div className="flex justify-end">
            <button
              className="min-h-0 rounded-full border border-teal-700 bg-teal-600 px-5 py-3 text-xs font-bold uppercase tracking-[0.16em] text-white shadow-[0_18px_36px_rgba(13,148,136,0.24)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-teal-700 hover:shadow-[0_22px_40px_rgba(13,148,136,0.3)] disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-70"
              disabled={isPending}
              onClick={handleSave}
              type="button"
            >
              {isPending ? "Čuvam..." : "Sačuvaj izbor"}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
