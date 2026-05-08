// Shared types (mirror server schema)
export type QuestionType = 'text' | 'url' | 'select' | 'confirm' | 'secret' | 'multiselect' | 'checkboxes';

export interface QuestionCondition {
  id: string;
  equals?: unknown;
  contains?: unknown;
}

export interface QuestionGroup {
  id: string;
  label: string;
  help?: string;
}

export interface DynamicOptionsSource {
  /** API endpoint to fetch options from, e.g. '/api/1password/items' */
  endpoint: string;
  /** Query parameter name to pass the dependency value as */
  param: string;
  /** ID of another question whose value drives this lookup */
  dependsOn: string;
  /** Property name in the response JSON that contains the options array */
  responseKey: string;
}

export interface Question {
  id: string;
  type: QuestionType;
  label: string;
  help?: string;
  why?: string;
  required?: boolean;
  defaultValue?: unknown;
  savedHint?: string;
  options?: Array<{ value: string; label: string }>;
  dynamicOptions?: DynamicOptionsSource;
  group?: QuestionGroup;
  validatePattern?: 'dataverseUrl';
  hideIf?: QuestionCondition | QuestionCondition[];
  showIf?: QuestionCondition | QuestionCondition[];
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
  powerApp?: {
    appId: string;
    targetEnv: string;
    environmentUrl: string;
    launchUrl: string;
  } | null;
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

export interface DeviceCode {
  code: string | null;
  url: string;
  ts: number;
}
