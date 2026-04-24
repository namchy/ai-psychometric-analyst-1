"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { SafranPracticeExample } from "@/lib/assessment/safran-practice";

type SafranPracticeExampleProps = {
  attemptId: string;
  example: SafranPracticeExample;
};

function getStorageKey(attemptId: string): string {
  return `safran-practice:${attemptId}`;
}

export function SafranPracticeExampleView({
  attemptId,
  example,
}: SafranPracticeExampleProps) {
  const router = useRouter();
  const [selectedOptionIndex, setSelectedOptionIndex] = useState<number | null>(null);

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
    <main className="candidate-intro stack-md mx-auto w-full max-w-5xl px-4">
      <section className="candidate-intro__hero card stack-sm">
        <div className="stack-xs">
          <p className="assessment-eyebrow">Practice primjeri</p>
          <h1>{example.title}</h1>
          <p className="candidate-intro__lead">{example.helperText}</p>
        </div>
      </section>

      <section className="candidate-intro__section card stack-sm">
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

        <ol className="assessment-options assessment-options--image">
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
      </section>

      <section className="candidate-intro__cta card stack-sm">
        <div className="dashboard-links">
          <button
            className="button-secondary"
            onClick={() => router.push(previousHref)}
            type="button"
          >
            Nazad
          </button>
          <button
            className="candidate-home__link"
            disabled={selectedOptionIndex === null}
            onClick={() => router.push(nextHref)}
            type="button"
          >
            {primaryLabel}
          </button>
        </div>
      </section>
    </main>
  );
}
