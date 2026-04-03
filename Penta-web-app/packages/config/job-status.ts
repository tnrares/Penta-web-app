/**
 * Job pipeline rules (variant B for quote accept). Workers move IN_PROGRESS → READY_FOR_REVIEW;
 * managers finalize or send work back.
 */

export type JobStatus =
  | "PENDING_VISIT"
  | "QUOTE_SENT"
  | "QUOTE_ACCEPTED"
  | "IN_PROGRESS"
  | "READY_FOR_REVIEW"
  | "FINALIZED"
  | "CLOSED_PAID"
  | "CANCELED";

/** Ordered steps shown in the manager pipeline (excludes CANCELED). */
export const PIPELINE_STEP_KEYS = [
  "PENDING_VISIT",
  "QUOTE_SENT",
  "QUOTE_ACCEPTED",
  "IN_PROGRESS",
  "READY_FOR_REVIEW",
  "FINALIZED",
  "CLOSED_PAID",
] as const;

export type PipelineStepKey = (typeof PIPELINE_STEP_KEYS)[number];

export const PIPELINE_STEP_LABELS: Record<PipelineStepKey, string> = {
  PENDING_VISIT: "Site visit",
  QUOTE_SENT: "Quote sent",
  QUOTE_ACCEPTED: "Quote accepted",
  IN_PROGRESS: "Work in progress",
  READY_FOR_REVIEW: "Ready for review",
  FINALIZED: "Finalized",
  CLOSED_PAID: "Closed & paid",
};

/** Allowed manual PATCH transitions (manager). */
export const ALLOWED_STATUS_TRANSITIONS: Record<JobStatus, JobStatus[]> = {
  PENDING_VISIT: ["QUOTE_SENT", "CANCELED"],
  QUOTE_SENT: ["QUOTE_ACCEPTED", "IN_PROGRESS", "CANCELED"],
  QUOTE_ACCEPTED: ["IN_PROGRESS", "CANCELED"],
  IN_PROGRESS: ["READY_FOR_REVIEW", "FINALIZED", "CANCELED"],
  READY_FOR_REVIEW: ["FINALIZED", "IN_PROGRESS", "CANCELED"],
  FINALIZED: ["CLOSED_PAID", "CANCELED"],
  CLOSED_PAID: [],
  CANCELED: [],
};

/** Assigned worker may only move job here (from in progress). */
export const WORKER_ALLOWED_TO: JobStatus = "READY_FOR_REVIEW";

export function isTransitionAllowed(from: JobStatus, to: JobStatus): boolean {
  if (from === to) return true;
  return ALLOWED_STATUS_TRANSITIONS[from]?.includes(to) ?? false;
}

export function getAllowedNextStatuses(from: JobStatus): JobStatus[] {
  return [...(ALLOWED_STATUS_TRANSITIONS[from] ?? [])];
}

/** Whether an assigned worker may PATCH this transition. */
export function isWorkerTransitionAllowed(
  from: JobStatus,
  to: JobStatus
): boolean {
  return from === "IN_PROGRESS" && to === "READY_FOR_REVIEW";
}

export interface PipelineStepVisual {
  key: PipelineStepKey;
  label: string;
  completed: boolean;
  current: boolean;
  mergedSkipped?: boolean;
}

export function getPipelineStepsVisual(
  jobStatus: JobStatus,
  quote: { isAccepted?: boolean } | null | undefined
): PipelineStepVisual[] {
  if (jobStatus === "CANCELED") {
    return PIPELINE_STEP_KEYS.map((key) => ({
      key,
      label: PIPELINE_STEP_LABELS[key],
      completed: false,
      current: false,
    }));
  }

  if (jobStatus === "CLOSED_PAID") {
    return PIPELINE_STEP_KEYS.map((key) => ({
      key,
      label: PIPELINE_STEP_LABELS[key],
      completed: true,
      current: false,
    }));
  }

  const currentIdx = PIPELINE_STEP_KEYS.indexOf(jobStatus as PipelineStepKey);
  const idx = currentIdx >= 0 ? currentIdx : 0;
  const mergedAccept =
    jobStatus === "IN_PROGRESS" && quote?.isAccepted === true;

  return PIPELINE_STEP_KEYS.map((key, i) => {
    const completed =
      i < idx || (mergedAccept && key === "QUOTE_ACCEPTED");
    const current =
      jobStatus === key && !(mergedAccept && key === "QUOTE_ACCEPTED");
    return {
      key,
      label: PIPELINE_STEP_LABELS[key],
      completed,
      current,
      mergedSkipped: mergedAccept && key === "QUOTE_ACCEPTED" ? true : undefined,
    };
  });
}
