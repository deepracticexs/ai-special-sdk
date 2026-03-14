// --- Client ---
export { registerClient, autoRegister } from "./client";

// --- Sync APIs (with onProgress callback) ---
export { recruit } from "./recruit";
export { ingest, search } from "./structify";
export { match } from "./match";

// --- Async APIs (return taskId, non-blocking) ---
export {
  recruitAsync,
  ingestAsync,
  matchAsync,
  onTaskUpdate,
  getTask,
  getAllTasks,
  addCustomStep,
  completeCustomStep,
} from "./async";

// --- Types ---
export type {
  SwanConfig,
  RecruitInput,
  RecruitOutput,
  RecruitCopy,
  Platform,
  PositionType,
  ProgressEvent,
  OnProgress,
} from "./types";
export type {
  IngestInput,
  AuntieProfile,
  SearchResult,
} from "./structify";
export type {
  MatchResult,
  MatchOutput,
} from "./match";
export type {
  Task,
  TaskStep,
  TaskStatus,
  TaskListener,
} from "./task";
