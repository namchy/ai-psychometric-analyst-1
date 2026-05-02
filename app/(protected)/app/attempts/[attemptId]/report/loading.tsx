import { ReportGenerationLoadingScreen } from "@/components/assessment/report-generation-loading-screen";

export default function CandidateAttemptReportLoading() {
  return (
    <main className="attempt-results-page stack-md mx-auto w-full max-w-4xl px-4 sm:px-6 lg:px-8">
      <section className="attempt-results-page__content">
        <ReportGenerationLoadingScreen
          status="processing"
          testSlug={null}
          testName={null}
          participantName={null}
        />
      </section>
    </main>
  );
}
