/**
 * 异步任务包装器
 *
 * 把任何 API 调用包装成异步任务：
 * - 立即返回 taskId，不阻塞
 * - 通过 onTaskUpdate 监听实时进度
 * - 支持同时跑多个任务
 * - 固定步骤由 SDK 上报，前端可以通过 addCustomStep 加自定义步骤
 */

import {
  createTask,
  completeTask,
  failTask,
  startStep,
  completeStep,
  failStep,
  onTaskUpdate,
  getTask,
  getAllTasks,
  addCustomStep,
  completeCustomStep,
} from "./task";
import type { Task, TaskListener } from "./task";
import { recruit } from "./recruit";
import { ingest, search } from "./structify";
import { match } from "./match";
import type { RecruitInput, RecruitOutput } from "./types";
import type { IngestInput, AuntieProfile, SearchResult } from "./structify";
import type { MatchOutput } from "./match";

/**
 * 异步招募生成 — 立即返回 taskId
 *
 * 固定步骤：文案生成 → 提示词生成 → 海报生成
 * 前端可通过 addCustomStep 在任意时机插入自定义步骤
 */
export function recruitAsync(input: RecruitInput): string {
  const task = createTask<RecruitOutput>("recruit");

  // 异步执行，不阻塞
  recruit(input, (event) => {
    if (event.status === "running") {
      startStep(task.id, event.step, event.message);
    } else if (event.status === "done") {
      completeStep(task.id, event.step, event.message, event.data);
    } else if (event.status === "error") {
      failStep(task.id, event.step, event.message);
    } else if (event.status === "retry") {
      startStep(task.id, event.step, event.message);
    }
  }).then(
    (result) => completeTask(task.id, result),
    (err) => failTask(task.id, (err as Error).message),
  );

  return task.id;
}

/**
 * 异步数据导入 — 立即返回 taskId
 *
 * 固定步骤：数据处理 → 向量存储
 */
export function ingestAsync(inputs: IngestInput[]): string {
  const task = createTask<AuntieProfile[]>("ingest");

  ingest(inputs, (event) => {
    if (event.status === "running") {
      startStep(task.id, event.step, event.message);
    } else if (event.status === "done") {
      completeStep(task.id, event.step, event.message, event.data);
    } else if (event.status === "error") {
      failStep(task.id, event.step, event.message);
    }
  }).then(
    (result) => completeTask(task.id, result),
    (err) => failTask(task.id, (err as Error).message),
  );

  return task.id;
}

/**
 * 异步智能匹配 — 立即返回 taskId
 *
 * 固定步骤：候选搜索 → 智能评估
 */
export function matchAsync(query: string): string {
  const task = createTask<MatchOutput>("match");

  match(query, (event) => {
    if (event.status === "running") {
      startStep(task.id, event.step, event.message);
    } else if (event.status === "done") {
      completeStep(task.id, event.step, event.message, event.data);
    } else if (event.status === "error") {
      failStep(task.id, event.step, event.message);
    }
  }).then(
    (result) => completeTask(task.id, result),
    (err) => failTask(task.id, (err as Error).message),
  );

  return task.id;
}

// 重新导出任务管理函数，前端直接用
export {
  onTaskUpdate,
  getTask,
  getAllTasks,
  addCustomStep,
  completeCustomStep,
};
export type { Task, TaskListener };
