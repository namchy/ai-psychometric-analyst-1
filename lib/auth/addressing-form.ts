export const ADDRESSING_FORMS = ["masculine", "feminine"] as const;

export type AddressingForm = (typeof ADDRESSING_FORMS)[number];

export function isAddressingForm(value: unknown): value is AddressingForm {
  return value === "masculine" || value === "feminine";
}

export function normalizeAddressingForm(value: unknown): AddressingForm | null {
  return isAddressingForm(value) ? value : null;
}

// Temporary fallback until the onboarding/pre-test modal makes this preference mandatory.
export function resolveAddressingForm(value: unknown): AddressingForm {
  return normalizeAddressingForm(value) ?? "masculine";
}
