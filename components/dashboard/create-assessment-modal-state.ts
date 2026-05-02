export type CreateAssessmentModalState = {
  status: "idle" | "success" | "error";
  message?: string;
  participantName?: string;
  email?: string;
  temporaryPassword?: string;
  assignedTests?: string[];
};

export const INITIAL_CREATE_ASSESSMENT_MODAL_STATE: CreateAssessmentModalState = {
  status: "idle",
};
