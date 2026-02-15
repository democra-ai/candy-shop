// Convert Workflow to Skill and vice versa
import type { Workflow, WorkflowNode } from '../types/workflow';
import type { Skill, SkillCategory } from '../types/skill-creator';

// Map workflow types to skill categories
function mapWorkflowToCategory(workflow: Workflow): SkillCategory {
  const hasLLM = workflow.nodes.some((n) => n.type === 'llm');
  const hasSearch = workflow.nodes.some((n) => n.type === 'web-search');
  const hasCode = workflow.nodes.some((n) => n.type === 'code');
  const hasAPI = workflow.nodes.some((n) => n.type === 'api-call');

  if (hasSearch && hasLLM) return 'Research';
  if (hasCode) return 'Development';
  if (hasAPI) return 'Tools';
  if (hasLLM) return 'Analysis';

  return 'Custom';
}

// Generate a system prompt from the workflow
function generateSystemPrompt(workflow: Workflow): string {
  const lines: string[] = [
    `You are a workflow execution agent for the "${workflow.name}" workflow.`,
    workflow.description || '',
    '',
    '## Workflow Nodes:',
  ];

  for (const node of workflow.nodes) {
    const nodeDesc = describeNode(node);
    lines.push(`\n### ${node.label || node.type}`);
    lines.push(`Type: ${node.type}`);
    lines.push(nodeDesc);
  }

  // Add connection information
  if (workflow.connections.length > 0) {
    lines.push('\n## Workflow Flow:');
    for (const conn of workflow.connections) {
      const source = workflow.nodes.find((n) => n.id === conn.sourceNodeId);
      const target = workflow.nodes.find((n) => n.id === conn.targetNodeId);
      if (source && target) {
        lines.push(`- ${source.label || source.type} → ${target.label || target.type}`);
      }
    }
  }

  // Add variables
  if (workflow.variables.length > 0) {
    lines.push('\n## Variables:');
    for (const v of workflow.variables) {
      lines.push(`- \`${v.name}\`: ${v.type}${v.description ? ` - ${v.description}` : ''}`);
    }
  }

  return lines.filter(Boolean).join('\n');
}

function describeNode(node: WorkflowNode): string {
  switch (node.type) {
    case 'llm': {
      const config = node.config as import('../types/workflow').LLMNodeConfig;
      return `Processes input using LLM model ${config.modelId || 'gpt-4'}${config.systemPrompt ? ` with custom system prompt` : ''
      }`;
    }

    case 'web-search': {
      const config = node.config as import('../types/workflow').WebSearchNodeConfig;
      return `Searches the web using ${config.searchEngine || 'google'}${config.query ? ` for: "${config.query}"` : ''
      }`;
    }

    case 'api-call': {
      const config = node.config as import('../types/workflow').APICallNodeConfig;
      return `Makes ${config.method || 'GET'} request to ${config.url || 'API endpoint'}`;
    }

    case 'code': {
      const config = node.config as import('../types/workflow').CodeNodeConfig;
      return `Executes ${config.language || 'javascript'} code`;
    }

    case 'output': {
      const config = node.config as import('../types/workflow').OutputNodeConfig;
      return `Returns output in ${config.outputFormat || 'json'} format`;
    }

    case 'condition': {
      const config = node.config as import('../types/workflow').ConditionNodeConfig;
      return `Branches based on conditions: ${config.conditions?.map((c) => c.expression).join(' OR ') || 'true'}`;
    }

    case 'loop': {
      const config = node.config as import('../types/workflow').LoopNodeConfig;
      return `Loops over ${config.iterateOver || 'array'} as "${config.loopVariable || 'item'}"${config.maxIterations ? ` (max ${config.maxIterations} iterations)` : ''
      }`;
    }

    case 'transform': {
      const config = node.config as import('../types/workflow').TransformNodeConfig;
      return `Transforms data using ${config.transformation || 'map'} operation`;
    }

    case 'tool': {
      const config = node.config as import('../types/workflow').ToolNodeConfig;
      return `Executes tool: ${config.toolName || config.toolId || 'custom tool'}`;
    }

    case 'input': {
      const config = node.config as import('../types/workflow').InputNodeConfig;
      return `Collects ${config.inputType || 'text'} input from user${config.prompt ? `: "${config.prompt}"` : ''
      }`;
    }

    case 'trigger': {
      const config = node.config as import('../types/workflow').TriggerNodeConfig;
      return `Triggers workflow on ${config.triggerType || 'manual'}`;
    }

    default:
      return '';
  }
}

// Generate capabilities from workflow
function generateCapabilities(workflow: Workflow): string[] {
  const capabilities: string[] = [];

  for (const node of workflow.nodes) {
    switch (node.type) {
      case 'llm':
        capabilities.push('LLM Processing', 'Text Generation', 'Text Analysis');
        break;
      case 'web-search':
        capabilities.push('Web Search', 'Information Retrieval');
        break;
      case 'api-call':
        capabilities.push('API Integration', 'HTTP Requests');
        break;
      case 'code':
        capabilities.push('Code Execution', 'Data Processing');
        break;
      case 'output':
        capabilities.push('Result Formatting', 'Data Output');
        break;
      case 'condition':
        capabilities.push('Conditional Logic', 'Branching');
        break;
      case 'loop':
        capabilities.push('Iteration', 'Batch Processing');
        break;
      case 'transform':
        capabilities.push('Data Transformation', 'Mapping');
        break;
      case 'tool': {
        const config = node.config as import('../types/workflow').ToolNodeConfig;
        capabilities.push(`Tool: ${config.toolName || 'Custom'}`);
        break;
      }
      case 'input':
        capabilities.push('User Input Collection', 'Interactive');
        break;
      case 'trigger':
        capabilities.push('Workflow Trigger', 'Automation');
        break;
    }
  }

  // Remove duplicates
  return Array.from(new Set(capabilities));
}

// Main conversion: Workflow → Skill
export function workflowToSkill(workflow: Workflow): Omit<Skill, 'userId'> {
  const category = mapWorkflowToCategory(workflow);
  const systemPrompt = generateSystemPrompt(workflow);
  const capabilities = generateCapabilities(workflow);

  return {
    id: workflow.id,
    // userId: '', // Will be set by the caller
    name: workflow.name,
    description: workflow.description || `A workflow with ${workflow.nodes.length} nodes`,
    category,
    icon: getIconForCategory(category),
    color: getColorForCategory(category),
    config: {
      capabilities,
      systemPrompt,
      parameters: {
        workflowId: workflow.id,
        workflowVersion: workflow.version,
      },
      tools: workflow.nodes.filter((n) => n.type === 'tool').map((n) => (n.config as import('../types/workflow').ToolNodeConfig).toolId || ''),
    },
    sourceFiles: [],
    analysisContext: {
      workDomain: [category],
      technicalSkills: capabilities.slice(0, 5),
      experiencePatterns: [],
      keyTopics: workflow.metadata.tags,
      suggestedName: workflow.name,
      suggestedDescription: workflow.description || `Workflow-based skill`,
      suggestedCategory: category,
      suggestedCapabilities: capabilities.slice(0, 5),
      filesSummary: [],
      confidence: 0.9,
      systemPrompt,
    },
    installCommand: `skill install ${workflow.name.toLowerCase().replace(/\s+/g, '-')}`,
    popularity: 0,
    // metadata: workflow.metadata,
    createdAt: workflow.metadata.createdAt || new Date(),
    updatedAt: workflow.metadata.updatedAt || new Date(),
    lastUsedAt: workflow.metadata.lastExecutedAt,
    status: 'draft',
    isPublic: false,
    origin: 'created',
  };
}

// Helper: Get icon for category
function getIconForCategory(category: SkillCategory): string {
  const icons: Record<SkillCategory, string> = {
    Knowledge: '📚',
    Analysis: '🔍',
    Development: '💻',
    Design: '🎨',
    Marketing: '📢',
    Productivity: '⚡',
    Tools: '🔧',
    Research: '🔬',
    Mobile: '📱',
    Writing: '✍️',
    Custom: '🧩',
  };
  return icons[category] || '🧩';
}

// Helper: Get color class for category
function getColorForCategory(category: SkillCategory): string {
  const colors: Record<SkillCategory, string> = {
    Knowledge: 'bg-blue-500/10 border-blue-500/20 text-blue-600',
    Analysis: 'bg-violet-500/10 border-violet-500/20 text-violet-600',
    Development: 'bg-orange-500/10 border-orange-500/20 text-orange-600',
    Design: 'bg-pink-500/10 border-pink-500/20 text-pink-600',
    Marketing: 'bg-red-500/10 border-red-500/20 text-red-600',
    Productivity: 'bg-amber-500/10 border-amber-500/20 text-amber-600',
    Tools: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600',
    Research: 'bg-cyan-500/10 border-cyan-500/20 text-cyan-600',
    Mobile: 'bg-indigo-500/10 border-indigo-500/20 text-indigo-600',
    Writing: 'bg-rose-500/10 border-rose-500/20 text-rose-600',
    Custom: 'bg-gray-500/10 border-gray-500/20 text-gray-600',
  };
  return colors[category] || colors.Custom;
}

// Reverse conversion: Skill → Workflow (partial)
export function skillToWorkflow(skill: Skill): Partial<Workflow> {
  const workflowId = skill.config.parameters?.workflowId as string || `workflow-${skill.id}`;
  const workflowVersion = skill.config.parameters?.workflowVersion as number || 1;

  return {
    id: workflowId,
    name: skill.name,
    description: skill.description,
    category: skill.category,
    version: workflowVersion,
    nodes: [],
    connections: [],
    variables: [],
    settings: {
      timeout: 300,
      errorHandling: 'stop',
    },
    metadata: {
      createdAt: skill.createdAt,
      updatedAt: skill.updatedAt,
      lastExecutedAt: skill.lastUsedAt,
      executionCount: 0,
      tags: skill.analysisContext.keyTopics || [],
      author: skill.userId,
    },
  };
}

// Generate install command from workflow
export function generateInstallCommand(workflow: Workflow): string {
  const slug = workflow.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  return `skill install ${slug}`;
}

// Validate workflow before conversion
export function validateWorkflow(workflow: Workflow): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!workflow.name || workflow.name.trim() === '') {
    errors.push('Workflow name is required');
  }

  if (!workflow.nodes || workflow.nodes.length === 0) {
    errors.push('Workflow must have at least one node');
  }

  // Check for trigger node
  const hasTrigger = workflow.nodes.some((n) => n.type === 'trigger');
  if (!hasTrigger) {
    errors.push('Workflow should have a trigger node');
  }

  // Check for output node
  const hasOutput = workflow.nodes.some((n) => n.type === 'output');
  if (!hasOutput) {
    errors.push('Workflow should have an output node');
  }

  // Validate connections
  for (const conn of workflow.connections) {
    const sourceExists = workflow.nodes.some((n) => n.id === conn.sourceNodeId);
    const targetExists = workflow.nodes.some((n) => n.id === conn.targetNodeId);

    if (!sourceExists) {
      errors.push(`Connection references non-existent source node: ${conn.sourceNodeId}`);
    }
    if (!targetExists) {
      errors.push(`Connection references non-existent target node: ${conn.targetNodeId}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

// Get workflow statistics
export function getWorkflowStats(workflow: Workflow): {
  totalNodes: number;
  totalConnections: number;
  nodeTypes: Record<string, number>;
  complexity: 'simple' | 'medium' | 'complex';
} {
  const nodeTypes: Record<string, number> = {};

  for (const node of workflow.nodes) {
    nodeTypes[node.type] = (nodeTypes[node.type] || 0) + 1;
  }

  const totalNodes = workflow.nodes.length;
  const totalConnections = workflow.connections.length;

  let complexity: 'simple' | 'medium' | 'complex';
  if (totalNodes <= 3 && totalConnections <= 3) {
    complexity = 'simple';
  } else if (totalNodes <= 8 && totalConnections <= 10) {
    complexity = 'medium';
  } else {
    complexity = 'complex';
  }

  return {
    totalNodes,
    totalConnections,
    nodeTypes,
    complexity,
  };
}
