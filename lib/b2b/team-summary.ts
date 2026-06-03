export type TeamSummaryActiveAssessment = {
  assignmentId: string;
  status: "active";
  openedAt: string | null;
  updatedAt: string;
  invitedCount: number;
  completedCount: number;
};

export type TeamSummary = {
  teamId: string;
  name: string;
  description: string | null;
  activeMemberCount: number;
  createdAt: string;
  updatedAt: string;
  activeAssessment: TeamSummaryActiveAssessment | null;
};
