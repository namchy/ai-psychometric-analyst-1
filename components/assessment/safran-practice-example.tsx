/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { SafranPracticeExample } from "@/lib/assessment/safran-practice";

type SafranPracticeExampleProps = {
  attemptId: string;
  example: SafranPracticeExample;
};

function SafranPracticeParityStyles() {
  return (
    <style jsx global>{`
      .assessment-run-page--dashboard-skin,
      .assessment-run-page--dashboard-skin :where(h1, h2, h3, h4, p, span, label, legend, button, input) {
        font-family: var(--font-sans);
      }

      .assessment-run-page--dashboard-skin .run-form-hero {
        width: 100%;
        position: relative;
        overflow: hidden;
        border: 1px solid rgba(203, 213, 225, 0.78);
        border-radius: 1.5rem;
        padding: 1.25rem;
        background: linear-gradient(145deg, rgba(255, 255, 255, 0.98), rgba(243, 249, 249, 0.97) 58%, rgba(246, 242, 255, 0.95));
        box-shadow: 0 20px 44px rgba(15, 23, 42, 0.08);
      }

      .assessment-run-page--dashboard-skin .run-form-hero::before {
        content: "";
        position: absolute;
        inset: 0;
        background: radial-gradient(circle, rgba(20, 184, 166, 0.16), transparent 65%);
        opacity: 1;
      }

      .assessment-run-page--dashboard-skin .run-form-hero__content {
        position: relative;
        z-index: 1;
      }

      .assessment-run-page--dashboard-skin .run-form-hero__intro {
        display: grid;
        gap: 1.25rem;
      }

      .assessment-run-page--dashboard-skin .run-form-hero__identity {
        max-width: 100%;
      }

      .assessment-run-page--dashboard-skin .run-form-hero__title-group {
        display: grid;
        gap: 0;
      }

      .assessment-run-page--dashboard-skin .run-form-hero__intro h1,
      .assessment-run-page--dashboard-skin .assessment-step-card__header h3 {
        font-family: var(--font-sans);
        color: rgb(2, 6, 23);
        letter-spacing: -0.05em;
      }

      .assessment-run-page--dashboard-skin .run-form-hero__top-line {
        pointer-events: none;
        position: absolute;
        inset-inline: 1.5rem;
        top: 0;
        height: 1px;
        background: linear-gradient(90deg, transparent, rgba(203, 213, 225, 0.8), transparent);
      }

      .assessment-run-page--dashboard-skin .run-form-hero__eyebrow {
        margin: 0;
        font-size: 11px;
        font-weight: 600;
        letter-spacing: 0.2em;
        text-transform: uppercase;
        color: rgba(17, 94, 89, 0.9);
      }

      .assessment-run-page--dashboard-skin .run-form-hero__intro h1 {
        margin: 0.55rem 0 0;
        max-width: 42rem;
        font-size: 1.75rem;
        font-weight: 780;
        line-height: 1.08;
        color: rgb(2, 6, 23);
      }

      .assessment-run-page--dashboard-skin .run-form-hero__participant {
        margin: 0.35rem 0 0;
        max-width: 42rem;
        font-size: 14px;
        line-height: 1.55;
        color: rgb(71, 85, 105);
      }

      .assessment-run-page--dashboard-skin .assessment-progress {
        border: 1px solid rgba(191, 219, 254, 0.7);
        border-radius: 1.25rem;
        padding: 1.1rem 1.25rem;
        background: linear-gradient(180deg, rgba(255, 255, 255, 0.88), rgba(240, 249, 255, 0.92));
        box-shadow:
          inset 0 1px 0 rgba(255, 255, 255, 0.78),
          0 18px 32px -28px rgba(15, 23, 42, 0.12);
      }

      .assessment-run-page--dashboard-skin .assessment-progress__metric-label,
      .assessment-run-page--dashboard-skin .assessment-step-card__kicker {
        color: rgb(13, 148, 136);
        letter-spacing: 0.18em;
        text-transform: uppercase;
      }

      .assessment-run-page--dashboard-skin .assessment-progress__metric-value {
        font-size: 1.05rem;
        font-weight: 700;
        line-height: 1.25;
        color: rgb(15, 23, 42);
      }

      .assessment-run-page--dashboard-skin .assessment-progress__track {
        height: 0.5rem;
        border-radius: 999px;
        overflow: hidden;
        background: linear-gradient(180deg, rgba(203, 213, 225, 0.95), rgba(226, 232, 240, 0.98));
        box-shadow: inset 0 1px 2px rgba(148, 163, 184, 0.18);
      }

      .assessment-run-page--dashboard-skin .assessment-progress__fill {
        height: 100%;
        background: linear-gradient(90deg, #06d6a0, rgba(6, 214, 160, 0.84));
        box-shadow: 0 4px 10px -6px rgba(6, 214, 160, 0.42);
      }

      .assessment-run-page--dashboard-skin .assessment-step-card {
        width: 100%;
        border: 1px solid rgba(203, 213, 225, 0.86);
        border-radius: 1.5rem;
        padding: 1.5rem;
        background: linear-gradient(180deg, rgba(255, 255, 255, 0.99), rgba(248, 250, 252, 0.98));
        box-shadow:
          0 24px 56px rgba(15, 23, 42, 0.08),
          inset 0 1px 0 rgba(255, 255, 255, 0.82);
      }

      .assessment-run-page--dashboard-skin .assessment-step-card__header {
        margin-bottom: 0.65rem;
      }

      .assessment-run-page--dashboard-skin .assessment-step-card__question-region {
        gap: 0.55rem;
        max-width: 52rem;
      }

      .assessment-run-page--dashboard-skin .assessment-step-card__question-region--visual {
        width: 100%;
        max-width: 100%;
        margin-inline: auto;
        align-items: center;
      }

      .assessment-run-page--dashboard-skin .assessment-step-card__header h3 {
        font-size: clamp(1.1rem, 1.8vw, 1.46rem);
        font-weight: 600;
        line-height: 1.18;
        text-wrap: pretty;
        max-width: 100%;
      }

      .assessment-run-page--dashboard-skin .assessment-step-card__fieldset {
        padding-top: 0.15rem;
      }

      .assessment-run-page--dashboard-skin .assessment-option {
        min-height: 4rem;
        border-color: rgba(203, 213, 225, 0.86);
        border-radius: 1.125rem;
        padding: 0.9rem 1.1rem;
        background: linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(248, 250, 252, 0.98));
        box-shadow:
          inset 0 1px 0 rgba(255, 255, 255, 0.76),
          0 16px 28px -26px rgba(15, 23, 42, 0.12);
      }

      .assessment-run-page--dashboard-skin .assessment-option:hover {
        border-color: rgba(17, 138, 178, 0.34);
        background: linear-gradient(180deg, rgba(255, 255, 255, 1), rgba(241, 248, 251, 0.94));
        box-shadow:
          inset 0 1px 0 rgba(255, 255, 255, 0.82),
          0 14px 24px -24px rgba(17, 138, 178, 0.12);
      }

      .assessment-run-page--dashboard-skin .assessment-option--selected {
        border-color: rgba(17, 138, 178, 0.55);
        background: linear-gradient(180deg, rgba(241, 248, 251, 0.98), rgba(232, 243, 248, 0.78));
        box-shadow:
          inset 0 1px 0 rgba(255, 255, 255, 0.82),
          0 14px 24px -24px rgba(17, 138, 178, 0.14),
          0 0 0 1px rgba(17, 138, 178, 0.1);
      }

      .assessment-run-page--dashboard-skin .assessment-options {
        gap: 0.65rem;
      }

      .assessment-run-page--dashboard-skin .assessment-stimulus-images {
        display: grid;
        place-items: center;
        gap: 0.5rem;
        margin: 0.35rem auto 0;
        width: 100%;
        max-width: 46rem;
      }

      .assessment-run-page--dashboard-skin .assessment-stimulus-images__image,
      .assessment-run-page--dashboard-skin .assessment-option__image {
        display: block;
        width: 100%;
        height: auto;
        border: 1px solid rgb(226, 232, 240);
        border-radius: 0.75rem;
        background: rgb(255, 255, 255);
        object-fit: contain;
      }

      .assessment-run-page--dashboard-skin .assessment-stimulus-images__image {
        justify-self: center;
        margin-inline: auto;
        max-height: 13.25rem;
        max-width: 100%;
      }

      .assessment-run-page--dashboard-skin .assessment-options--image {
        grid-template-columns: repeat(auto-fit, minmax(10.5rem, 1fr));
        gap: 0.65rem;
        align-items: stretch;
        margin-top: 0.45rem;
      }

      .assessment-run-page--dashboard-skin .assessment-options--image > li {
        min-width: 0;
      }

      .assessment-run-page--dashboard-skin .assessment-options--image .assessment-option {
        display: grid;
        grid-template-columns: 1fr;
        align-items: stretch;
        min-height: 7.25rem;
        height: 100%;
        padding: 0.55rem;
        overflow: hidden;
        border-radius: 1rem;
      }

      .assessment-run-page--dashboard-skin .assessment-options--image .assessment-option input {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        margin: 0;
        opacity: 0;
        cursor: pointer;
      }

      .assessment-run-page--dashboard-skin .assessment-options--image .assessment-option__marker {
        position: absolute;
        top: 0.45rem;
        left: 0.45rem;
        z-index: 1;
        min-width: 1.55rem;
        min-height: 1.55rem;
        font-size: 0.72rem;
        box-shadow: 0 8px 18px -14px rgba(15, 23, 42, 0.5);
      }

      .assessment-run-page--dashboard-skin .assessment-options--image .assessment-option__content {
        display: grid;
        place-items: center;
        min-width: 0;
        height: 100%;
      }

      .assessment-run-page--dashboard-skin .assessment-options--image .assessment-option__image {
        height: 5.8rem;
        max-height: none;
        padding: 0.35rem;
      }

      .assessment-run-page--dashboard-skin .assessment-options--image-count-5 {
        grid-template-columns: repeat(5, minmax(0, 1fr));
      }

      .assessment-run-page--dashboard-skin .assessment-options--image-count-6 {
        grid-template-columns: repeat(6, minmax(0, 1fr));
        gap: 0.5rem;
      }

      .assessment-run-page--dashboard-skin .assessment-options--image-count-6 .assessment-option {
        min-height: 6.35rem;
        padding: 0.42rem;
        border-radius: 0.9rem;
      }

      .assessment-run-page--dashboard-skin .assessment-options--image-count-6 .assessment-option__image {
        height: 4.95rem;
        padding: 0.28rem;
      }

      .assessment-run-page--dashboard-skin .assessment-options--image-count-6 .assessment-option__marker {
        top: 0.35rem;
        left: 0.35rem;
        min-width: 1.42rem;
        min-height: 1.42rem;
        font-size: 0.68rem;
      }

      .assessment-run-page--dashboard-skin .assessment-step-actions__button--ghost,
      .assessment-run-page--dashboard-skin .assessment-step-actions__button--save {
        border-color: rgba(203, 213, 225, 0.9);
        background: rgba(255, 255, 255, 0.94);
        color: rgb(51, 65, 85);
        box-shadow: 0 14px 28px -24px rgba(15, 23, 42, 0.12);
      }

      .assessment-run-page--dashboard-skin .assessment-step-actions__button--primary {
        border-color: rgb(15, 118, 110);
        background: rgb(13, 148, 136);
        color: white;
        box-shadow: 0 18px 34px -20px rgba(13, 148, 136, 0.36);
      }

      .assessment-run-page--dashboard-skin .assessment-step-actions__button--primary:hover:not(:disabled) {
        background: rgb(15, 118, 110);
      }

      .assessment-run-page--dashboard-skin .assessment-step-layout__actions-row {
        width: min(100%, 1040px);
        margin: 0 auto;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 1rem;
      }

      .assessment-run-page--dashboard-skin .assessment-step-layout__actions-primary {
        flex: 1 1 auto;
      }

      .assessment-run-page--dashboard-skin .assessment-step-layout__footer {
        position: fixed;
        right: 0;
        bottom: 0;
        left: 0;
        z-index: 60;
        width: 100%;
        margin: 0;
        padding: 0.75rem 1rem 0.85rem;
        background: linear-gradient(
          180deg,
          rgba(248, 250, 252, 0),
          rgba(248, 250, 252, 0.92) 28%,
          rgba(248, 250, 252, 0.98)
        );
        backdrop-filter: blur(10px);
      }

      .assessment-run-page--dashboard-skin .assessment-step-layout {
        padding-bottom: 6.25rem;
      }

      @media (max-width: 760px) {
        .assessment-run-page--dashboard-skin .assessment-options--image,
        .assessment-run-page--dashboard-skin .assessment-options--image-count-5,
        .assessment-run-page--dashboard-skin .assessment-options--image-count-6 {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }

        .assessment-run-page--dashboard-skin .assessment-stimulus-images__image {
          max-height: 11rem;
        }
      }

      @media (min-width: 761px) and (max-width: 1180px) {
        .assessment-run-page--dashboard-skin .assessment-options--image,
        .assessment-run-page--dashboard-skin .assessment-options--image-count-5,
        .assessment-run-page--dashboard-skin .assessment-options--image-count-6 {
          grid-template-columns: repeat(3, minmax(0, 1fr));
        }
      }

      @media (min-width: 1024px) {
        .assessment-run-page--dashboard-skin .run-form-hero__intro {
          grid-template-columns: minmax(0, 1fr) minmax(280px, 320px);
          gap: 1.25rem;
          align-items: start;
        }
      }

      @media (max-width: 720px) {
        .assessment-run-page--dashboard-skin .assessment-step-layout__actions-row {
          flex-direction: column;
          align-items: stretch;
        }
      }
    `}</style>
  );
}

function getStorageKey(attemptId: string): string {
  return `safran-practice:${attemptId}`;
}

export function SafranPracticeExampleView({
  attemptId,
  example,
}: SafranPracticeExampleProps) {
  const router = useRouter();
  const [selectedOptionIndex, setSelectedOptionIndex] = useState<number | null>(null);
  const imageOptionsCountClassName = ` assessment-options--image-count-${example.optionImagePaths.length}`;
  const progressPercent = (example.index / 4) * 100;

  const previousHref =
    example.index === 1
      ? `/app/attempts/${attemptId}/practice`
      : `/app/attempts/${attemptId}/practice/${example.index - 1}`;
  const nextHref =
    example.index === 4
      ? `/app/attempts/${attemptId}/pre-test`
      : `/app/attempts/${attemptId}/practice/${example.index + 1}`;
  const primaryLabel = example.index === 4 ? "Završi primjere" : "Dalje";
  const storageKey = useMemo(() => getStorageKey(attemptId), [attemptId]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const rawValue = window.sessionStorage.getItem(storageKey);

    if (!rawValue) {
      return;
    }

    try {
      const parsed = JSON.parse(rawValue) as Record<string, number | null>;
      const storedValue = parsed[String(example.index)];
      setSelectedOptionIndex(Number.isInteger(storedValue) ? Number(storedValue) : null);
    } catch {
      setSelectedOptionIndex(null);
    }
  }, [example.index, storageKey]);

  function persistSelection(nextValue: number) {
    setSelectedOptionIndex(nextValue);

    if (typeof window === "undefined") {
      return;
    }

    let currentState: Record<string, number | null> = {};

    try {
      const rawValue = window.sessionStorage.getItem(storageKey);
      currentState = rawValue ? (JSON.parse(rawValue) as Record<string, number | null>) : {};
    } catch {
      currentState = {};
    }

    currentState[String(example.index)] = nextValue;
    window.sessionStorage.setItem(storageKey, JSON.stringify(currentState));
  }

  return (
    <div className="run-form-layout assessment-run-page--dashboard-skin assessment-step-density--visual mx-auto grid w-full max-w-[1040px] gap-4">
      <SafranPracticeParityStyles />

      <section className="run-form-hero">
        <div aria-hidden="true" className="run-form-hero__top-line" />
        <div className="run-form-hero__content">
          <div className="run-form-hero__intro">
            <div className="run-form-hero__identity">
              <div className="run-form-hero__title-group">
                <p className="run-form-hero__eyebrow">Practice primjeri</p>
                <h1>{example.title}</h1>
                <p className="run-form-hero__participant">{example.helperText}</p>
              </div>
            </div>

            <div className="assessment-progress" aria-label="Trenutni napredak">
              <div className="assessment-progress__summary" aria-label="Trenutni napredak">
                <div className="assessment-progress__metric">
                  <span className="assessment-progress__metric-label">Progres</span>
                  <p className="assessment-progress__metric-value">
                    Primjer {example.index} od 4
                  </p>
                </div>
              </div>

              <div className="assessment-progress__bar-region">
                <div aria-hidden="true" className="assessment-progress__track">
                  <div className="assessment-progress__fill" style={{ width: `${progressPercent}%` }} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="assessment-step-layout">
        <section className="assessment-step-card">
          <div className="assessment-step-card__header">
            <div className="assessment-step-card__question-region assessment-step-card__question-region--visual">
              <p className="assessment-step-card__kicker">Primjer {example.index}</p>
              <h3>{example.helperText}</h3>
              <div className="assessment-stimulus-images">
                <img
                  alt="Practice stimulus"
                  className="assessment-stimulus-images__image"
                  src={example.stimulusImagePath}
                />
                {example.stimulusSecondaryImagePath ? (
                  <img
                    alt="Dodatni practice stimulus"
                    className="assessment-stimulus-images__image"
                    src={example.stimulusSecondaryImagePath}
                  />
                ) : null}
              </div>
            </div>
          </div>

          <fieldset className="assessment-step-card__fieldset">
            <legend className="sr-only">{example.title}</legend>

            <ol className={`assessment-options assessment-options--image${imageOptionsCountClassName}`}>
              {example.optionImagePaths.map((optionImagePath, index) => {
                const isSelected = selectedOptionIndex === index;
                const inputId = `practice-${example.index}-option-${index + 1}`;

                return (
                  <li key={optionImagePath}>
                    <label
                      className={`assessment-option${isSelected ? " assessment-option--selected" : ""}`}
                      htmlFor={inputId}
                    >
                      <input
                        id={inputId}
                        type="radio"
                        name={`practice-${example.index}`}
                        checked={isSelected}
                        onChange={() => {
                          persistSelection(index);
                        }}
                      />
                      <span className="assessment-option__marker">{index + 1}</span>
                      <span className="assessment-option__content">
                        <img
                          alt={`Opcija ${index + 1}`}
                          className="assessment-option__image"
                          src={optionImagePath}
                        />
                      </span>
                    </label>
                  </li>
                );
              })}
            </ol>
          </fieldset>
        </section>

        <div className="assessment-step-layout__footer">
          <div className="assessment-step-layout__actions-row">
            <div className="assessment-step-layout__actions-primary assessment-step-actions assessment-step-actions--compact">
              <button
                className="assessment-step-actions__button assessment-step-actions__button--ghost"
                onClick={() => router.push(previousHref)}
                type="button"
              >
                Nazad
              </button>
              <button
                className="assessment-step-actions__button assessment-step-actions__button--primary"
                disabled={selectedOptionIndex === null}
                onClick={() => router.push(nextHref)}
                type="button"
              >
                {primaryLabel}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
