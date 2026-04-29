// Shared types (mirror server schema)
export type QuestionType = 'text' | 'url' | 'select' | 'confirm' | 'secret' | 'multiselect';

export interface QuestionCondition {
  id: string;
  equals: unknown;
}

export interface Question {
  id: string;
  type: QuestionType;
  label: string;
  help?: string;
  why?: string;
  required?: boolean;
  defaultValue?: unknown;
  options?: Array<{ value: string; label: string }>;
  validatePattern?: 'dataverseUrl';
  hideIf?: QuestionCondition | QuestionCondition[];
}

export interface StepMeta {
  number: number;
  title: string;
  description: string;
  canRunInBrowser: boolean;
  readOnly?: boolean;
  optional?: boolean;
  needsSecret?: boolean;
}

export interface StepInfo extends StepMeta {
  status: 'done' | 'current' | 'pending';
}

export interface StateSnapshot {
  state: Record<string, unknown>;
  completed: number;
  next: number;
  totalSteps: number;
}

export interface SystemInfo {
  os: { platform: string; release: string };
  node: string;
  git: string | null;
  dotnet: string | null;
  pac: string | null;
  op: boolean;
  rootDir: string;
  branch: string | null;
  repoIsClean: boolean;
}

export interface StepsList {
  totalSteps: number;
  completed: number;
  steps: StepInfo[];
}

export interface QuestionsResponse {
  meta: StepMeta;
  questions: Question[];
  state: Record<string, unknown>;
}

export interface ApplyResponse {
  runId: string;
}

export interface LogLine {
  stream: 'stdout' | 'stderr';
  text: string;
  ts: number;
}
