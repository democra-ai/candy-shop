import React, { useState, useCallback, useRef, useMemo } from 'react';
import {
  Play,
  Save,
  Download,
  Trash2,
  Plus,
  Settings,
  Zap,
  Search,
  Globe,
  Code,
  ArrowRight,
  FileOutput,
  GitBranch,
  RotateCcw,
  ArrowRightLeft,
  Wrench,
  MessageSquare,

  X,
} from 'lucide-react';
import type {
  Workflow,
  WorkflowNode,

  WorkflowNodeType,
  CodeNodeConfig,
  OutputNodeConfig,
  LLMNodeConfig,
  WebSearchNodeConfig,
  APICallNodeConfig,
} from '../../types/workflow';

interface WorkflowBuilderProps {
  initialWorkflow?: Partial<Workflow>;
  onSave: (workflow: Workflow) => void;
  onExecute?: (workflow: Workflow) => void;
  onBack?: () => void;
}

// Custom Brain icon component (must be defined before NODE_TYPES)
const Brain = ({ className }: { className?: string }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-2.5 2.5H6a2.5 2.5 0 0 1-2.5-2.5V4.5A2.5 2.5 0 0 1 6 2z" />
    <path d="M6 2v4" />
    <path d="M18 2v4" />
    <path d="M8.5 2h7" />
  </svg>
);

// Node type definitions with icons and colors
const NODE_TYPES: Array<{
  type: WorkflowNodeType;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  defaultConfig: any;
}> = [
  {
    type: 'trigger',
    label: 'Trigger',
    description: 'Start the workflow',
    icon: Zap,
    color: 'bg-amber-500',
    defaultConfig: { triggerType: 'manual' },
  },
  {
    type: 'llm',
    label: 'LLM',
    description: 'Process with language model',
    icon: Brain,
    color: 'bg-violet-500',
    defaultConfig: { modelProvider: 'openai', modelId: 'gpt-4', inputs: {} },
  },
  {
    type: 'web-search',
    label: 'Web Search',
    description: 'Search the web',
    icon: Search,
    color: 'bg-blue-500',
    defaultConfig: { searchEngine: 'google', query: '', maxResults: 5 },
  },
  {
    type: 'api-call',
    label: 'API Call',
    description: 'Make HTTP request',
    icon: Globe,
    color: 'bg-emerald-500',
    defaultConfig: { url: '', method: 'GET' },
  },
  {
    type: 'code',
    label: 'Code',
    description: 'Execute code',
    icon: Code,
    color: 'bg-orange-500',
    defaultConfig: { language: 'javascript', code: '', inputs: {} },
  },
  {
    type: 'output',
    label: 'Output',
    description: 'Return result',
    icon: FileOutput,
    color: 'bg-cyan-500',
    defaultConfig: { outputFormat: 'json' },
  },
  {
    type: 'condition',
    label: 'Condition',
    description: 'Branch logic',
    icon: GitBranch,
    color: 'bg-purple-500',
    defaultConfig: { conditions: [] },
  },
  {
    type: 'loop',
    label: 'Loop',
    description: 'Iterate over items',
    icon: RotateCcw,
    color: 'bg-pink-500',
    defaultConfig: { iterateOver: '', loopVariable: 'item' },
  },
  {
    type: 'transform',
    label: 'Transform',
    description: 'Transform data',
    icon: ArrowRightLeft,
    color: 'bg-indigo-500',
    defaultConfig: { transformation: 'map' },
  },
  {
    type: 'tool',
    label: 'Tool',
    description: 'Use custom tool',
    icon: Wrench,
    color: 'bg-slate-500',
    defaultConfig: { toolId: '', toolName: '', parameters: {} },
  },
  {
    type: 'input',
    label: 'Input',
    description: 'Collect user input',
    icon: MessageSquare,
    color: 'bg-rose-500',
    defaultConfig: { inputType: 'text', prompt: '' },
  },
];

export function WorkflowBuilder({
  initialWorkflow,
  onSave,
  onExecute,
  onBack,
}: WorkflowBuilderProps) {
  const [workflow, setWorkflow] = useState<Partial<Workflow>>(() => ({
    id: initialWorkflow?.id || `workflow-${Date.now()}`,
    name: initialWorkflow?.name || 'Untitled Workflow',
    description: initialWorkflow?.description || '',
    category: initialWorkflow?.category || 'Custom',
    version: initialWorkflow?.version || 1,
    nodes: initialWorkflow?.nodes || [],
    connections: initialWorkflow?.connections || [],
    variables: initialWorkflow?.variables || [],
    settings: initialWorkflow?.settings || {},
    metadata: initialWorkflow?.metadata || {
      createdAt: new Date(),
      updatedAt: new Date(),
      executionCount: 0,
      tags: [],
    },
  }));

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [draggedNode, setDraggedNode] = useState<{ id: string; offsetX: number; offsetY: number } | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionStart, setConnectionStart] = useState<string | null>(null);
  const [showNodePalette, setShowNodePalette] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const canvasRef = useRef<HTMLDivElement>(null);
  // const dragStartPos = useRef<{ x: number; y: number } | null>(null);

  // Get selected node
  const selectedNode = useMemo(
    () => workflow.nodes?.find((n) => n.id === selectedNodeId) || null,
    [workflow.nodes, selectedNodeId]
  );

  // Add a new node
  const addNode = useCallback(
    (nodeType: WorkflowNodeType, position: { x: number; y: number }) => {
      const nodeDef = NODE_TYPES.find((n) => n.type === nodeType);
      if (!nodeDef) return;

      const newNode: WorkflowNode = {
        id: `node-${Date.now()}`,
        type: nodeType,
        position,
        config: nodeDef.defaultConfig,
        label: nodeDef.label,
        icon: nodeDef.label,
      };

      setWorkflow((prev) => ({
        ...prev,
        nodes: [...(prev.nodes || []), newNode],
        metadata: {
          ...prev.metadata,
          updatedAt: new Date(),
        },
      }));
      setSelectedNodeId(newNode.id);
      setShowNodePalette(false);
    },
    []
  );

  // Delete a node
  const deleteNode = useCallback(
    (nodeId: string) => {
      setWorkflow((prev) => ({
        ...prev,
        nodes: prev.nodes?.filter((n) => n.id !== nodeId) || [],
        connections: prev.connections?.filter(
          (c) => c.sourceNodeId !== nodeId && c.targetNodeId !== nodeId
        ) || [],
        metadata: {
          ...prev.metadata,
          updatedAt: new Date(),
        },
      }));
      if (selectedNodeId === nodeId) {
        setSelectedNodeId(null);
      }
    },
    [selectedNodeId]
  );

  // Update a node
  const updateNode = useCallback(
    (nodeId: string, updates: Partial<WorkflowNode>) => {
      setWorkflow((prev) => ({
        ...prev,
        nodes: prev.nodes?.map((n) => (n.id === nodeId ? { ...n, ...updates } : n)) || [],
        metadata: {
          ...prev.metadata,
          updatedAt: new Date(),
        },
      }));
    },
    []
  );

  // Add a connection


  // Delete a connection


  // Handle canvas click (for placing nodes or deselecting)
  const handleCanvasClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (e.target !== e.currentTarget) return;

      /*
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;

      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      */

      if (showNodePalette) {
        // Show palette at click position
        setDraggedNode(null);
        return;
      }

      setSelectedNodeId(null);
    },
    [showNodePalette]
  );

  // Handle mouse move for dragging
  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!draggedNode || !canvasRef.current) return;

      const rect = canvasRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left - draggedNode.offsetX;
      const y = e.clientY - rect.top - draggedNode.offsetY;

      updateNode(draggedNode.id, {
        position: { x, y },
      });
    },
    [draggedNode, updateNode]
  );

  // Handle mouse up
  const handleMouseUp = useCallback(() => {
    if (isConnecting && connectionStart) {
      /*
      const _hoveredElement = document.elementFromPoint(
        dragStartPos.current?.x || 0,
        dragStartPos.current?.y || 0
      );
      */
      // Handle connection completion
    }
    setDraggedNode(null);
    setIsConnecting(false);
    setConnectionStart(null);
  }, [isConnecting, connectionStart]);

  // Save workflow
  const handleSave = useCallback(() => {
    if (!workflow.name) {
      alert('Please enter a workflow name');
      return;
    }
    const workflowToSave = {
      ...workflow,
      metadata: {
        ...workflow.metadata,
        createdAt: workflow.metadata?.createdAt || new Date(),
        updatedAt: new Date(),
        executionCount: workflow.metadata?.executionCount || 0,
        tags: workflow.metadata?.tags || [],
      },
    } as Workflow;
    onSave(workflowToSave);
  }, [workflow, onSave]);

  // Execute workflow
  const handleExecute = useCallback(() => {
    if (!workflow.name) {
      alert('Please enter a workflow name');
      return;
    }
    const workflowToExecute = {
      ...workflow,
      metadata: {
        ...workflow.metadata,
        createdAt: workflow.metadata?.createdAt || new Date(),
        updatedAt: new Date(),
        executionCount: workflow.metadata?.executionCount || 0,
        tags: workflow.metadata?.tags || [],
      },
    } as Workflow;
    onExecute?.(workflowToExecute);
  }, [workflow, onExecute]);

  // Export workflow
  const handleExport = useCallback(() => {
    const dataStr = JSON.stringify(workflow, null, 2);
    const dataUrl = `data:application/json;charset=utf-8,${encodeURIComponent(dataStr)}`;
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = `${workflow.name || 'workflow'}.json`;
    link.click();
  }, [workflow]);

  return (
    <div className="flex h-screen bg-secondary">
      {/* Left Sidebar - Node Palette */}
      <div className="w-72 bg-card border-r border-border flex flex-col">
        <div className="p-4 border-b border-border">
          <h2 className="text-lg font-bold text-foreground mb-4">Nodes</h2>
          <input
            type="text"
            placeholder="Search nodes..."
            className="w-full px-3 py-2 bg-input border border-input-border rounded-xl text-sm text-foreground placeholder:text-foreground-tertiary focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {NODE_TYPES.map((nodeType) => {
            const Icon = nodeType.icon;
            return (
              <button
                key={nodeType.type}
                onClick={() => {
                  setShowNodePalette(true);
                  setDraggedNode(null);
                }}
                className="w-full flex items-center gap-3 p-2 hover:bg-secondary rounded-lg transition-colors text-left"
              >
                <div className={`w-8 h-8 rounded-lg ${nodeType.color} flex items-center justify-center text-white`}>
                  <Icon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-foreground truncate">{nodeType.label}</div>
                  <div className="text-xs text-foreground-tertiary truncate">{nodeType.description}</div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Canvas */}
      <div className="flex-1 flex flex-col">
        {/* Top Toolbar */}
        <div className="h-16 bg-card border-b border-border flex items-center justify-between px-4">
          <div className="flex items-center gap-4">
            {onBack && (
              <button
                onClick={onBack}
                className="p-2 hover:bg-secondary rounded-lg transition-colors"
              >
                <ArrowRight className="w-5 h-5 text-foreground-secondary rotate-180" />
              </button>
            )}
            <div>
              <input
                type="text"
                value={workflow.name}
                onChange={(e) => setWorkflow((prev) => ({ ...prev, name: e.target.value }))}
                className="text-lg font-bold text-foreground bg-transparent border-none focus:outline-none"
                placeholder="Workflow name..."
              />
              <input
                type="text"
                value={workflow.description || ''}
                onChange={(e) => setWorkflow((prev) => ({ ...prev, description: e.target.value }))}
                className="text-sm text-foreground-tertiary bg-transparent border-none focus:outline-none"
                placeholder="Add description..."
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="flex items-center gap-2 px-3 py-2 hover:bg-secondary rounded-lg transition-colors"
            >
              <Settings className="w-4 h-4 text-foreground-secondary" />
              <span className="text-sm text-foreground-secondary">Settings</span>
            </button>
            <button
              onClick={handleExport}
              className="flex items-center gap-2 px-3 py-2 hover:bg-secondary rounded-lg transition-colors"
            >
              <Download className="w-4 h-4 text-foreground-secondary" />
              <span className="text-sm text-foreground-secondary">Export</span>
            </button>
            <button
              onClick={handleSave}
              className="candy-btn btn-press flex items-center gap-2 px-4 py-2 rounded-xl font-semibold"
            >
              <Save className="w-4 h-4" />
              <span className="text-sm">Save</span>
            </button>
            {onExecute && (
              <button
                onClick={handleExecute}
                className="flex items-center gap-2 px-4 py-2 bg-accent text-card rounded-xl font-semibold hover:opacity-90 transition-opacity btn-press shadow-candy-1"
              >
                <Play className="w-4 h-4" />
                <span className="text-sm">Run</span>
              </button>
            )}
          </div>
        </div>

        {/* Canvas */}
        <div
          ref={canvasRef}
          className="flex-1 relative overflow-hidden bg-secondary"
          onClick={handleCanvasClick}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
        >
          {/* Grid background */}
          <div className="absolute inset-0 opacity-20" style={{
            backgroundImage: `
              linear-gradient(to right, #e5e7eb 1px, transparent 1px),
              linear-gradient(to bottom, #e5e7eb 1px, transparent 1px)
            `,
            backgroundSize: '20px 20px'
          }} />

          {/* Connections (SVG overlay) */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none">
            {workflow.connections?.map((conn) => {
              const sourceNode = workflow.nodes?.find((n) => n.id === conn.sourceNodeId);
              const targetNode = workflow.nodes?.find((n) => n.id === conn.targetNodeId);
              if (!sourceNode || !targetNode) return null;

              const x1 = sourceNode.position.x + 150;
              const y1 = sourceNode.position.y + 40;
              const x2 = targetNode.position.x;
              const y2 = targetNode.position.y + 40;

              return (
                <g key={conn.id}>
                  <path
                    d={`M ${x1} ${y1} C ${x1 + 50} ${y1}, ${x2 - 50} ${y2}, ${x2} ${y2}`}
                    fill="none"
                    stroke="#94a3b8"
                    strokeWidth="2"
                    markerEnd="url(#arrowhead)"
                  />
                </g>
              );
            })}
            <defs>
              <marker
                id="arrowhead"
                markerWidth="10"
                markerHeight="7"
                refX="9"
                refY="3.5"
                orient="auto"
              >
                <polygon points="0 0, 10 3.5, 0 7" fill="#94a3b8" />
              </marker>
            </defs>
          </svg>

          {/* Nodes */}
          {workflow.nodes?.map((node) => {
            const nodeDef = NODE_TYPES.find((n) => n.type === node.type);
            const Icon = nodeDef?.icon || Zap;
            const isSelected = node.id === selectedNodeId;

            return (
              <div
                key={node.id}
                className={`absolute cursor-move ${isSelected ? 'ring-2 ring-primary ring-offset-2' : ''}`}
                style={{
                  left: node.position.x,
                  top: node.position.y,
                  width: 300,
                }}
                onMouseDown={(e) => {
                  e.stopPropagation();
                  setSelectedNodeId(node.id);
                  setDraggedNode({
                    id: node.id,
                    offsetX: e.clientX - node.position.x,
                    offsetY: e.clientY - node.position.y,
                  });
                }}
              >
                <div className="bg-card rounded-xl shadow-lg border border-border overflow-hidden">
                  {/* Node header */}
                  <div className={`px-4 py-3 flex items-center gap-3 ${nodeDef?.color} bg-opacity-10 border-b border-border`}>
                    <div className={`w-8 h-8 rounded-lg ${nodeDef?.color} flex items-center justify-center text-white`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-foreground truncate">
                        {node.label || nodeDef?.label}
                      </div>
                      <div className="text-xs text-foreground-tertiary">
                        {nodeDef?.description}
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteNode(node.id);
                      }}
                      className="p-1 hover:bg-card rounded transition-colors opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 className="w-4 h-4 text-error" />
                    </button>
                  </div>

                  {/* Node content preview */}
                  <div className="p-3">
                    <div className="text-xs text-foreground-tertiary bg-secondary rounded-lg p-2">
                      {node.type === 'llm' && 'LLM Processing Node'}
                      {node.type === 'web-search' && 'Web Search Query'}
                      {node.type === 'api-call' && 'API Request'}
                      {node.type === 'code' && 'Code Execution'}
                      {node.type === 'output' && 'Output Result'}
                      {node.type === 'condition' && 'Conditional Branch'}
                      {node.type === 'loop' && 'Loop Iteration'}
                      {node.type === 'transform' && 'Data Transform'}
                      {node.type === 'tool' && 'Custom Tool'}
                      {node.type === 'input' && 'User Input'}
                      {node.type === 'trigger' && 'Workflow Trigger'}
                    </div>
                  </div>

                  {/* Connection handles */}
                  <div className="absolute -left-1.5 top-1/2 -translate-y-1/2 w-3 h-3 bg-foreground-tertiary rounded-full border-2 border-card" />
                  <div className="absolute -right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 bg-foreground-tertiary rounded-full border-2 border-card" />
                </div>
              </div>
            );
          })}

          {/* Empty state */}
          {(!workflow.nodes || workflow.nodes.length === 0) && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <div className="w-16 h-16 bg-secondary rounded-full flex items-center justify-center mx-auto mb-4">
                  <Plus className="w-8 h-8 text-foreground-tertiary" />
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">Start Building</h3>
                <p className="text-sm text-foreground-tertiary mb-4">
                  Select a node type from the sidebar to add to your workflow
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Right Sidebar - Node Properties */}
      <div className="w-80 bg-card border-l border-border flex flex-col">
        <div className="p-4 border-b border-border">
          <h2 className="text-lg font-bold text-foreground">Properties</h2>
        </div>

        {selectedNode ? (
          <div className="flex-1 overflow-y-auto p-4 space-y-6">
            {/* Basic properties */}
            <div>
              <label className="block text-sm font-medium text-foreground-secondary mb-2">Node Label</label>
              <input
                type="text"
                value={selectedNode.label || ''}
                onChange={(e) => updateNode(selectedNode.id, { label: e.target.value })}
                className="w-full px-3 py-2 bg-input border border-input-border rounded-xl text-sm text-foreground placeholder:text-foreground-tertiary focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="Enter label..."
              />
            </div>

            {/* Node type-specific config */}
            {selectedNode.type === 'llm' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-foreground-secondary mb-2">Model Provider</label>
                  <select
                    value={(selectedNode.config as LLMNodeConfig).modelProvider}
                    onChange={(e) => updateNode(selectedNode.id, {
                      config: { ...selectedNode.config, modelProvider: e.target.value as 'openai' | 'anthropic' | 'google' | 'custom' }
                    })}
                    className="w-full px-3 py-2 bg-input border border-input-border rounded-xl text-sm text-foreground placeholder:text-foreground-tertiary focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="openai">OpenAI</option>
                    <option value="anthropic">Anthropic</option>
                    <option value="google">Google</option>
                    <option value="custom">Custom</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground-secondary mb-2">Model ID</label>
                  <input
                    type="text"
                    value={(selectedNode.config as LLMNodeConfig).modelId}
                    onChange={(e) => updateNode(selectedNode.id, {
                      config: { ...selectedNode.config, modelId: e.target.value }
                    })}
                    className="w-full px-3 py-2 bg-input border border-input-border rounded-xl text-sm text-foreground placeholder:text-foreground-tertiary focus:outline-none focus:ring-2 focus:ring-ring"
                    placeholder="gpt-4"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground-secondary mb-2">System Prompt</label>
                  <textarea
                    value={(selectedNode.config as LLMNodeConfig).systemPrompt || ''}
                    onChange={(e) => updateNode(selectedNode.id, {
                      config: { ...selectedNode.config, systemPrompt: e.target.value }
                    })}
                    className="w-full px-3 py-2 bg-input border border-input-border rounded-xl text-sm text-foreground placeholder:text-foreground-tertiary focus:outline-none focus:ring-2 focus:ring-ring min-h-[100px]"
                    placeholder="Enter system prompt..."
                  />
                </div>
              </div>
            )}

            {selectedNode.type === 'web-search' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-foreground-secondary mb-2">Search Engine</label>
                  <select
                    value={(selectedNode.config as WebSearchNodeConfig).searchEngine}
                    onChange={(e) => updateNode(selectedNode.id, {
                      config: { ...selectedNode.config, searchEngine: e.target.value as 'google' | 'bing' | 'duckduckgo' | 'tavily' }
                    })}
                    className="w-full px-3 py-2 bg-input border border-input-border rounded-xl text-sm text-foreground placeholder:text-foreground-tertiary focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="google">Google</option>
                    <option value="bing">Bing</option>
                    <option value="duckduckgo">DuckDuckGo</option>
                    <option value="tavily">Tavily</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground-secondary mb-2">Query</label>
                  <input
                    type="text"
                    value={(selectedNode.config as WebSearchNodeConfig).query}
                    onChange={(e) => updateNode(selectedNode.id, {
                      config: { ...selectedNode.config, query: e.target.value }
                    })}
                    className="w-full px-3 py-2 bg-input border border-input-border rounded-xl text-sm text-foreground placeholder:text-foreground-tertiary focus:outline-none focus:ring-2 focus:ring-ring"
                    placeholder="Enter search query..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground-secondary mb-2">Max Results</label>
                  <input
                    type="number"
                    value={(selectedNode.config as WebSearchNodeConfig).maxResults}
                    onChange={(e) => updateNode(selectedNode.id, {
                      config: { ...selectedNode.config, maxResults: parseInt(e.target.value) }
                    })}
                    className="w-full px-3 py-2 bg-input border border-input-border rounded-xl text-sm text-foreground placeholder:text-foreground-tertiary focus:outline-none focus:ring-2 focus:ring-ring"
                    min="1"
                    max="50"
                  />
                </div>
              </div>
            )}

            {selectedNode.type === 'api-call' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-foreground-secondary mb-2">URL</label>
                  <input
                    type="text"
                    value={(selectedNode.config as APICallNodeConfig).url}
                    onChange={(e) => updateNode(selectedNode.id, {
                      config: { ...selectedNode.config, url: e.target.value }
                    })}
                    className="w-full px-3 py-2 bg-input border border-input-border rounded-xl text-sm text-foreground placeholder:text-foreground-tertiary focus:outline-none focus:ring-2 focus:ring-ring"
                    placeholder="https://api.example.com/endpoint"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground-secondary mb-2">Method</label>
                  <select
                    value={(selectedNode.config as APICallNodeConfig).method}
                    onChange={(e) => updateNode(selectedNode.id, {
                      config: { ...selectedNode.config, method: e.target.value as 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' }
                    })}
                    className="w-full px-3 py-2 bg-input border border-input-border rounded-xl text-sm text-foreground placeholder:text-foreground-tertiary focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="GET">GET</option>
                    <option value="POST">POST</option>
                    <option value="PUT">PUT</option>
                    <option value="PATCH">PATCH</option>
                    <option value="DELETE">DELETE</option>
                  </select>
                </div>
              </div>
            )}

            {selectedNode.type === 'code' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-foreground-secondary mb-2">Language</label>
                  <select
                    value={(selectedNode.config as CodeNodeConfig).language}
                    onChange={(e) => updateNode(selectedNode.id, {
                      config: { ...selectedNode.config, language: e.target.value as 'javascript' | 'python' | 'typescript' }
                    })}
                    className="w-full px-3 py-2 bg-input border border-input-border rounded-xl text-sm text-foreground placeholder:text-foreground-tertiary focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="javascript">JavaScript</option>
                    <option value="python">Python</option>
                    <option value="typescript">TypeScript</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground-secondary mb-2">Code</label>
                  <textarea
                    value={(selectedNode.config as CodeNodeConfig).code}
                    onChange={(e) => updateNode(selectedNode.id, {
                      config: { ...selectedNode.config, code: e.target.value }
                    })}
                    className="w-full px-3 py-2 bg-input border border-input-border rounded-xl text-sm text-foreground placeholder:text-foreground-tertiary focus:outline-none focus:ring-2 focus:ring-ring min-h-[150px] font-mono text-xs"
                    placeholder="// Enter your code here..."
                  />
                </div>
              </div>
            )}

            {selectedNode.type === 'output' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-foreground-secondary mb-2">Output Format</label>
                  <select
                    value={(selectedNode.config as OutputNodeConfig).outputFormat}
                    onChange={(e) => updateNode(selectedNode.id, {
                      config: { ...selectedNode.config, outputFormat: e.target.value as 'text' | 'json' | 'markdown' | 'html' }
                    })}
                    className="w-full px-3 py-2 bg-input border border-input-border rounded-xl text-sm text-foreground placeholder:text-foreground-tertiary focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="text">Text</option>
                    <option value="json">JSON</option>
                    <option value="markdown">Markdown</option>
                    <option value="html">HTML</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground-secondary mb-2">Output Template</label>
                  <textarea
                    value={(selectedNode.config as OutputNodeConfig).template || ''}
                    onChange={(e) => updateNode(selectedNode.id, {
                      config: { ...selectedNode.config, template: e.target.value }
                    })}
                    className="w-full px-3 py-2 bg-input border border-input-border rounded-xl text-sm text-foreground placeholder:text-foreground-tertiary focus:outline-none focus:ring-2 focus:ring-ring min-h-[100px]"
                    placeholder="{{output}} - use {{variable}} for references"
                  />
                </div>
              </div>
            )}

            {/* Delete node button */}
            <button
              onClick={() => deleteNode(selectedNode.id)}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-error/10 text-error rounded-lg hover:bg-error/20 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              <span className="text-sm font-medium">Delete Node</span>
            </button>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center p-8">
            <p className="text-sm text-foreground-tertiary text-center">
              Select a node to view and edit its properties
            </p>
          </div>
        )}
      </div>

      {/* Node Palette Modal */}
      {showNodePalette && (
        <div className="fixed inset-0 bg-foreground/40 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-card rounded-2xl shadow-xl w-[600px] max-h-[80vh] overflow-hidden">
            <div className="p-4 border-b border-border flex items-center justify-between">
              <h3 className="text-lg font-bold text-foreground">Add Node</h3>
              <button
                onClick={() => setShowNodePalette(false)}
                className="p-2 hover:bg-secondary rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-foreground-secondary" />
              </button>
            </div>
            <div className="p-4 overflow-y-auto max-h-[60vh] space-y-2">
              {NODE_TYPES.map((nodeType) => {
                const Icon = nodeType.icon;
                return (
                  <button
                    key={nodeType.type}
                    onClick={() => addNode(nodeType.type, { x: 100, y: 100 })}
                    className="w-full flex items-center gap-4 p-3 hover:bg-secondary rounded-xl transition-colors text-left"
                  >
                    <div className={`w-10 h-10 rounded-xl ${nodeType.color} flex items-center justify-center text-white`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-foreground">{nodeType.label}</div>
                      <div className="text-xs text-foreground-tertiary">{nodeType.description}</div>
                    </div>
                    <Plus className="w-5 h-5 text-foreground-tertiary" />
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Settings Panel */}
      {showSettings && (
        <div className="fixed inset-0 bg-foreground/40 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-card rounded-2xl shadow-xl w-[500px]">
            <div className="p-4 border-b border-border flex items-center justify-between">
              <h3 className="text-lg font-bold text-foreground">Workflow Settings</h3>
              <button
                onClick={() => setShowSettings(false)}
                className="p-2 hover:bg-secondary rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-foreground-secondary" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground-secondary mb-2">Timeout (seconds)</label>
                <input
                  type="number"
                  value={workflow.settings?.timeout || 300}
                  onChange={(e) => setWorkflow((prev) => ({
                    ...prev,
                    settings: { ...prev.settings, timeout: parseInt(e.target.value) }
                  }))}
                  className="w-full px-3 py-2 bg-input border border-input-border rounded-xl text-sm text-foreground placeholder:text-foreground-tertiary focus:outline-none focus:ring-2 focus:ring-ring"
                  min="10"
                  max="3600"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground-secondary mb-2">Error Handling</label>
                <select
                  value={workflow.settings?.errorHandling || 'stop'}
                  onChange={(e) => setWorkflow((prev) => ({
                    ...prev,
                    settings: { ...prev.settings, errorHandling: e.target.value as 'stop' | 'continue' | 'retry' }
                  }))}
                  className="w-full px-3 py-2 bg-input border border-input-border rounded-xl text-sm text-foreground placeholder:text-foreground-tertiary focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="stop">Stop on error</option>
                  <option value="continue">Continue on error</option>
                  <option value="retry">Retry on error</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground-secondary mb-2">Tags</label>
                <input
                  type="text"
                  value={workflow.metadata?.tags?.join(', ') || ''}
                  onChange={(e) => setWorkflow((prev) => {
                    const currentMeta = prev.metadata;
                    return {
                      ...prev,
                      metadata: {
                        createdAt: currentMeta?.createdAt || new Date(),
                        updatedAt: new Date(),
                        executionCount: currentMeta?.executionCount || 0,
                        tags: e.target.value.split(',').map(t => t.trim()).filter(Boolean),
                      }
                    };
                  })}
                  className="w-full px-3 py-2 bg-input border border-input-border rounded-xl text-sm text-foreground placeholder:text-foreground-tertiary focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder="tag1, tag2, tag3"
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
