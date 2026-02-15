// Execute workflows using OpenCode SDK
import type {
  Workflow,
  WorkflowExecution,
  WorkflowExecutionResult,
  WorkflowNode,
  NodeExecutionState,
} from '../types/workflow';
import type { OpenCodeClient } from '../lib/opencode-client';

export interface WorkflowExecutionOptions {
  onNodeStart?: (nodeId: string) => void;
  onNodeComplete?: (nodeId: string, result: unknown) => void;
  onNodeError?: (nodeId: string, error: string) => void;
  onProgress?: (execution: WorkflowExecution) => void;
}

// Execute a workflow using OpenCode
export async function executeWorkflow(
  workflow: Workflow,
  opencode: OpenCodeClient,
  sessionId: string,
  options: WorkflowExecutionOptions = {}
): Promise<WorkflowExecutionResult> {
  const startTime = Date.now();
  const nodeStates: Record<string, NodeExecutionState> = {};
  const nodeOutputs: Record<string, unknown> = {};
  const nodeErrors: Record<string, string> = {};

  // Initialize node states
  for (const node of workflow.nodes) {
    nodeStates[node.id] = { status: 'pending' };
  }

  const execution: WorkflowExecution = {
    id: `exec-${Date.now()}`,
    workflowId: workflow.id,
    status: 'running',
    startedAt: new Date(),
    nodeStates,
    variables: {},
  };

  options.onProgress?.(execution);

  try {
    // Find trigger node or start from first node
    const startNodes = workflow.nodes.filter((n) => n.type === 'trigger');
    const startNode = startNodes[0] || workflow.nodes[0];

    if (!startNode) {
      throw new Error('No nodes found in workflow');
    }

    // Execute nodes in topological order
    const executionOrder = getExecutionOrder(workflow, startNode.id);

    for (const nodeId of executionOrder) {
      const node = workflow.nodes.find((n) => n.id === nodeId);
      if (!node) continue;

      options.onNodeStart?.(nodeId);
      nodeStates[nodeId] = { status: 'running', startedAt: new Date() };

      try {
        const input = prepareNodeInput(node, nodeOutputs);
        const output = await executeNode(node, input, opencode, sessionId, nodeOutputs);

        nodeOutputs[nodeId] = output;
        nodeStates[nodeId] = {
          status: 'completed',
          startedAt: nodeStates[nodeId].startedAt,
          completedAt: new Date(),
          input,
          output,
        };

        options.onNodeComplete?.(nodeId, output);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        nodeErrors[nodeId] = errorMessage;
        nodeStates[nodeId] = {
          status: 'failed',
          startedAt: nodeStates[nodeId].startedAt,
          completedAt: new Date(),
          error: errorMessage,
        };

        options.onNodeError?.(nodeId, errorMessage);

        // Handle error based on workflow settings
        if (workflow.settings.errorHandling === 'stop') {
          throw new Error(`Node ${nodeId} failed: ${errorMessage}`);
        }
        // If 'continue' or 'retry', we proceed to next node
      }

      options.onProgress?.(execution);
    }

    // Get final output from last node
    const lastNode = executionOrder[executionOrder.length - 1];
    const finalOutput = nodeOutputs[lastNode];

    const duration = Date.now() - startTime;

    return {
      executionId: execution.id,
      workflowId: workflow.id,
      status: 'success',
      result: finalOutput,
      outputs: nodeOutputs,
      duration,
      nodeResults: nodeStates,
      executedAt: new Date(),
    };
  } catch (error) {
    // const errorMessage = error instanceof Error ? error.message : String(error);

    return {
      executionId: execution.id,
      workflowId: workflow.id,
      status: 'error',
      result: null,
      outputs: nodeOutputs,
      duration: Date.now() - startTime,
      nodeResults: nodeStates,
      executedAt: new Date(),
    };
  }
}

// Get execution order (topological sort based on connections)
function getExecutionOrder(workflow: Workflow, startNodeId: string): string[] {
  const order: string[] = [];
  const visited = new Set<string>();
  const visiting = new Set<string>();

  function visit(nodeId: string) {
    if (visited.has(nodeId)) return;
    if (visiting.has(nodeId)) return; // Cycle detected

    visiting.add(nodeId);

    // Get connected nodes (targets of outgoing connections)
    const outgoing = workflow.connections
      .filter((c) => c.sourceNodeId === nodeId)
      .map((c) => c.targetNodeId);

    for (const targetId of outgoing) {
      visit(targetId);
    }

    visiting.delete(nodeId);
    visited.add(nodeId);
    order.push(nodeId);
  }

  visit(startNodeId);

  // Add any remaining nodes not reachable from start
  for (const node of workflow.nodes) {
    if (!visited.has(node.id)) {
      order.push(node.id);
    }
  }

  return order;
}

// Prepare input for a node based on previous outputs
function prepareNodeInput(
  _node: WorkflowNode,
  nodeOutputs: Record<string, unknown>
): unknown {
  // Using node and nodeOutputs significantly to avoid unused errors
  // For now, we'll use a simple approach - all outputs from previous nodes
  // console.log('Preparing input for node', node.id, nodeOutputs);
  return nodeOutputs;
}

// Execute a single node
async function executeNode(
  node: WorkflowNode,
  input: unknown,
  opencode: OpenCodeClient,
  sessionId: string,
  context: Record<string, unknown>
): Promise<unknown> {
  switch (node.type) {
    case 'llm':
      return executeLLMNode(node, input, opencode, sessionId);

    case 'web-search':
      return executeWebSearchNode(node, input);

    case 'api-call':
      return executeAPICallNode(node, input);

    case 'code':
      return executeCodeNode(node, input);

    case 'output':
      return executeOutputNode(node, input, context);

    case 'condition':
      return executeConditionNode(node, input);

    case 'loop':
      return executeLoopNode(node, input);

    case 'transform':
      return executeTransformNode(node, input);

    case 'tool':
      return executeToolNode(node, input);

    case 'input':
      return executeInputNode(node, input);

    case 'trigger':
      return executeTriggerNode(node);

    default:
      return input;
  }
}

// Execute LLM node
async function executeLLMNode(
  node: WorkflowNode,
  input: unknown,
  opencode: OpenCodeClient,
  _sessionId: string
): Promise<unknown> {
  const config = node.config as any;

  // Build prompt from system prompt and input
  const prompt = config.systemPrompt
    ? `${config.systemPrompt}\n\nInput: ${JSON.stringify(input)}`
    : JSON.stringify(input);

  // Create a temporary session for this node execution
  // In production, you'd want to reuse the main session
  const tempSessionId = await opencode.createSession(`LLM Node: ${node.label || node.id}`);

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('LLM node execution timeout'));
    }, 60000); // 60 second timeout

    opencode
      .sendMessage(tempSessionId.id, prompt, {
        onPartUpdated: () => {},
        onMessageUpdated: () => {},
        onSessionStatus: () => {},
        onComplete: () => {
          clearTimeout(timeout);
          resolve({ success: true, message: 'LLM processing complete' });
        },
        onError: (error: any) => {
          clearTimeout(timeout);
          reject(new Error(String(error)));
        },
      })
      .catch(reject);
  });
}

// Execute Web Search node
async function executeWebSearchNode(
  node: WorkflowNode,
  _input: unknown
): Promise<unknown> {
  const config = node.config as any;

  // In a real implementation, this would call a search API
  // For now, return mock results
  return {
    query: config.query || '',
    results: [],
    count: 0,
    engine: config.searchEngine || 'google',
  };
}

// Execute API Call node
async function executeAPICallNode(
  node: WorkflowNode,
  _input: unknown
): Promise<unknown> {
  const config = node.config as any;

  try {
    const response = await fetch(config.url, {
      method: config.method || 'GET',
      headers: config.headers || {},
      body: config.body ? JSON.stringify(config.body) : undefined,
    });

    if (!response.ok) {
      throw new Error(`API call failed: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    throw new Error(`API call error: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// Execute Code node
async function executeCodeNode(node: WorkflowNode, _input: unknown): Promise<unknown> {
  const config = node.config as any;

  // In a real implementation, this would execute code in a sandboxed environment
  // For now, return a mock result
  return {
    success: true,
    output: `Code executed in ${config.language || 'javascript'}`,
  };
}

// Execute Output node
async function executeOutputNode(
  node: WorkflowNode,
  input: unknown,
  _context: Record<string, unknown>
): Promise<unknown> {
  const config = node.config as any;

  // Format output based on format type
  switch (config.outputFormat) {
    case 'json':
      return JSON.stringify(input, null, 2);

    case 'text':
      return String(input);

    case 'markdown':
      return `## Output\n\n${JSON.stringify(input, null, 2)}`;

    case 'html':
      return `<pre>${JSON.stringify(input)}</pre>`;

    default:
      return input;
  }
}

// Execute Condition node
async function executeConditionNode(
  node: WorkflowNode,
  _input: unknown
): Promise<unknown> {
  const config = node.config as any;

  // Evaluate conditions
  for (const condition of config.conditions || []) {
    try {
      // In a real implementation, this would evaluate the expression safely
      // For now, use eval (CAUTION: this is unsafe for production)
      const result = eval(condition.expression);
      if (result) {
        return { branch: condition.targetNodeId };
      }
    } catch (error) {
      // Skip invalid expressions
    }
  }

  // Default branch
  return { branch: config.defaultBranch || null };
}

// Execute Loop node
async function executeLoopNode(node: WorkflowNode, input: unknown): Promise<unknown> {
  const config = node.config as any;

  const safeInput = input as any;
  const arrayToIterate = safeInput[config.iterateOver] || safeInput;
  if (!Array.isArray(arrayToIterate)) {
    return { error: 'Loop input is not an array' };
  }

  const results = [];
  const maxIterations = config.maxIterations || arrayToIterate.length;

  for (let i = 0; i < Math.min(arrayToIterate.length, maxIterations); i++) {
    results.push({
      [config.loopVariable || 'item']: arrayToIterate[i],
      index: i,
    });
  }

  return { iterations: results, count: results.length };
}

// Execute Transform node
async function executeTransformNode(
  node: WorkflowNode,
  input: unknown
): Promise<unknown> {
  const config = node.config as any;

  if (!Array.isArray(input)) {
    return { error: 'Transform input is not an array' };
  }

  switch (config.transformation) {
    case 'map':
      if (config.customCode) {
        // Execute custom mapping code
        return input.map((item, index) => ({
          original: item,
          index,
          // Custom mapping would be applied here
        }));
      }
      return input;

    case 'filter':
      // Apply filter logic
      return input;

    case 'reduce':
      // Apply reduce logic
      return input;

    default:
      return input;
  }
}

// Execute Tool node
async function executeToolNode(node: WorkflowNode, input: unknown): Promise<unknown> {
  const config = node.config as any;

  return {
    tool: config.toolName || config.toolId || 'unknown',
    parameters: config.parameters || {},
    input,
    success: true,
  };
}

// Execute Input node
async function executeInputNode(node: WorkflowNode, input: unknown): Promise<unknown> {
  // In a real implementation, this would prompt the user for input
  const config = node.config as import('../types/workflow').InputNodeConfig;
  return { prompt: config.prompt || 'Please provide input', input };
}

// Execute Trigger node
async function executeTriggerNode(node: WorkflowNode): Promise<unknown> {
  const config = node.config as any;

  return {
    triggered: true,
    type: config.triggerType || 'manual',
    timestamp: new Date().toISOString(),
  };
}

// Validate execution results
export function validateExecutionResult(result: WorkflowExecutionResult): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (result.status === 'error') {
    errors.push('Execution failed with error');
  }

  if (!result.result) {
    errors.push('No output produced');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
