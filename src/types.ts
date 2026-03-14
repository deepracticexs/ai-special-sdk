// --- 通用 ---
export interface SwanConfig {
  apiKey: string;
  baseURL: string;
  model: string;
}

// --- 事件系统 ---
export type StepName = "文案生成" | "提示词生成" | "海报生成";
export type StepStatus = "running" | "done" | "error" | "retry";

export interface ProgressEvent {
  step: StepName;
  status: StepStatus;
  message: string;
  data?: Record<string, unknown>;
}

export type OnProgress = (event: ProgressEvent) => void;

// --- 方向一：招募内容生成 ---
export type Platform = "小红书" | "抖音" | "朋友圈" | "招聘网站" | "公众号";
export type PositionType = "月嫂" | "育儿嫂" | "保洁" | "保姆" | "护工" | "钟点工";

export interface RecruitInput {
  /** 岗位类型 */
  position: PositionType | string;
  /** 工作地区 */
  region: string;
  /** 薪资范围 */
  salary: string;
  /** 联系方式（电话或微信号） */
  contact: string;
  /** 目标平台 */
  platform: Platform | string;
  /** 自由补充需求 */
  extra?: string;
}

export interface RecruitCopy {
  title: string;
  content: string;
  hashtags: string[];
}

export interface RecruitOutput {
  copy: RecruitCopy | null;
  imagePrompt: string | null;
  imageUrl: string | null;
}

// --- 方向二：数据结构化 ---
export interface StructifyInput {
  data: string;
  images?: string[];
  schema?: Record<string, string>;
}

export interface StructifyOutput {
  profile: Record<string, unknown>;
  raw_extractions: string[];
}

// --- 方向三：智能匹配 ---
export interface MatchInput {
  query: string;
  candidates: Record<string, unknown>[];
}

export interface MatchResult {
  candidate: Record<string, unknown>;
  score: number;
  reason: string;
}

export interface MatchOutput {
  results: MatchResult[];
}
