import path from "node:path";
import { pathToFileURL } from "node:url";

const TEAM_DYNAMICS_ASSESSMENT_KEY = "team_dynamics_assessment_v1";
const TEAM_DYNAMICS_PACKAGE_DIR = path.resolve(
  process.cwd(),
  "assessment-packages",
  TEAM_DYNAMICS_ASSESSMENT_KEY,
);
const VALIDATE_ASSESSMENT_PACKAGE_MODULE_PATH = path.resolve(
  process.cwd(),
  "scripts",
  "validate-assessment-package.mjs",
);

let teamDynamicsExecutionShellSpecPromise = null;

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) {
    return value;
  }

  Object.freeze(value);

  for (const nestedValue of Object.values(value)) {
    deepFreeze(nestedValue);
  }

  return value;
}

async function loadTeamDynamicsPackageRuntime() {
  const { loadAssessmentPackage } = await import(
    pathToFileURL(VALIDATE_ASSESSMENT_PACKAGE_MODULE_PATH).href
  );

  return loadAssessmentPackage(TEAM_DYNAMICS_PACKAGE_DIR);
}

function normalizeTeamDynamicsExecutionShellSpec(teamDynamicsExecutionSpec) {
  return {
    assessmentKey: teamDynamicsExecutionSpec.assessmentKey,
    displayName: teamDynamicsExecutionSpec.displayName,
    estimatedDuration: teamDynamicsExecutionSpec.estimatedDuration,
    validationStatus: teamDynamicsExecutionSpec.metadata.validationStatus ?? null,
    shellMode: "read_only_execution_spec",
    units: teamDynamicsExecutionSpec.units,
    optionCatalogs: {
      likert_1_4_agreement: teamDynamicsExecutionSpec.optionCatalogs.likert_1_4_agreement,
    },
    metadata: {
      ...teamDynamicsExecutionSpec.metadata,
      supportsMixedFormat: true,
      supportsLikert: true,
      supportsSjtBestWorst: true,
      persistenceEnabled: false,
      scoringEnabled: false,
      reportEnabled: false,
    },
  };
}

export async function getTeamDynamicsExecutionShellSpec() {
  if (!teamDynamicsExecutionShellSpecPromise) {
    teamDynamicsExecutionShellSpecPromise = loadTeamDynamicsPackageRuntime().then((packageData) => {
      const { teamDynamicsExecutionSpec } = packageData;

      if (!teamDynamicsExecutionSpec) {
        throw new Error(
          "Team Dynamics execution shell spec is unavailable because teamDynamicsExecutionSpec could not be resolved.",
        );
      }

      if (teamDynamicsExecutionSpec.assessmentKey !== TEAM_DYNAMICS_ASSESSMENT_KEY) {
        throw new Error(
          `Expected Team Dynamics assessment key ${TEAM_DYNAMICS_ASSESSMENT_KEY}, received ${teamDynamicsExecutionSpec.assessmentKey}.`,
        );
      }

      return deepFreeze(normalizeTeamDynamicsExecutionShellSpec(teamDynamicsExecutionSpec));
    });
  }

  return teamDynamicsExecutionShellSpecPromise;
}
