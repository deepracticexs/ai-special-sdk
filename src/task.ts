/**
 * 异步任务系统
 *
 * 每个 API 调用变成一个 Task，可以：
 * - 同时跑多个任务
 * - 实时监听每个任务的进度
 * - 查询任意任务的状态
 */

export type TaskStatus = "pending" | "running" | "done" | "error";

export interface TaskStep {
  name: string;
  status: TaskStatus;
  message: string;
  startedAt?: number;
  completedAt?: number;
  data?: Record<string, unknown>;
}

export interface Task<T = unknown> {
  id: string;
  type: string;
  status: TaskStatus;
  steps: TaskStep[];
  result: T | null;
  error: string | null;
  createdAt: number;
  completedAt: number | null;
}

export type TaskListener<T = unknown> = (task: Task<T>) => void;

// --- 全局任务管理 ---

const tasks = new Map<string, Task>();
const listeners = new Map<string, Set<TaskListener>>();

let taskCounter = 0;

/** 创建一个新任务 */
export function createTask<T>(type: string): Task<T> {
  const id = `task-${++taskCounter}-${Date.now()}`;
  const task: Task<T> = {
    id,
    type,
    status: "pending",
    steps: [],
    result: null,
    error: null,
    createdAt: Date.now(),
    completedAt: null,
  };
  tasks.set(id, task);
  return task;
}

/** 监听任务变化 */
export function onTaskUpdate<T>(taskId: string, listener: TaskListener<T>): () => void {
  if (!listeners.has(taskId)) {
    listeners.set(taskId, new Set());
  }
  listeners.get(taskId)!.add(listener as TaskListener);

  // 返回取消监听函数
  return () => {
    listeners.get(taskId)?.delete(listener as TaskListener);
  };
}

/** 获取任务 */
export function getTask<T>(taskId: string): Task<T> | undefined {
  return tasks.get(taskId) as Task<T> | undefined;
}

/** 获取所有任务 */
export function getAllTasks(): Task[] {
  return Array.from(tasks.values());
}

/** 通知监听器 */
function notifyListeners(taskId: string) {
  const task = tasks.get(taskId);
  if (!task) return;
  listeners.get(taskId)?.forEach((fn) => fn(task));
}

// --- 任务内部操作（给 SDK 内部用） ---

/** 开始一个步骤 */
export function startStep(taskId: string, name: string, message: string) {
  const task = tasks.get(taskId);
  if (!task) return;

  task.status = "running";

  // 查找已有的同名步骤或创建新的
  let step = task.steps.find((s) => s.name === name);
  if (!step) {
    step = { name, status: "running", message, startedAt: Date.now() };
    task.steps.push(step);
  } else {
    step.status = "running";
    step.message = message;
    step.startedAt = Date.now();
  }

  notifyListeners(taskId);
}

/** 完成一个步骤 */
export function completeStep(taskId: string, name: string, message: string, data?: Record<string, unknown>) {
  const task = tasks.get(taskId);
  if (!task) return;

  const step = task.steps.find((s) => s.name === name);
  if (step) {
    step.status = "done";
    step.message = message;
    step.completedAt = Date.now();
    step.data = data;
  }

  notifyListeners(taskId);
}

/** 步骤失败 */
export function failStep(taskId: string, name: string, message: string) {
  const task = tasks.get(taskId);
  if (!task) return;

  const step = task.steps.find((s) => s.name === name);
  if (step) {
    step.status = "error";
    step.message = message;
    step.completedAt = Date.now();
  }

  notifyListeners(taskId);
}

/** 添加自定义步骤（前端 AI 可以在任务中插入额外步骤） */
export function addCustomStep(taskId: string, name: string, message: string) {
  const task = tasks.get(taskId);
  if (!task) return;

  task.steps.push({ name, status: "running", message, startedAt: Date.now() });
  notifyListeners(taskId);
}

/** 完成自定义步骤 */
export function completeCustomStep(taskId: string, name: string, message: string, data?: Record<string, unknown>) {
  completeStep(taskId, name, message, data);
}

/** 任务整体完成 */
export function completeTask<T>(taskId: string, result: T) {
  const task = tasks.get(taskId);
  if (!task) return;

  task.status = "done";
  task.result = result;
  task.completedAt = Date.now();

  notifyListeners(taskId);
}

/** 任务整体失败 */
export function failTask(taskId: string, error: string) {
  const task = tasks.get(taskId);
  if (!task) return;

  task.status = "error";
  task.error = error;
  task.completedAt = Date.now();

  notifyListeners(taskId);
}
