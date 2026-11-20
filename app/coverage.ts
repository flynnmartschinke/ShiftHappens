export const assignments = [
  { worker: "Jo", role: "Grill", bit: 1 },
  { worker: "Rae", role: "Pass", bit: 2 },
  { worker: "Jo", role: "Pass", bit: 4 },
  { worker: "Rae", role: "Floor", bit: 8 },
  { worker: "Kit", role: "Floor", bit: 16 },
] as const;

export type Assignment = typeof assignments[number];
export type CoverWorker = Assignment["worker"];
export type CoverRole = Assignment["role"];
export type Stage = number;
export type ShiftAction = "report" | `assign-${Assignment["bit"]}` | `clear-${Assignment["bit"]}`;

export const roles: CoverRole[] = ["Grill", "Pass", "Floor"];
// Keep the previous assignment bits in the low five positions. Increment the
// high bits on each write so polling cannot undo a more recent roster update.
export const revisionStep = 32;
export const completed = 1 | 2 | 16;

export function validStage(value: unknown): value is Stage {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

export function assignmentMask(stage: Stage | null) {
  return stage && stage > 0 ? (stage - 1) % revisionStep : 0;
}

export function atStation(stage: Stage | null, role: CoverRole) {
  return assignments.find(item => item.role === role && (assignmentMask(stage) & item.bit));
}

export function assignedWorker(stage: Stage | null, worker: CoverWorker) {
  return assignments.find(item => item.worker === worker && (assignmentMask(stage) & item.bit));
}
