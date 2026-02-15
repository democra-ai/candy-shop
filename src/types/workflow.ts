// Workflow/Visual Editor Types
// Based on Refly's node-based workflow builder

export type WorkflowNodeType =
  | 'trigger'      // Entry point for the workflow
  | 'llm'          // LLM processing node
  | 'web-search'    // Web search tool
  | 'api-call'      // HTTP API request
  | 'code'          // Code execution
  | 'output'        // Output/result node
  | 'condition'     // Conditional branching
  | 'loop'          // Iteration logic
  | 'transform'     // Data transformation
  | 'tool'          // Generic tool node
  | 'input';        // User input node

export interface WorkflowNode {
  id: string;
  type: WorkflowNodeType;
  position: { x: number; y: number };
  config: NodeConfig;
  label?: string;
  icon?: string;
}

export type NodeConfig =
  | TriggerNodeConfig
  | LLMNodeConfig
  | WebSearchNodeConfig
  | APICallNodeConfig
  | CodeNodeConfig
  | OutputNodeConfig
  | ConditionNodeConfig
  | LoopNodeConfig
  | TransformNodeConfig
  | ToolNodeConfig
  | InputNodeConfig;

// Trigger Node - Workflow entry point
export interface TriggerNodeConfig {
  triggerType: 'manual' | 'webhook' | 'schedule' | 'event';
  webhookConfig?: {
    url?: string;
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
    headers?: Record<string, string>;
  };
  scheduleConfig?: {
    cron: string;
    timezone?: string;
  };
  eventConfig?: {
    eventType: string;
    source: string;
  };
}

// LLM Node - Language model processing
export interface LLMNodeConfig {
  modelProvider: 'openai' | 'anthropic' | 'google' | 'custom';
  modelId: string;
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  inputs: Record<string, string>; // Mapping from previous nodes
  outputSchema?: Record<string, string>;
}

// Web Search Node
export interface WebSearchNodeConfig {
  searchEngine: 'google' | 'bing' | 'duckduckgo' | 'tavily';
  query: string; // Can reference outputs from previous nodes: {{nodeId.field}}
  maxResults?: number;
  extractContent?: boolean;
}

// API Call Node
export interface APICallNodeConfig {
  url: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  headers?: Record<string, string>;
  body?: any;
  authentication?: {
    type: 'none' | 'bearer' | 'basic' | 'api-key';
    token?: string;
    username?: string;
    password?: string;
    apiKey?: string;
    headerName?: string;
  };
}

// Code Execution Node
export interface CodeNodeConfig {
  language: 'javascript' | 'python' | 'typescript';
  code: string;
  inputs: Record<string, string>;
  timeout?: number;
}

// Output Node
export interface OutputNodeConfig {
  outputFormat: 'text' | 'json' | 'markdown' | 'html';
  template?: string;
  includeMetadata?: boolean;
}

// Condition/Branch Node
export interface ConditionNodeConfig {
  conditions: Condition[];
  defaultBranch?: string; // node ID
}

export interface Condition {
  expression: string; // JavaScript expression
  targetNodeId: string;
  label?: string;
}

// Loop Node
export interface LoopNodeConfig {
  iterateOver: string; // Reference to array output from previous node
  loopVariable: string;
  maxIterations?: number;
}

// Transform Node
export interface TransformNodeConfig {
  transformation: 'map' | 'filter' | 'reduce' | 'custom';
  customCode?: string;
  mapping?: Record<string, string>; // For simple field mapping
}

// Tool Node - Generic/custom tool
export interface ToolNodeConfig {
  toolId: string;
  toolName: string;
  parameters: Record<string, unknown>;
}

// Input Node - Collect user input during execution
export interface InputNodeConfig {
  inputType: 'text' | 'file' | 'choice' | 'multi-choice';
  prompt: string;
  placeholder?: string;
  required?: boolean;
  options?: string[]; // For choice inputs
}

// Connection between nodes
export interface WorkflowConnection {
  id: string;
  sourceNodeId: string;
  sourcePort?: string; // For nodes with multiple outputs
  targetNodeId: string;
  targetPort?: string; // For nodes with multiple inputs
  label?: string;
}

// Complete Workflow Definition
export interface Workflow {
  id: string;
  name: string;
  description?: string;
  category: string;
  version: number;
  nodes: WorkflowNode[];
  connections: WorkflowConnection[];
  variables: WorkflowVariable[];
  settings: WorkflowSettings;
  metadata: WorkflowMetadata;
}

export interface WorkflowVariable {
  name: string;
  defaultValue?: unknown;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  description?: string;
  isSecret?: boolean;
}

export interface WorkflowSettings {
  timeout?: number; // Max execution time in seconds
  retryPolicy?: {
    maxRetries: number;
    backoffMultiplier: number;
  };
  errorHandling?: 'stop' | 'continue' | 'retry';
}

export interface WorkflowMetadata {
  createdAt?: Date;
  updatedAt?: Date;
  lastExecutedAt?: Date;
  executionCount: number;
  tags: string[];
  author?: string;
}

// Workflow Execution State
export interface WorkflowExecution {
  id: string;
  workflowId: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'paused';
  startedAt: Date;
  completedAt?: Date;
  currentNodeId?: string;
  nodeStates: Record<string, NodeExecutionState>;
  variables: Record<string, unknown>;
  result?: unknown;
  error?: string;
}

export interface NodeExecutionState {
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  startedAt?: Date;
  completedAt?: Date;
  input?: unknown;
  output?: unknown;
  error?: string;
}

// Workflow execution result
export interface WorkflowExecutionResult {
  executionId: string;
  workflowId: string;
  status: 'success' | 'error';
  result: unknown;
  outputs: Record<string, unknown>;
  duration: number;
  nodeResults: Record<string, NodeExecutionState>;
  executedAt: Date;
}
