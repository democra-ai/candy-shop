import { useState, useEffect, useCallback, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  X,
  Send,
  Loader2,
  Sparkles,
  ChevronDown,
  ChevronRight,
  Settings,
  Square,
  Circle,
  CheckCircle2,
  AlertCircle,
  Clock,
  Wrench,
  Brain,
  FileText,
  Folder,
  FolderOpen,
  GitBranch,
  Camera,
  ListTodo,
  Trash2,
  Plus,
  MessageSquare,
  Save,
  Edit2,
  Paperclip,
  Image,
  File,
  ExternalLink,
  Github,
} from 'lucide-react';
import type { Skill } from '../../types/skill-creator';
import { SKILLS_DATA } from '../../data/skillsData';
import { storageUtils } from '../../utils/storage';
import {
  opencode,
  fetchSkillMd,
  type Part,
  type TextPart,
  type ToolPart,
  type ReasoningPart,
  type StepFinishPart,
  type FilePart,
  type PatchPart,
  type ModelConfig,
  type ProviderModel,
  type TodoItem,
  type SessionInfo,
  type QuestionEvent,
  type FileAttachment,
} from '../../lib/opencode-client';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface UserEntry {
  type: 'user';
  text: string;
  time: number;
}

interface AssistantEntry {
  type: 'assistant';
  messageId: string;
  parts: Part[];
  isComplete: boolean;
  cost?: number;
  tokens?: { input: number; output: number; reasoning: number };
}

type ChatEntry = UserEntry | AssistantEntry;

interface SkillExecutorProps {
  skill: Skill;
  onClose: () => void;
}

/**
 * Safely extract a renderable string from a tool part's `state` field.
 * OpenCode SSE may send state as an object like `{status, input, time}`
 * instead of a plain string.  Rendering an object as a React child causes
 * Error #31, so we always normalise to a string here.
 */
function safeToolState(raw: unknown): ToolPart['state'] {
  if (typeof raw === 'string') return raw as ToolPart['state'];
  if (raw && typeof raw === 'object') {
    const obj = raw as Record<string, unknown>;
    if (typeof obj.status === 'string') return obj.status as ToolPart['state'];
    if (typeof obj.type === 'string') return obj.type as ToolPart['state'];
  }
  return 'pending';
}

/** Ensure any value is safe to render inside JSX (never an object). */
function safeString(v: unknown): string {
  if (v == null) return '';
  if (typeof v === 'string') return v;
  try { return JSON.stringify(v, null, 2); } catch { return String(v); }
}

/** Parse skill Md URL to get path segments for file tree (e.g. ["skills", "find-skills", "SKILL.md"]). */
function getSkillPathSegments(skillMdUrl: string | undefined): string[] {
  if (!skillMdUrl) return [];
  try {
    // raw: .../owner/repo/main/path/to/SKILL.md  or  .../owner/repo/branch/path/SKILL.md
    const rawMatch = skillMdUrl.match(/githubusercontent\.com\/[^/]+\/[^/]+\/([^/]+)\/(.+)$/);
    if (rawMatch) return rawMatch[2].split('/').filter(Boolean);
    // jsDelivr: .../gh/owner/repo@main/path/to/SKILL.md
    const cdnMatch = skillMdUrl.match(/jsdelivr\.net\/gh\/[^/]+\/[^/]+@[^/]+\/(.+)$/);
    if (cdnMatch) return cdnMatch[1].split('/').filter(Boolean);
  } catch {
    /* ignore */
  }
  return [];
}

/**
 * Normalise a Part coming from SSE / the server so that every field that will
 * be rendered by React is a primitive (string / number / boolean), never a
 * raw object.  This prevents React Error #31.
 */
function normalizePart(part: Part): Part {
  if (part.type === 'tool') {
    const tp = part as ToolPart;
    const rawState = tp.state as unknown;
    // If state is an object, pull metadata out of it
    const stateObj =
      rawState && typeof rawState === 'object'
        ? (rawState as Record<string, unknown>)
        : null;

    return {
      ...tp,
      state: safeToolState(rawState),
      metadata: {
        ...tp.metadata,
        ...(stateObj
          ? {
              input: tp.metadata?.input ?? stateObj.input,
              output: tp.metadata?.output ?? stateObj.output,
            }
          : {}),
      },
    };
  }
  return part;
}

function mapRawPartToPart(
  raw: Record<string, unknown>,
  sessionId: string,
  messageId: string
): Part {
  const rawType = (raw.type as string) ?? 'text';
  if (rawType === 'tool-invocation' || rawType === 'tool') {
    return normalizePart({
      id: (raw.id as string) ?? `part-${Date.now()}-${Math.random()}`,
      sessionID: sessionId,
      messageID: messageId,
      type: 'tool',
      tool: (raw.tool as string) ?? (raw.toolName as string) ?? 'tool',
      callID: (raw.callID as string) ?? (raw.toolInvocationId as string) ?? (raw.id as string) ?? '',
      state: safeToolState(raw.state),
      metadata: {
        input: raw.args ?? raw.input,
        output: raw.result ?? raw.output,
      },
    });
  }

  if (rawType === 'reasoning') {
    return {
      id: (raw.id as string) ?? `part-${Date.now()}-${Math.random()}`,
      sessionID: sessionId,
      messageID: messageId,
      type: 'reasoning',
      text: (raw.reasoning as string) ?? (raw.text as string) ?? '',
    };
  }

  if (rawType === 'step-start' || rawType === 'step-finish') {
    return {
      id: (raw.id as string) ?? `part-${Date.now()}-${Math.random()}`,
      sessionID: sessionId,
      messageID: messageId,
      type: rawType as Part['type'],
      ...raw,
    } as Part;
  }

  return {
    id: (raw.id as string) ?? `part-${Date.now()}-${Math.random()}`,
    sessionID: sessionId,
    messageID: messageId,
    type: 'text',
    text: (raw.text as string) ?? '',
  } as Part;
}

function mapSessionMessagesToEntries(messages: Record<string, unknown>[], sessionId: string): ChatEntry[] {
  const loaded: ChatEntry[] = [];
  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    // Debug: log the top-level keys of each message so we can diagnose parsing mismatches
    console.log(`[SkillExec] mapSessionMessages msg[${i}] keys:`, Object.keys(msg), 'role:', msg.role);

    // The message might be wrapped in an `info` envelope depending on the
    // OpenCode server version.  Try both top-level and nested paths.
    const info = (msg.info as Record<string, unknown>) ?? msg;
    const role = (
      (info.role as string) ??
      (msg.role as string) ??
      ''
    ).toLowerCase();

    if (role === 'user') {
      const rawParts =
        (info.parts as Record<string, unknown>[]) ??
        (msg.parts as Record<string, unknown>[]);
      const textFromParts =
        rawParts
          ?.filter((p) => (p as Record<string, unknown>).type === 'text')
          .map((p) => {
            const t = (p as Record<string, unknown>).text;
            return typeof t === 'string' ? t : safeString(t);
          })
          .join('\n') || '';
      const textFromFallback =
        safeString(info.text ?? msg.text ?? info.content ?? msg.content);
      const text = textFromParts || textFromFallback;
      if (text) {
        const timeObj = (info.time ?? msg.time) as { created?: number } | undefined;
        loaded.push({
          type: 'user',
          text,
          time: timeObj?.created ?? Date.now(),
        });
      }
    } else if (role === 'assistant') {
      const messageId = (info.id as string) ?? (msg.id as string) ?? `msg-${Date.now()}`;
      const rawParts =
        (info.parts as Record<string, unknown>[]) ??
        (msg.parts as Record<string, unknown>[]);
      let chatParts: Part[] = (rawParts ?? []).map((p) =>
        normalizePart(mapRawPartToPart(p as Record<string, unknown>, sessionId, messageId))
      );
      if (chatParts.length === 0) {
        const fallbackText = safeString(info.text ?? msg.text ?? info.content ?? msg.content);
        if (fallbackText) {
          chatParts = [{
            id: `part-fallback-${Date.now()}`,
            sessionID: sessionId,
            messageID: messageId,
            type: 'text',
            text: fallbackText,
          }];
        }
      }
      loaded.push({
        type: 'assistant',
        messageId,
        parts: chatParts,
        isComplete: true,
        cost: (info.cost ?? msg.cost) as number | undefined,
        tokens: (info.tokens ?? msg.tokens) as AssistantEntry['tokens'] | undefined,
      });
    } else {
      // Unknown role — log for debugging but don't crash
      console.warn('[SkillExec] mapSessionMessagesToEntries: unknown role', role, 'keys:', Object.keys(msg));
    }
  }
  return loaded;
}

// ---------------------------------------------------------------------------
// Sub-components for rendering parts
// ---------------------------------------------------------------------------

function ToolStateIcon({ state }: { state: string }) {
  switch (state) {
    case 'completed':
      return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />;
    case 'running':
      return <Loader2 className="w-3.5 h-3.5 text-blue-400 animate-spin" />;
    case 'error':
      return <AlertCircle className="w-3.5 h-3.5 text-red-400" />;
    default:
      return <Clock className="w-3.5 h-3.5 text-zinc-400" />;
  }
}

function ToolPartView({ part }: { part: ToolPart }) {
  const [expanded, setExpanded] = useState(false);
  // Always normalise to primitives before rendering — prevents React Error #31
  const stateStr = safeToolState(part.state);
  const meta = part.metadata ?? {};
  const title = safeString(meta.title);
  const input = meta.input != null ? safeString(meta.input) : '';
  const output = meta.output != null ? safeString(meta.output) : '';
  const error = meta.error != null ? safeString(meta.error) : '';

  return (
    <div className="my-2 rounded-lg border border-zinc-700/60 bg-zinc-800/40 overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-zinc-700/30 transition-colors"
      >
        <ToolStateIcon state={stateStr} />
        <Wrench className="w-3.5 h-3.5 text-zinc-400" />
        <span className="text-sm font-medium text-zinc-200 truncate">
          {safeString(part.tool)}
        </span>
        {title && (
          <span className="text-xs text-zinc-400 truncate ml-1">{title}</span>
        )}
        <span className="ml-auto text-xs text-zinc-500 capitalize">{stateStr}</span>
        {expanded ? (
          <ChevronDown className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
        ) : (
          <ChevronRight className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
        )}
      </button>
      {expanded && (
        <div className="px-3 pb-3 space-y-2 border-t border-zinc-700/40">
          {input && (
            <div className="mt-2">
              <p className="text-xs text-zinc-500 mb-1">Input</p>
              <pre className="text-xs text-zinc-300 bg-zinc-900/60 rounded p-2 overflow-x-auto max-h-48 overflow-y-auto">
                {input}
              </pre>
            </div>
          )}
          {output && (
            <div>
              <p className="text-xs text-zinc-500 mb-1">Output</p>
              <pre className="text-xs text-zinc-300 bg-zinc-900/60 rounded p-2 overflow-x-auto max-h-48 overflow-y-auto">
                {output}
              </pre>
            </div>
          )}
          {error && (
            <div>
              <p className="text-xs text-red-400 mb-1">Error</p>
              <pre className="text-xs text-red-300 bg-red-900/20 rounded p-2 overflow-x-auto">
                {error}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ReasoningPartView({ part }: { part: ReasoningPart }) {
  const [expanded, setExpanded] = useState(false);
  if (!part.text) return null;
  return (
    <div className="my-2 rounded-lg border border-purple-800/40 bg-purple-900/10 overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-purple-800/10 transition-colors"
      >
        <Brain className="w-3.5 h-3.5 text-purple-400" />
        <span className="text-sm text-purple-300">Thinking...</span>
        <span className="ml-auto text-xs text-purple-500">
          {part.text.length} chars
        </span>
        {expanded ? (
          <ChevronDown className="w-3.5 h-3.5 text-purple-500 shrink-0" />
        ) : (
          <ChevronRight className="w-3.5 h-3.5 text-purple-500 shrink-0" />
        )}
      </button>
      {expanded && (
        <div className="px-3 pb-3 border-t border-purple-800/30">
          <pre className="mt-2 text-xs text-purple-200/80 whitespace-pre-wrap max-h-64 overflow-y-auto">
            {part.text}
          </pre>
        </div>
      )}
    </div>
  );
}

function TextPartView({ part }: { part: TextPart }) {
  if (!part.text) return null;
  return (
    <div className="prose prose-invert prose-sm max-w-none
      prose-pre:bg-zinc-900/80 prose-pre:border prose-pre:border-zinc-700/50
      prose-code:text-emerald-300 prose-code:bg-zinc-800/60 prose-code:px-1 prose-code:py-0.5 prose-code:rounded
      prose-a:text-blue-400 prose-headings:text-zinc-100"
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{part.text}</ReactMarkdown>
    </div>
  );
}

function FilePartView({ part }: { part: FilePart }) {
  return (
    <div className="my-2 flex items-center gap-2 px-3 py-2 rounded-lg border border-zinc-700/60 bg-zinc-800/40 text-sm">
      <FileText className="w-3.5 h-3.5 text-blue-400 shrink-0" />
      <span className="text-zinc-200">{part.filename ?? 'File'}</span>
      <span className="text-xs text-zinc-500">{part.mime}</span>
    </div>
  );
}

function PatchPartView({ part }: { part: PatchPart }) {
  return (
    <div className="my-2 flex items-center gap-2 px-3 py-2 rounded-lg border border-amber-800/40 bg-amber-900/10 text-sm">
      <GitBranch className="w-3.5 h-3.5 text-amber-400 shrink-0" />
      <span className="text-amber-200">Patch applied</span>
      {part.files?.length > 0 && (
        <span className="text-xs text-amber-400/70">
          {part.files.join(', ')}
        </span>
      )}
    </div>
  );
}

function StepFinishView({ part }: { part: StepFinishPart }) {
  return (
    <div className="my-1 flex items-center gap-3 px-3 py-1 text-xs text-zinc-500">
      <div className="h-px flex-1 bg-zinc-700/50" />
      <span>
        Step done
        {part.tokens && (
          <> · {part.tokens.input + part.tokens.output} tokens</>
        )}
        {typeof part.cost === 'number' && part.cost > 0 && (
          <> · ${part.cost.toFixed(4)}</>
        )}
      </span>
      <div className="h-px flex-1 bg-zinc-700/50" />
    </div>
  );
}

function SnapshotView() {
  return (
    <div className="my-1 flex items-center gap-2 px-3 py-1 text-xs text-zinc-500">
      <Camera className="w-3 h-3" />
      <span>Snapshot created</span>
    </div>
  );
}

// Render one part based on its type
function PartRenderer({ part }: { part: Part }) {
  switch (part.type) {
    case 'text':
      return <TextPartView part={part as TextPart} />;
    case 'tool':
      return <ToolPartView part={part as ToolPart} />;
    case 'reasoning':
      return <ReasoningPartView part={part as ReasoningPart} />;
    case 'step-start':
      return null; // We show step-finish instead
    case 'step-finish':
      return <StepFinishView part={part as StepFinishPart} />;
    case 'file':
      return <FilePartView part={part as FilePart} />;
    case 'patch':
      return <PatchPartView part={part as PatchPart} />;
    case 'snapshot':
      return <SnapshotView />;
    default:
      return null;
  }
}

// Render the assistant's response as an ordered list of parts
function AssistantMessageView({ entry }: { entry: AssistantEntry }) {
  // Determine what the AI is currently doing for status display
  const lastPart = entry.parts[entry.parts.length - 1];
  const isThinking = !entry.isComplete && lastPart?.type === 'reasoning';
  const isTooling = !entry.isComplete && lastPart?.type === 'tool';
  const toolName = isTooling ? (lastPart as ToolPart).tool : '';

  return (
    <div className="flex justify-start">
      <div className="max-w-[95%] w-full">
        <div className="flex items-center gap-2 mb-1.5">
          <div className="w-6 h-6 rounded-full bg-gradient-to-br from-violet-500 to-blue-500 flex items-center justify-center shadow-lg shadow-violet-500/20">
            <Sparkles className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="text-xs font-semibold text-zinc-300">Agent</span>
          {!entry.isComplete && (
            <div className="flex items-center gap-1.5 ml-1">
              <Loader2 className="w-3 h-3 text-blue-400 animate-spin" />
              <span className="text-[10px] text-blue-400/80 font-medium">
                {isThinking ? 'Thinking...' : isTooling ? `Running ${toolName}` : 'Working...'}
              </span>
            </div>
          )}
          {entry.isComplete && entry.tokens && (
            <span className="text-[10px] text-zinc-500 ml-auto">
              {entry.tokens.input + entry.tokens.output} tokens
              {typeof entry.cost === 'number' && entry.cost > 0 && ` · $${entry.cost.toFixed(4)}`}
            </span>
          )}
        </div>
        <div className="pl-8">
          {entry.parts.map((part, i) => (
            <PartRenderer key={part.id || `part-${i}`} part={part} />
          ))}
          {!entry.isComplete && entry.parts.length === 0 && (
            <div className="flex items-center gap-2.5 py-3 px-4 rounded-lg bg-zinc-800/30 border border-zinc-700/30">
              <div className="relative">
                <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />
                <div className="absolute inset-0 rounded-full bg-blue-400/10 animate-pulse" />
              </div>
              <span className="text-sm text-zinc-400">Thinking...</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// User message bubble
function UserMessageView({ entry }: { entry: UserEntry }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[80%] px-4 py-2.5 rounded-2xl rounded-br-md bg-blue-600 text-white text-sm whitespace-pre-wrap">
        {entry.text}
      </div>
    </div>
  );
}

// Todos sidebar display
function TodosView({ todos }: { todos: TodoItem[] }) {
  if (!todos.length) return null;
  return (
    <div className="px-3 py-2 border-b border-zinc-700/50">
      <div className="flex items-center gap-2 mb-2">
        <ListTodo className="w-3.5 h-3.5 text-zinc-400" />
        <span className="text-xs font-medium text-zinc-400 uppercase tracking-wide">Tasks</span>
      </div>
      <div className="space-y-1">
        {todos.map((todo) => (
          <div key={todo.id} className="flex items-center gap-2 text-xs">
            {todo.status === 'completed' ? (
              <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
            ) : todo.status === 'in_progress' ? (
              <Loader2 className="w-3 h-3 text-blue-400 animate-spin shrink-0" />
            ) : (
              <Circle className="w-3 h-3 text-zinc-500 shrink-0" />
            )}
            <span className={todo.status === 'completed' ? 'text-zinc-500 line-through' : 'text-zinc-300'}>
              {todo.content}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Question interactive panel
// ---------------------------------------------------------------------------

function QuestionPanel({
  question,
  onAnswer,
  onReject,
}: {
  question: QuestionEvent;
  onAnswer: (answers: string[][]) => void;
  onReject: () => void;
}) {
  console.log('[QuestionPanel] RENDERING with question:', question.id, 'questions:', question.questions?.length);

  const [selections, setSelections] = useState<Record<number, string[]>>({});
  const [customInputs, setCustomInputs] = useState<Record<number, string>>({});
  const [showCustom, setShowCustom] = useState<Record<number, boolean>>({});

  const handleOptionToggle = (qIdx: number, label: string, multiple?: boolean) => {
    console.log(`[QuestionPanel] Option toggled: qIdx=${qIdx}, label="${label}", multiple=${multiple}`);
    setSelections((prev) => {
      const current = prev[qIdx] ?? [];
      if (multiple) {
        // Multi-select: toggle
        return {
          ...prev,
          [qIdx]: current.includes(label)
            ? current.filter((l) => l !== label)
            : [...current, label],
        };
      }
      // Single-select: replace
      return { ...prev, [qIdx]: [label] };
    });
  };

  const handleSubmit = () => {
    const answers = question.questions.map((_q, idx) => {
      const selected = selections[idx] ?? [];
      const custom = customInputs[idx]?.trim();
      if (custom) return [...selected, custom];
      return selected;
    });
    console.log(`[QuestionPanel] SUBMIT answers:`, JSON.stringify(answers));
    onAnswer(answers);
  };

  const hasSelection = question.questions.some((_, idx) => {
    const sel = selections[idx] ?? [];
    const cust = customInputs[idx]?.trim();
    return sel.length > 0 || (cust && cust.length > 0);
  });

  return (
    <div className="mx-4 mb-3 rounded-xl border border-blue-500/30 bg-gradient-to-b from-blue-950/30 to-zinc-900/50 overflow-hidden shadow-lg shadow-blue-500/5">
      {/* Header */}
      <div className="px-4 py-3 bg-blue-500/10 border-b border-blue-500/20 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-blue-500/20 flex items-center justify-center">
            <MessageSquare className="w-3.5 h-3.5 text-blue-400" />
          </div>
          <div>
            <div className="text-xs font-semibold text-blue-200">Agent needs your input</div>
            <div className="text-[10px] text-blue-400/60">Select an option or type a response</div>
          </div>
        </div>
        <button
          onClick={onReject}
          className="text-xs text-zinc-500 hover:text-red-400 transition-colors duration-200 px-3 py-2 rounded-md hover:bg-red-500/10 cursor-pointer min-h-[36px] focus:outline-none focus:ring-2 focus:ring-red-500/30"
          title="Dismiss question"
          aria-label="Dismiss question"
        >
          Dismiss
        </button>
      </div>

      {/* Question groups */}
      {question.questions.map((q, qIdx) => (
        <div key={qIdx} className="px-4 py-4 border-b border-zinc-700/20 last:border-b-0">
          {q.header && (
            <div className="text-[11px] font-bold uppercase tracking-wider text-blue-400/70 mb-1">{q.header}</div>
          )}
          {q.question && (
            <div className="text-sm text-zinc-200 mb-3 leading-relaxed">{q.question}</div>
          )}
          <div className="grid gap-2" style={{ gridTemplateColumns: q.options.length > 4 ? 'repeat(auto-fill, minmax(140px, 1fr))' : `repeat(${Math.min(q.options.length, 3)}, 1fr)` }}>
            {q.options.map((opt, optIdx) => {
              const isSelected = (selections[qIdx] ?? []).includes(opt.label);
              return (
                <button
                  key={optIdx}
                  onClick={() => handleOptionToggle(qIdx, opt.label, q.multiple)}
                  className={`group relative text-left px-3 py-3 rounded-lg border transition-all duration-150 cursor-pointer min-h-[44px] focus:outline-none focus:ring-2 focus:ring-blue-500/40 ${
                    isSelected
                      ? 'bg-blue-600/20 border-blue-500/60 ring-1 ring-blue-500/30'
                      : 'bg-zinc-800/60 border-zinc-700/50 hover:border-blue-500/40 hover:bg-zinc-800'
                  }`}
                  aria-pressed={isSelected}
                >
                  <div className="flex items-start gap-2">
                    {q.multiple && (
                      <div className={`mt-0.5 w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 transition-colors ${
                        isSelected ? 'bg-blue-500 border-blue-400' : 'border-zinc-500'
                      }`}>
                        {isSelected && <CheckCircle2 className="w-2.5 h-2.5 text-white" />}
                      </div>
                    )}
                    {!q.multiple && (
                      <div className={`mt-0.5 w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                        isSelected ? 'border-blue-400' : 'border-zinc-500'
                      }`}>
                        {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-blue-400" />}
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className={`text-xs font-medium leading-snug ${isSelected ? 'text-blue-200' : 'text-zinc-200'}`}>
                        {opt.label}
                      </div>
                      {opt.description && (
                        <div className="text-[10px] text-zinc-500 mt-0.5 leading-snug line-clamp-2">
                          {opt.description}
                        </div>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
          {q.custom !== false && (
            <button
              onClick={() => setShowCustom((prev) => ({ ...prev, [qIdx]: !prev[qIdx] }))}
              className={`mt-2 px-3 py-2 text-xs rounded-lg border transition-all duration-200 cursor-pointer min-h-[36px] focus:outline-none focus:ring-2 focus:ring-blue-500/30 ${
                showCustom[qIdx]
                  ? 'bg-zinc-700 border-zinc-500 text-zinc-200'
                  : 'bg-zinc-800/40 border-zinc-700/40 text-zinc-500 hover:text-zinc-300 hover:border-zinc-600'
              }`}
            >
              <span className="mr-1">✎</span> Custom answer...
            </button>
          )}
          {showCustom[qIdx] && (
            <input
              type="text"
              value={customInputs[qIdx] ?? ''}
              onChange={(e) =>
                setCustomInputs((prev) => ({ ...prev, [qIdx]: e.target.value }))
              }
              onKeyDown={(e) => {
                if (e.key === 'Enter' && hasSelection) handleSubmit();
              }}
              placeholder="Type your custom answer…"
              className="mt-2 w-full px-3 py-2 text-sm bg-zinc-800/80 border border-zinc-600/50 rounded-lg
                text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500/50"
              autoFocus
            />
          )}
        </div>
      ))}

      {/* Actions */}
      <div className="px-4 py-3 bg-zinc-900/30 flex items-center justify-between">
        <span className="text-[10px] text-zinc-600">
          {Object.values(selections).flat().length} selected
        </span>
        <div className="flex gap-2">
          <button
            onClick={onReject}
            className="px-4 py-2 text-xs rounded-lg bg-zinc-800 border border-zinc-700/50 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700 transition-colors duration-200 cursor-pointer min-h-[36px] focus:outline-none focus:ring-2 focus:ring-zinc-500/30"
            aria-label="Skip question"
          >
            Skip
          </button>
          <button
            onClick={handleSubmit}
            disabled={!hasSelection}
            className="px-5 py-2 text-xs font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-500
              disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-150 cursor-pointer
              shadow-md shadow-blue-500/20 hover:shadow-blue-500/30 min-h-[36px]
              focus:outline-none focus:ring-2 focus:ring-blue-500/40 disabled:focus:ring-0"
            aria-label="Submit answer"
          >
            Submit Answer →
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Session sidebar
// ---------------------------------------------------------------------------

function SessionSidebar({
  sessions,
  currentSessionId,
  pendingQuestionSessionIds,
  onSelect,
  onNew,
  onDelete,
}: {
  sessions: SessionInfo[];
  currentSessionId: string | null;
  pendingQuestionSessionIds: Set<string>;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="w-56 border-r border-zinc-700/50 flex flex-col bg-zinc-900/60 shrink-0">
      <div className="p-3 border-b border-zinc-700/50 flex items-center justify-between">
        <span className="text-xs font-medium text-zinc-400 uppercase tracking-wide">Sessions</span>
        <button
          onClick={onNew}
          className="p-2 rounded hover:bg-zinc-700/50 text-zinc-400 hover:text-zinc-200 transition-colors duration-200 cursor-pointer min-w-[36px] min-h-[36px] flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-blue-500/30"
          title="New session"
          aria-label="Create new session"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto">
        {sessions.length === 0 && (
          <p className="p-3 text-xs text-zinc-500">No sessions yet</p>
        )}
        {sessions.map((s) => {
          const hasPendingQ = pendingQuestionSessionIds.has(s.id);
          return (
            <div
              key={s.id}
              className={`group flex items-center gap-2 px-3 py-2 cursor-pointer transition-colors ${
                s.id === currentSessionId
                  ? 'bg-zinc-700/40 text-zinc-100'
                  : hasPendingQ
                    ? 'text-blue-300 hover:bg-blue-900/20 hover:text-blue-200'
                    : 'text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-200'
              }`}
              onClick={() => onSelect(s.id)}
            >
              <MessageSquare className={`w-3.5 h-3.5 shrink-0 ${hasPendingQ ? 'text-blue-400' : ''}`} />
              <span className="text-xs truncate flex-1">{s.title || 'Untitled'}</span>
              {hasPendingQ && (
                <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse shrink-0" title="Awaiting your response" />
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(s.id);
                }}
                className="opacity-60 group-hover:opacity-100 p-1.5 rounded hover:bg-zinc-600/50 transition-all duration-200 cursor-pointer min-w-[28px] min-h-[28px] flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-red-500/30"
                title="Delete session"
                aria-label={`Delete session ${s.title || 'Untitled'}`}
              >
                <Trash2 className="w-3 h-3 text-zinc-500 hover:text-red-400" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function SkillExecutor({ skill, onClose }: SkillExecutorProps) {
  // Connection state
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(true);
  const [serverVersion, setServerVersion] = useState('');
  const [connectionError, setConnectionError] = useState<string | null>(null);

  // Session state
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [showSessions, setShowSessions] = useState(true);

  // Chat state
  const [entries, setEntries] = useState<ChatEntry[]>([]);
  const [input, setInput] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [sessionStatus, setSessionStatus] = useState('');
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [activeQuestion, setActiveQuestion] = useState<QuestionEvent | null>(null);
  const [pendingQuestionSessionIds, setPendingQuestionSessionIds] = useState<Set<string>>(new Set());

  // File attachment state
  const [attachedFiles, setAttachedFiles] = useState<Array<{
    id: string;
    file: File;
    dataUrl: string;
    mimeType: string;
    fileName: string;
  }>>([]);

  // Model state – fetched from the server
  const [models, setModels] = useState<ProviderModel[]>([]);
  const [selectedModel, setSelectedModel] = useState<ModelConfig | null>(null);
  const [showModelPicker, setShowModelPicker] = useState(false);

  // Skill loading state
  const [skillInstructions, setSkillInstructions] = useState<string | null>(null);
  const [skillLoadStatus, setSkillLoadStatus] = useState<'loading' | 'loaded' | 'error' | 'idle'>('idle');
  const [showSkillBanner, setShowSkillBanner] = useState(true);
  const [showViewInstructions, setShowViewInstructions] = useState(false);

  // Edit & Save modal state
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingSkill, setEditingSkill] = useState<Partial<Skill>>({});
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // ── Connect on mount ────────────────────────────────────────────────────

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { version } = await opencode.connect();
        if (cancelled) return;
        setConnected(true);
        setServerVersion(version);

        // Load existing sessions
        try {
          const list = await opencode.listSessions();
          if (!cancelled) setSessions(list);
        } catch {
          // Not critical if listing fails
        }

        // Fetch pending questions to mark sessions that need attention
        try {
          const pending = await opencode.listPendingQuestions();
          if (!cancelled && pending.length > 0) {
            const sessionIds = new Set(pending.map(q => q.sessionID));
            setPendingQuestionSessionIds(sessionIds);
            console.log(`[SkillExecutor] Found ${pending.length} pending questions in ${sessionIds.size} sessions`);
          }
        } catch {
          // Not critical
        }

        // Fetch available models from the server
        try {
          const { models: serverModels, defaultModel } =
            await opencode.getModels();
          if (!cancelled && serverModels.length > 0) {
            setModels(serverModels);
            setSelectedModel(defaultModel ?? {
              providerID: serverModels[0].providerID,
              modelID: serverModels[0].modelID,
            });
          }
        } catch {
          // Not critical – user just can't pick models
        }

        // Fetch SKILL.md for this skill (if available)
        const mdUrl = skill.skillMdUrl;
        if (mdUrl) {
          if (!cancelled) setSkillLoadStatus('loading');
          try {
            const parsed = await fetchSkillMd(mdUrl);
            if (!cancelled) {
              setSkillInstructions(parsed.instructions);
              setSkillLoadStatus('loaded');
            }
          } catch (err) {
            console.warn('[SkillExecutor] Failed to fetch SKILL.md:', err);
            if (!cancelled) {
              // Fall back to config.systemPrompt or description
              const fallback = skill.config.systemPrompt || skill.description;
              setSkillInstructions(fallback || null);
              setSkillLoadStatus(fallback ? 'loaded' : 'error');
            }
          }
        } else {
          // No SKILL.md URL — use config.systemPrompt or description
          const fallback = skill.config.systemPrompt || skill.description;
          if (!cancelled) {
            setSkillInstructions(fallback || null);
            setSkillLoadStatus(fallback ? 'loaded' : 'idle');
          }
        }
      } catch (err: unknown) {
        if (cancelled) return;
        setConnectionError((err as Error).message);
      } finally {
        if (!cancelled) setConnecting(false);
      }
    })();
    return () => {
      cancelled = true;
      opencode.cleanup();
    };
  }, [skill]);

  // ── Auto-scroll ─────────────────────────────────────────────────────────

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [entries]);

  // ── Greeting: skill introduces itself on first open ─────────────────────

  useEffect(() => {
    if (!connected || connecting || entries.length > 0 || currentSessionId) return;
    const greeting: AssistantEntry = {
      type: 'assistant',
      messageId: `greeting-${Date.now()}`,
      parts: [{
        id: `greeting-part-${Date.now()}`,
        sessionID: '',
        messageID: `greeting-${Date.now()}`,
        type: 'text' as const,
        text: `👋 Hi! I'm **${skill.name}**.\n\n${skill.description}\n\nHow can I help you today?`,
      }],
      isComplete: true,
    };
    setEntries([greeting]);
  }, [connected, connecting, currentSessionId, entries.length, skill.name, skill.description]);

  // ── Debug: log activeQuestion state changes ─────────────────────────────

  useEffect(() => {
    if (activeQuestion) {
      console.log(`[SkillExec] ★ activeQuestion SET:`, JSON.stringify(activeQuestion).slice(0, 400));
      console.log(`[SkillExec] ★ activeQuestion.questions.length = ${activeQuestion.questions?.length ?? 0}`);
      console.log(`[SkillExec] ★ QuestionPanel SHOULD RENDER: ${activeQuestion.questions?.length > 0 ? 'YES' : 'NO (empty questions array)'}`);
    } else {
      console.log('[SkillExec] activeQuestion CLEARED (null)');
    }
  }, [activeQuestion]);

  // ── Close model picker on outside click ─────────────────────────────────

  useEffect(() => {
    if (!showModelPicker) return;
    const handler = (e: MouseEvent) => {
      if (!(e.target as Element).closest('.model-picker')) {
        setShowModelPicker(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showModelPicker]);

  // ── Create a new session ────────────────────────────────────────────────

  const createNewSession = useCallback(async () => {
    // If a stream is running, abort it first
    if (isRunning) {
      opencode.cleanup();
      if (currentSessionId) {
        try { await opencode.abortSession(currentSessionId); } catch { /* ignore */ }
      }
      setIsRunning(false);
      setSessionStatus('idle');
    }
    setActiveQuestion(null);

    try {
      const session = await opencode.createSession(skill.name);
      setSessions((prev) => [session, ...prev]);
      setCurrentSessionId(session.id);
      setEntries([]);
      setTodos([]);
      return session.id;
    } catch (err: unknown) {
      setConnectionError(`Failed to create session: ${(err as Error).message}`);
      return null;
    }
  }, [skill.name, isRunning, currentSessionId]);

  // ── Switch session ──────────────────────────────────────────────────────

  const switchSession = useCallback(async (id: string) => {
    if (id === currentSessionId) return;

    // If a stream is running, abort it first before switching
    if (isRunning) {
      opencode.cleanup();
      if (currentSessionId) {
        try { await opencode.abortSession(currentSessionId); } catch { /* ignore */ }
      }
      setIsRunning(false);
      setSessionStatus('idle');
    }

    const prevEntries = entries;
    setCurrentSessionId(id);
    setTodos([]);
    setActiveQuestion(null);

    // Load message history from the server
    try {
      const t0 = performance.now();
      console.log(`[SkillExecutor] switchSession(${id}) start`);
      const messages = await opencode.getSessionMessages(id);
      console.log(
        `[SkillExecutor] switchSession(${id}) got ${messages.length} messages in +${(performance.now() - t0).toFixed(0)}ms`
      );

      if (!Array.isArray(messages) || messages.length === 0) {
        console.warn(`[SkillExecutor] switchSession(${id}) has no messages`);
        setEntries([]);
      } else {
        const loaded = mapSessionMessagesToEntries(messages, id);
        console.log(`[SkillExecutor] switchSession(${id}) parsed entries=${loaded.length}`);
        if (loaded.length === 0) {
          console.warn(`[SkillExecutor] switchSession(${id}) parse result empty`, messages);
          setEntries([]);
        } else {
          setEntries(loaded);
        }
      }
    } catch (err) {
      console.warn('[SkillExecutor] Failed to load session messages:', err);
      // Keep previous content if fetch failed, avoid "click -> blank".
      setEntries(prevEntries);
    }

    // After loading history, check for pending questions for this session
    try {
      const pending = await opencode.listPendingQuestions(id);
      console.log(`[SkillExecutor] switchSession(${id}) pending questions: ${pending.length}`);
      if (pending.length > 0) {
        console.log(`[SkillExecutor] switchSession(${id}) ★ restoring pending question:`, JSON.stringify(pending[0]).slice(0, 300));
        setActiveQuestion(pending[0]);
      }
    } catch (err) {
      console.warn('[SkillExecutor] Failed to check pending questions:', err);
    }
  }, [isRunning, currentSessionId, entries]);

  // ── Delete session ──────────────────────────────────────────────────────

  const deleteSession = useCallback(async (id: string) => {
    try {
      await opencode.deleteSession(id);
      setSessions((prev) => prev.filter((s) => s.id !== id));
      if (currentSessionId === id) {
        setCurrentSessionId(null);
        setEntries([]);
        setTodos([]);
      }
    } catch {
      // ignore
    }
  }, [currentSessionId]);

  // ── File handling ────────────────────────────────────────────────────────

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB per file
    const validFiles: File[] = [];
    const rejectedFiles: string[] = [];

    Array.from(files).forEach((file) => {
      if (file.size > MAX_FILE_SIZE) {
        rejectedFiles.push(`${file.name} (${(file.size / 1024 / 1024).toFixed(1)}MB)`);
      } else {
        validFiles.push(file);
      }
    });

    if (rejectedFiles.length > 0) {
      console.warn('[SkillExec] Rejected oversized files:', rejectedFiles);
      setConnectionError(`Files too large (max 10MB): ${rejectedFiles.join(', ')}`);
      setTimeout(() => setConnectionError(null), 5000);
    }

    if (validFiles.length === 0) {
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    const newFiles = await Promise.all(
      validFiles.map(async (file) => {
        const reader = new FileReader();
        return new Promise<{
          id: string;
          file: File;
          dataUrl: string;
          mimeType: string;
          fileName: string;
        }>((resolve, reject) => {
          reader.onload = () => {
            resolve({
              id: `file-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
              file,
              dataUrl: reader.result as string,
              mimeType: file.type || 'application/octet-stream',
              fileName: file.name,
            });
          };
          reader.onerror = () => reject(new Error(`Failed to read ${file.name}`));
          reader.readAsDataURL(file);
        });
      })
    ).catch((err) => {
      console.error('[SkillExec] Error reading files:', err);
      setConnectionError(`Failed to read file: ${(err as Error).message}`);
      setTimeout(() => setConnectionError(null), 5000);
      return [];
    });

    if (newFiles.length > 0) {
      setAttachedFiles((prev) => [...prev, ...newFiles]);
    }

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  const removeFile = useCallback((id: string) => {
    setAttachedFiles((prev) => prev.filter((f) => f.id !== id));
  }, []);

  const getFileIcon = (mimeType: string) => {
    if (mimeType.startsWith('image/')) {
      return Image;
    }
    return File;
  };

  const isImageFile = (mimeType: string) => {
    return mimeType.startsWith('image/');
  };

  // ── Send message ────────────────────────────────────────────────────────

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if ((!text && attachedFiles.length === 0) || isRunning || !connected) return;

    // Prepare file attachments
    const files: FileAttachment[] = attachedFiles.map((f) => ({
      id: f.id,
      mimeType: f.mimeType,
      fileName: f.fileName,
      dataUrl: f.dataUrl,
    }));

    setInput('');
    setAttachedFiles([]); // Clear files after sending
    setIsRunning(true);
    setConnectionError(null);
    setActiveQuestion(null);

    // Ensure we have a session
    let sid = currentSessionId;
    if (!sid) {
      sid = await createNewSession();
      if (!sid) {
        setIsRunning(false);
        return;
      }
    }

    // Add user entry and an immediate assistant placeholder so the UI gives
    // instant feedback even before the first streamed part arrives.
    const userEntry: UserEntry = { type: 'user', text, time: Date.now() };
    const pendingAssistantId = `pending-${Date.now()}`;
    const pendingAssistantEntry: AssistantEntry = {
      type: 'assistant',
      messageId: pendingAssistantId,
      parts: [],
      isComplete: false,
    };
    setEntries((prev) => [...prev, userEntry, pendingAssistantEntry]);

    // Stream callbacks — with timestamp logging to diagnose real-time issues
    const cbT0 = performance.now();
    const cbTs = () => `+${(performance.now() - cbT0).toFixed(0)}ms`;
    let partUpdateCount = 0;

    const callbacks = {
      onPartUpdated: (rawPart: Part, delta?: string) => {
        // Normalise every incoming part so that object-typed fields (especially
        // tool state) never reach React's reconciler as raw objects.
        const part = normalizePart(rawPart);

        partUpdateCount++;
        const textSnippet =
          part.type === 'text'
            ? `"${(part as TextPart).text?.slice(0, 80)}…"`
            : part.type;
        console.log(
          `[SkillExec] ${cbTs()} onPartUpdated #${partUpdateCount}: type=${part.type}, ` +
          `delta=${delta ? delta.length + 'ch' : 'none'}, id=${part.id}, preview=${textSnippet}`
        );

        setEntries((prev) => {
          // Find existing assistant entry for this messageID
          const idx = prev.findIndex(
            (e) => e.type === 'assistant' && e.messageId === part.messageID
          );

          if (idx >= 0) {
            // Update existing entry
            const entry = prev[idx] as AssistantEntry;
            const partIdx = entry.parts.findIndex((p) => p.id === part.id);

            let newParts: Part[];
            if (partIdx >= 0) {
              // Update existing part
              newParts = [...entry.parts];
              if (part.type === 'text') {
                if (delta) {
                  // Server sent an incremental delta – append it
                  newParts[partIdx] = {
                    ...newParts[partIdx],
                    text: ((newParts[partIdx] as TextPart).text || '') + delta,
                  } as TextPart;
                } else {
                  // Server sent the full accumulated text – use it directly
                  newParts[partIdx] = { ...part };
                }
              } else {
                newParts[partIdx] = normalizePart({ ...newParts[partIdx], ...part });
              }
            } else {
              // Add new part
              newParts = [...entry.parts, { ...part }];
            }

            const newEntries = [...prev];
            newEntries[idx] = { ...entry, parts: newParts };
            return newEntries;
          } else {
            // If we already have a pending placeholder bubble, bind it to this
            // real messageID instead of appending a duplicate bubble.
            const pendingIdx = prev.findIndex(
              (e) =>
                e.type === 'assistant' &&
                !e.isComplete &&
                e.messageId.startsWith('pending-')
            );
            if (pendingIdx >= 0) {
              const pendingEntry = prev[pendingIdx] as AssistantEntry;
              const next = [...prev];
              next[pendingIdx] = {
                ...pendingEntry,
                messageId: part.messageID,
                parts: [{ ...part }],
              };
              return next;
            }

            // Create new assistant entry
            console.log(`[SkillExec] ${cbTs()} creating new assistant entry for messageId=${part.messageID}`);
            const newEntry: AssistantEntry = {
              type: 'assistant',
              messageId: part.messageID,
              parts: [{ ...part }],
              isComplete: false,
            };
            return [...prev, newEntry];
          }
        });
      },

      onMessageUpdated: (message: Record<string, unknown>) => {
        console.log(
          `[SkillExec] ${cbTs()} onMessageUpdated: role=${message.role}, finish=${message.finish}, id=${message.id}`
        );
        if (message.role === 'assistant') {
          setEntries((prev) =>
            {
              const messageId = message.id as string | undefined;
              const assistantMessageId = messageId ?? pendingAssistantId;

              const exactIdx = messageId
                ? prev.findIndex(
                    (e) => e.type === 'assistant' && e.messageId === messageId
                  )
                : -1;

              const pendingIdx = prev.findIndex(
                (e) =>
                  e.type === 'assistant' &&
                  !e.isComplete &&
                  e.messageId.startsWith('pending-')
              );

              const targetIdx = exactIdx >= 0 ? exactIdx : pendingIdx;
              if (targetIdx < 0) return prev;

              const next = [...prev];
              const target = next[targetIdx] as AssistantEntry;
              next[targetIdx] = {
                ...target,
                messageId: assistantMessageId,
                isComplete: message.finish === 'stop',
                cost: (message.cost as number) ?? target.cost,
                tokens: (message.tokens as AssistantEntry['tokens']) ?? target.tokens,
              };
              return next;
            }
          );
        }
      },

      onSessionStatus: (status: string) => {
        console.log(`[SkillExec] ${cbTs()} onSessionStatus: "${status}"`);
        setSessionStatus(status);
      },

      onComplete: () => {
        console.log(`[SkillExec] ${cbTs()} onComplete (total part updates: ${partUpdateCount})`);
        setIsRunning(false);
        setSessionStatus('idle');
        // Mark all incomplete assistant entries as complete
        setEntries((prev) =>
          prev.map((e) =>
            e.type === 'assistant' && !e.isComplete ? { ...e, isComplete: true } : e
          )
        );
      },

      onError: (error: string) => {
        console.error(`[SkillExec] ${cbTs()} onError: ${error}`);
        setIsRunning(false);
        setConnectionError(error);
        // Add error as a text part in the current assistant message
        setEntries((prev) => {
          const last = prev[prev.length - 1];
          if (last?.type === 'assistant' && !last.isComplete) {
            const errorPart: TextPart = {
              id: `error-${Date.now()}`,
              sessionID: sid!,
              messageID: last.messageId,
              type: 'text',
              text: `\n\n**Error:** ${error}`,
            };
            return [
              ...prev.slice(0, -1),
              { ...last, parts: [...last.parts, errorPart], isComplete: true },
            ];
          }
          // Add standalone error entry
          return [
            ...prev,
            {
              type: 'assistant' as const,
              messageId: `error-${Date.now()}`,
              parts: [{
                id: `error-${Date.now()}`,
                sessionID: sid!,
                messageID: `error-${Date.now()}`,
                type: 'text' as const,
                text: `**Error:** ${error}`,
              }],
              isComplete: true,
            },
          ];
        });
      },

      onTodos: (newTodos: TodoItem[]) => {
        setTodos(newTodos);
      },

      onQuestion: (question: QuestionEvent) => {
        console.log(`[SkillExec] ${cbTs()} ★★★ onQuestion FIRED ★★★`);
        console.log(`[SkillExec] ${cbTs()} onQuestion id=${question.id}, sessionID=${question.sessionID}, questions.length=${question.questions?.length ?? 0}`);
        console.log(`[SkillExec] ${cbTs()} onQuestion full:`, JSON.stringify(question).slice(0, 500));
        if (question.questions) {
          question.questions.forEach((q, i) => {
            console.log(`[SkillExec] ${cbTs()} onQuestion q[${i}]: header="${q.header}", question="${q.question}", options=${q.options?.length ?? 0}, multiple=${q.multiple}, custom=${q.custom}`);
          });
        }
        // When the AI asks a question, it's waiting for user input.
        // Store the question so we can show interactive UI
        setActiveQuestion(question);
        // Mark the current response as complete and stop "running" state
        // so the user can type their answer in the input box.
        setIsRunning(false);
        setSessionStatus('idle');
        // Mark incomplete assistant entries as complete so the UI
        // doesn't show a perpetual spinner
        setEntries((prev) =>
          prev.map((e) =>
            e.type === 'assistant' && !e.isComplete ? { ...e, isComplete: true } : e
          )
        );
        // Focus the input so user can immediately type their response
        setTimeout(() => inputRef.current?.focus(), 100);
      },
    };

    // Poll fallback: when SSE is proxy-buffered, pull snapshots periodically so
    // the UI still progresses between bursty chunks.
    let polling = true;
    let pollingInFlight = false;
    const pollFromSessionSnapshot = async () => {
      if (!polling || pollingInFlight) return;
      pollingInFlight = true;
      try {
        const snapshot = await opencode.getSession(sid!);
        const messages = snapshot.messages as Record<string, unknown>[] | undefined;
        if (!messages || !Array.isArray(messages) || messages.length === 0) return;

        // Check both top-level and info-envelope role (same approach as mapSessionMessagesToEntries)
        const assistantMsgs = messages.filter((m) => {
          const info = (m.info as Record<string, unknown>) ?? m;
          const role = ((info.role as string) ?? (m.role as string) ?? '').toLowerCase();
          return role === 'assistant';
        });
        const latest = assistantMsgs[assistantMsgs.length - 1];
        if (!latest) return;

        const latestInfo = (latest.info as Record<string, unknown>) ?? latest;
        const messageId = (latestInfo.id as string) ?? (latest.id as string) ?? '';
        if (!messageId) return;
        const rawParts = (latestInfo.parts as Record<string, unknown>[]) ?? (latest.parts as Record<string, unknown>[] | undefined);
        const snapshotParts = (rawParts ?? []).map((p) =>
          normalizePart(mapRawPartToPart(p, sid!, messageId))
        );

        setEntries((prev) => {
          const idx = prev.findIndex((e) => e.type === 'assistant' && e.messageId === messageId);
          if (idx >= 0) {
            const current = prev[idx] as AssistantEntry;
            const currentTextSize = current.parts
              .filter((p) => p.type === 'text')
              .map((p) => (p as TextPart).text || '')
              .join('').length;
            const snapshotTextSize = snapshotParts
              .filter((p) => p.type === 'text')
              .map((p) => (p as TextPart).text || '')
              .join('').length;

            if (snapshotParts.length <= current.parts.length && snapshotTextSize <= currentTextSize) {
              return prev;
            }

            const next = [...prev];
            next[idx] = { ...current, parts: snapshotParts };
            return next;
          }

          const nextAssistant: AssistantEntry = {
            type: 'assistant',
            messageId,
            parts: snapshotParts,
            isComplete: false,
            cost: latest.cost as number | undefined,
            tokens: latest.tokens as AssistantEntry['tokens'] | undefined,
          };
          return [...prev, nextAssistant];
        });
      } catch {
        // snapshot polling is best-effort
      } finally {
        pollingInFlight = false;
      }
    };

    const pollTimer = window.setInterval(() => {
      void pollFromSessionSnapshot();
    }, 1200);

    const systemParts: string[] = [];
    systemParts.push(
      `You are the skill "${skill.name}". ${skill.description} When the user asks what skill you are, what skill is active, or "你是什么 skill", answer clearly that you are the "${skill.name}" skill.`
    );
    const instructions = skillInstructions || skill.config.systemPrompt;
    if (instructions) {
      systemParts.push('\n\n--- Skill instructions ---\n\n');
      systemParts.push(instructions);
    }
    const isFindSkills = skill.id === 'find-skills' || String(skill.id).endsWith('find-skills');
    if (isFindSkills) {
      systemParts.push('\n\n--- Candy Shop catalog (id - name). In this browser environment npx skills find cannot run; use the list below to suggest skills when the user asks e.g. "有没有写论文的 skill". ---\n');
      const catalogLines = SKILLS_DATA.filter((s) => s?.id != null && s?.name != null).map((s) => `${s.id} - ${s.name}`);
      systemParts.push(catalogLines.join('\n'));
      systemParts.push('\n\nWhen the user asks for skills (thesis, paper, writing, etc.), suggest matching skills from the list above by id and name, and mention they can run them here or browse https://skills.sh for more.');
    }
    const systemPrompt = systemParts.length ? systemParts.join('') : undefined;

    try {
      await opencode.sendMessage(sid, text, callbacks, {
        model: selectedModel ?? undefined,
        system: systemPrompt,
        files: files.length > 0 ? files : undefined,
      });
    } finally {
      polling = false;
      window.clearInterval(pollTimer);
    }
  }, [input, attachedFiles, isRunning, connected, currentSessionId, createNewSession, selectedModel, skill.id, skill.name, skill.description, skillInstructions, skill.config.systemPrompt]);

  // ── Abort ───────────────────────────────────────────────────────────────

  const handleAbort = useCallback(async () => {
    opencode.cleanup();
    if (currentSessionId) {
      try {
        await opencode.abortSession(currentSessionId);
      } catch {
        // ignore
      }
    }
    setIsRunning(false);
    setEntries((prev) =>
      prev.map((e) =>
        e.type === 'assistant' && !e.isComplete ? { ...e, isComplete: true } : e
      )
    );
  }, [currentSessionId]);

  // ── Edit & Save as My Skill ────────────────────────────────────────────

  const handleOpenEditModal = () => {
    setEditingSkill({
      id: `custom-${skill.id}-${Date.now()}`,
      name: skill.name,
      description: skill.description,
      category: skill.category,
      icon: skill.icon,
      color: skill.color,
      config: {
        ...skill.config,
        systemPrompt: skillInstructions || skill.config?.systemPrompt || skill.description,
      },
      origin: 'created' as const,
    });
    setShowEditModal(true);
  };

  const handleSaveAsMySkill = async () => {
    setSaveStatus('saving');
    try {
      storageUtils.saveSkill(editingSkill);
      setSaveStatus('success');
      setTimeout(() => {
        setShowEditModal(false);
        setSaveStatus('idle');
      }, 1500);
    } catch (error) {
      console.error('Failed to save skill:', error);
      setSaveStatus('error');
    }
  };

  // ── Keyboard ────────────────────────────────────────────────────────────

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────

  // Connection screen
  if (connecting) {
    return (
      <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[110] backdrop-blur-md">
        <div className="bg-[#0d1117] rounded-2xl p-8 max-w-sm w-full mx-4 text-center border border-white/[0.06] shadow-2xl shadow-black/50">
          <Loader2 className="w-8 h-8 text-blue-400 animate-spin mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-zinc-100 mb-2">Connecting to OpenCode</h3>
          <p className="text-sm text-zinc-500">Establishing connection to server...</p>
        </div>
      </div>
    );
  }

  if (connectionError && !connected) {
    return (
      <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[110] backdrop-blur-md">
        <div className="bg-[#0d1117] rounded-2xl p-8 max-w-md w-full mx-4 text-center border border-white/[0.06] shadow-2xl shadow-black/50">
          <AlertCircle className="w-10 h-10 text-red-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-zinc-100 mb-2">Connection Failed</h3>
          <p className="text-sm text-red-400/80 mb-1">{connectionError}</p>
          <p className="text-xs text-zinc-600 mb-6 mt-2">
            Check your network connection and ensure the OpenCode server is running.
          </p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => {
                setConnecting(true);
                setConnectionError(null);
                opencode.connect()
                  .then(({ version }) => {
                    setConnected(true);
                    setServerVersion(version);
                  })
                  .catch((err) => setConnectionError((err as Error).message))
                  .finally(() => setConnecting(false));
              }}
              disabled={connecting}
              className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-blue-500 text-white text-sm rounded-lg hover:from-blue-500 hover:to-blue-400 transition-all duration-200 cursor-pointer min-h-[40px] disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500/50 shadow-lg shadow-blue-500/20"
              aria-label="Retry connection"
            >
              {connecting ? 'Connecting...' : 'Retry'}
            </button>
            <button
              onClick={onClose}
              className="px-5 py-2.5 bg-white/[0.06] text-zinc-300 text-sm rounded-lg hover:bg-white/[0.1] transition-all duration-200 cursor-pointer min-h-[40px] focus:outline-none focus:ring-2 focus:ring-zinc-500/50 border border-white/[0.06]"
              aria-label="Close"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Build GitHub URL from skill.repo if available
  const githubUrl = skill.repo
    ? `https://github.com/${skill.repo}`
    : skill.skillMdUrl
      ? (() => {
        const m = skill.skillMdUrl!.match(/github(?:usercontent)?\.com\/([^/]+\/[^/]+)/);
        return m ? `https://github.com/${m[1]}` : null;
      })()
      : null;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[110] backdrop-blur-md">
      <div className="bg-[#0d1117] rounded-2xl w-full max-w-7xl h-[92vh] mx-4 overflow-hidden flex flex-col border border-white/[0.06] shadow-2xl shadow-black/50">
        {/* ── Header ─────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/[0.06] bg-gradient-to-r from-[#161b22] to-[#0d1117] shrink-0">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-blue-600 flex items-center justify-center text-xl shadow-lg shadow-violet-500/20 ring-1 ring-white/10">
              {skill.icon}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold text-white">{skill.name}</h2>
                {githubUrl && (
                  <a
                    href={githubUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-white/[0.06] hover:bg-white/[0.12] text-zinc-400 hover:text-white transition-all duration-200 text-[11px] font-medium"
                    title="View on GitHub"
                  >
                    <Github className="w-3 h-3" />
                    <span className="hidden sm:inline">Source</span>
                    <ExternalLink className="w-2.5 h-2.5 opacity-50" />
                  </a>
                )}
              </div>
              <div className="flex items-center gap-2.5 text-xs mt-0.5">
                <span className="flex items-center gap-1.5 text-emerald-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Connected
                </span>
                {serverVersion && (
                  <span className="text-zinc-600">v{serverVersion}</span>
                )}
                {sessionStatus && sessionStatus !== 'idle' && (
                  <span className="text-blue-400 flex items-center gap-1">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    {sessionStatus}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Sessions toggle (mobile) */}
            <button
              onClick={() => setShowSessions(!showSessions)}
              className="md:hidden p-2.5 rounded-lg hover:bg-white/[0.06] text-zinc-500 hover:text-zinc-200 transition-colors"
              title="Toggle sessions"
            >
              <MessageSquare className="w-4 h-4" />
            </button>

            {/* Model picker */}
            <div className="relative model-picker">
              <button
                onClick={() => setShowModelPicker(!showModelPicker)}
                className="flex items-center gap-2 px-3 py-2 text-xs border border-white/[0.08] rounded-lg hover:bg-white/[0.06] text-zinc-400 hover:text-zinc-200 transition-all duration-200 cursor-pointer min-h-[36px] focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                aria-label="Select model"
                aria-expanded={showModelPicker}
              >
                <Settings className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">
                  {selectedModel
                    ? models.find(
                        (m) =>
                          m.providerID === selectedModel.providerID &&
                          m.modelID === selectedModel.modelID
                      )?.name ?? selectedModel.modelID
                    : 'Select model'}
                </span>
                <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${showModelPicker ? 'rotate-180' : ''}`} />
              </button>
              {showModelPicker && (
                <div className="absolute right-0 mt-2 w-72 bg-[#161b22] border border-white/[0.08] rounded-xl shadow-2xl z-50 overflow-hidden">
                  <div className="p-2.5 border-b border-white/[0.06] bg-white/[0.02]">
                    <p className="text-xs font-medium text-zinc-400">Select Model</p>
                  </div>
                  <div className="max-h-80 overflow-y-auto">
                    {models.length === 0 && (
                      <p className="px-3 py-2 text-xs text-zinc-500">
                        No models available
                      </p>
                    )}
                    {/* Group by provider */}
                    {Array.from(new Set(models.map((m) => m.providerID))).map(
                      (pid) => (
                        <div key={pid}>
                          <div className="px-3 py-1.5 text-[10px] font-semibold text-zinc-600 uppercase tracking-wider bg-[#0d1117]/40">
                            {models.find((m) => m.providerID === pid)
                              ?.providerName ?? pid}
                          </div>
                          {models
                            .filter((m) => m.providerID === pid)
                            .map((model) => {
                              const isSelected =
                                selectedModel?.providerID ===
                                  model.providerID &&
                                selectedModel?.modelID === model.modelID;
                              return (
                                <button
                                  key={`${model.providerID}/${model.modelID}`}
                                  onClick={() => {
                                    setSelectedModel({
                                      providerID: model.providerID,
                                      modelID: model.modelID,
                                    });
                                    setShowModelPicker(false);
                                  }}
                                  className={`w-full text-left px-3 py-2.5 text-xs hover:bg-white/[0.06] transition-colors duration-150 flex items-center gap-2 cursor-pointer min-h-[36px] focus:outline-none focus:ring-2 focus:ring-blue-500/30 ${
                                    isSelected
                                    ? 'bg-blue-600/15 text-blue-300 font-medium'
                                      : 'text-zinc-300'
                                  }`}
                                  aria-pressed={isSelected}
                                >
                                  <span className="truncate flex-1">
                                    {model.name}
                                  </span>
                                  {model.reasoning && (
                                    <span className="text-[9px] px-1 py-0.5 rounded bg-purple-800/40 text-purple-300">
                                      reasoning
                                    </span>
                                  )}
                                </button>
                              );
                            })}
                        </div>
                      )
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Close */}
            <button
              onClick={onClose}
              className="p-2.5 rounded-lg hover:bg-white/[0.06] text-zinc-500 hover:text-zinc-200 transition-all duration-200 cursor-pointer min-w-[40px] min-h-[40px] flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-zinc-500/30"
              aria-label="Close skill executor"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ── Body ───────────────────────────────────────────────────── */}
        <div className="flex-1 flex overflow-hidden">
          {/* Session sidebar */}
          {showSessions && (
            <SessionSidebar
              sessions={sessions}
              currentSessionId={currentSessionId}
              pendingQuestionSessionIds={pendingQuestionSessionIds}
              onSelect={switchSession}
              onNew={async () => { await createNewSession(); }}
              onDelete={deleteSession}
            />
          )}

          {/* Main chat area */}
          <div className="flex-1 flex flex-col min-w-0">
            {/* Todos bar */}
            <TodosView todos={todos} />

            {/* Session status bar — shows when AI is working */}
            {isRunning && (
              <div className="shrink-0 px-5 py-3 bg-gradient-to-r from-blue-950/30 via-blue-950/10 to-transparent border-b border-blue-500/10">
                <div className="flex items-center gap-3">
                  <div className="relative flex items-center justify-center w-5 h-5">
                    <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />
                  </div>
                  <span className="text-sm text-blue-300/90 font-medium">
                    {sessionStatus === 'busy' ? 'Agent is working...' : sessionStatus || 'Processing...'}
                  </span>
                  <div className="flex-1 h-0.5 bg-zinc-800/50 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-blue-500 to-violet-500 rounded-full animate-pulse" style={{ width: '60%' }} />
                  </div>
                  <button
                    onClick={handleAbort}
                    className="px-3 py-1.5 text-xs rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 border border-red-500/10 transition-all duration-200 cursor-pointer focus:outline-none focus:ring-2 focus:ring-red-500/30"
                    aria-label="Stop agent"
                  >
                    Stop
                  </button>
                </div>
              </div>
            )}

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Skill intro: self-intro + view instructions + edit */}
              {showSkillBanner && skillLoadStatus !== 'idle' && (
                <div className={`rounded-lg border text-sm overflow-hidden ${
                  skillLoadStatus === 'loaded'
                    ? 'bg-emerald-900/20 border-emerald-800/40 text-emerald-300'
                    : skillLoadStatus === 'loading'
                      ? 'bg-blue-900/20 border-blue-800/40 text-blue-300'
                      : 'bg-amber-900/20 border-amber-800/40 text-amber-300'
                }`}>
                  <div className="flex items-start gap-3 px-4 py-3">
                    {skillLoadStatus === 'loading' ? (
                      <Loader2 className="w-4 h-4 animate-spin shrink-0 mt-0.5" />
                    ) : skillLoadStatus === 'loaded' ? (
                      <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                    ) : (
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    )}
                    <div className="flex-1 min-w-0">
                      <span className="font-medium">
                        {skillLoadStatus === 'loading'
                          ? `Loading ${skill.name} skill...`
                          : skillLoadStatus === 'loaded'
                            ? `You're using: ${skill.name}`
                            : `Could not load ${skill.name} SKILL.md`}
                      </span>
                      {skillLoadStatus === 'loaded' && (
                        <p className="text-xs opacity-80 mt-1">{skill.description}</p>
                      )}
                      {skillLoadStatus === 'loaded' && (skillInstructions || skill.skillMdUrl) && (
                        <div className="flex flex-wrap items-center gap-3 mt-2">
                          {skillInstructions && (
                            <button
                              type="button"
                              onClick={() => setShowViewInstructions(v => !v)}
                              className="inline-flex items-center gap-1.5 text-xs font-medium opacity-90 hover:opacity-100 underline underline-offset-2 cursor-pointer"
                            >
                              <FileText className="w-3.5 h-3.5" />
                              {showViewInstructions ? 'Hide instructions' : 'View full instructions'}
                            </button>
                          )}
                          <button
                            onClick={handleOpenEditModal}
                            className="inline-flex items-center gap-1.5 text-xs font-medium opacity-90 hover:opacity-100 underline underline-offset-2 cursor-pointer"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                            Edit & Save as My Skill
                          </button>
                        </div>
                      )}
                    </div>
                    {skillLoadStatus !== 'loading' && (
                      <button
                        onClick={() => setShowSkillBanner(false)}
                        className="p-2 rounded hover:bg-white/10 shrink-0 cursor-pointer transition-all duration-200 min-w-[36px] min-h-[36px] flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-white/20"
                        aria-label="Dismiss skill intro"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  {showViewInstructions && (skillInstructions || skill.skillMdUrl) && (
                    <div className="border-t border-white/10 overflow-hidden flex flex-col">
                      {(() => {
                        const segments =
                          getSkillPathSegments(skill.skillMdUrl).length > 0
                            ? getSkillPathSegments(skill.skillMdUrl)
                            : skill.id
                              ? [String(skill.id).replace(/^store-/, ''), 'SKILL.md']
                              : [];
                        return (
                          <>
                            {segments.length > 0 && (
                              <div className="px-4 py-3 bg-white/5 border-b border-white/10">
                                <div className="text-xs font-medium opacity-80 mb-2">File structure</div>
                                <div className="font-mono text-xs space-y-0.5">
                                  {segments.map((name, i) => {
                                    const isFile = i === segments.length - 1;
                                    const depth = i;
                                    return (
                                      <div
                                        key={i}
                                        className="flex items-center gap-1.5"
                                        style={{ paddingLeft: depth * 12 }}
                                      >
                                        {isFile ? (
                                          <FileText className="w-3.5 h-3.5 shrink-0 opacity-70" />
                                        ) : depth === 0 ? (
                                          <FolderOpen className="w-3.5 h-3.5 shrink-0 opacity-70" />
                                        ) : (
                                          <Folder className="w-3.5 h-3.5 shrink-0 opacity-70" />
                                        )}
                                        <span className={isFile ? 'text-amber-200/90' : 'opacity-90'}>{name}</span>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                            {skillInstructions && (
                              <div className="flex-1 min-h-0 max-h-64 overflow-y-auto">
                                <div className="text-xs font-medium opacity-80 px-4 pt-3 pb-1">Content</div>
                                <pre className="p-4 pt-0 text-xs whitespace-pre-wrap font-sans opacity-90">
                                  {skillInstructions}
                                </pre>
                              </div>
                            )}
                          </>
                        );
                      })()}
                    </div>
                  )}
                </div>
              )}

              {connectionError && connected && (
                <div className="flex items-center gap-2 px-3 py-2 bg-red-900/20 border border-red-800/40 rounded-lg text-sm text-red-300">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  {connectionError}
                </div>
              )}

              {entries.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-violet-500/15 to-blue-500/15 flex items-center justify-center mb-6 ring-1 ring-white/[0.06]">
                    <Sparkles className="w-10 h-10 text-violet-400/80" />
                  </div>
                  <h3 className="text-xl font-semibold text-zinc-100 mb-2">
                    Ready to run {skill.name}
                  </h3>
                  <p className="text-sm text-zinc-500 max-w-md mb-6 leading-relaxed">
                    {skillLoadStatus === 'loaded'
                      ? 'Skill instructions loaded successfully. Type a message below to start working with this skill.'
                      : skillLoadStatus === 'loading'
                        ? 'Loading skill instructions...'
                        : 'Type a message to start the agent. It will use OpenCode on the server to execute tasks with full tool access.'}
                  </p>
                  <div className="flex items-center gap-3">
                    {skillLoadStatus === 'loaded' && (
                      <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/10 border border-emerald-500/15 text-emerald-400 text-xs font-medium">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Skill loaded
                      </div>
                    )}
                    {githubUrl && (
                      <a
                        href={githubUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-white/[0.04] border border-white/[0.06] text-zinc-400 hover:text-zinc-200 text-xs font-medium transition-all duration-200 hover:bg-white/[0.08]"
                      >
                        <Github className="w-3.5 h-3.5" />
                        View Source
                        <ExternalLink className="w-3 h-3 opacity-50" />
                      </a>
                    )}
                  </div>
                  <button
                    onClick={() => inputRef.current?.focus()}
                    className="mt-6 px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-500 text-white rounded-xl hover:from-blue-500 hover:to-blue-400 transition-all duration-300 cursor-pointer text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/50 shadow-lg shadow-blue-500/20"
                    aria-label="Start a conversation"
                  >
                    Start a conversation
                  </button>
                </div>
              )}

              {entries.map((entry, i) =>
                entry.type === 'user' ? (
                  <UserMessageView key={`user-${i}`} entry={entry} />
                ) : (
                  <AssistantMessageView key={entry.messageId} entry={entry} />
                )
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* ── Question panel ──────────────────────────────────────── */}
            {activeQuestion && activeQuestion.questions.length > 0 && (
              <QuestionPanel
                question={activeQuestion}
                onAnswer={async (answers) => {
                  const qSessionId = activeQuestion.sessionID || currentSessionId;

                  // 1. Clear question panel immediately for responsive UX
                  setActiveQuestion(null);
                  if (activeQuestion.sessionID) {
                    setPendingQuestionSessionIds(prev => {
                      const next = new Set(prev);
                      next.delete(activeQuestion.sessionID);
                      return next;
                    });
                  }

                  // 2. Try to use the existing SSE stream (from sendMessage).
                  //    If sendMessage is still active, signalQuestionAnswered()
                  //    resets its hasReceivedQuestion flag and the existing stream
                  //    will continue processing events.
                  //    If there's no active stream (e.g. user switched sessions),
                  //    use resumeAfterQuestion() as fallback.
                  const hasActiveStream = isRunning;

                  if (hasActiveStream) {
                    // Active SSE stream exists — use it
                    console.log('[SkillExec] ★ Replying via active SSE stream');
                    try {
                      await opencode.replyQuestion(activeQuestion.id, answers);
                      console.log('[SkillExec] ★ Reply sent, signaling stream');
                      opencode.signalQuestionAnswered();
                    } catch (err) {
                      console.warn('[SkillExec] Failed to reply:', err);
                      setIsRunning(false);
                      setSessionStatus('idle');
                    }
                  } else if (qSessionId) {
                    // No active stream — open a new one
                    console.log('[SkillExec] ★ No active stream, using resumeAfterQuestion');
                    setIsRunning(true);
                    setSessionStatus('busy');

                    opencode.resumeAfterQuestion(qSessionId, activeQuestion.id, answers, {
                      onPartUpdated: (rawPart: Part, delta?: string) => {
                        const part = normalizePart(rawPart);
                        console.log(`[SkillExec-Resume] onPartUpdated: type=${part.type}, msgId=${part.messageID}, delta=${delta ? delta.length + 'ch' : 'none'}`);
                        setEntries((prev) => {
                          const idx = prev.findIndex(
                            (e) => e.type === 'assistant' && e.messageId === part.messageID
                          );
                          if (idx >= 0) {
                            const entry = prev[idx] as AssistantEntry;
                            const pIdx = entry.parts.findIndex((p) => p.id === part.id);
                            let newParts: Part[];
                            if (pIdx >= 0) {
                              newParts = [...entry.parts];
                              if (part.type === 'text' && delta) {
                                newParts[pIdx] = { ...newParts[pIdx], text: ((newParts[pIdx] as TextPart).text || '') + delta } as TextPart;
                              } else {
                                newParts[pIdx] = normalizePart({ ...newParts[pIdx], ...part });
                              }
                            } else {
                              newParts = [...entry.parts, { ...part }];
                            }
                            const newEntries = [...prev];
                            newEntries[idx] = { ...entry, parts: newParts };
                            return newEntries;
                          }
                          return [...prev, { type: 'assistant' as const, messageId: part.messageID, parts: [{ ...part }], isComplete: false }];
                        });
                      },
                      onMessageUpdated: (msg: Record<string, unknown>) => {
                        if (msg.role === 'assistant') {
                          setEntries(prev => {
                            const mId = msg.id as string | undefined;
                            const target = mId ? prev.findIndex(e => e.type === 'assistant' && e.messageId === mId) : -1;
                            if (target < 0) return prev;
                            const next = [...prev];
                            next[target] = { ...(next[target] as AssistantEntry), isComplete: msg.finish === 'stop' };
                            return next;
                          });
                        }
                      },
                      onSessionStatus: (status: string) => setSessionStatus(status),
                      onComplete: () => { console.log('[SkillExec-Resume] ★ onComplete'); setIsRunning(false); setSessionStatus('idle'); setEntries(prev => prev.map(e => e.type === 'assistant' && !e.isComplete ? { ...e, isComplete: true } : e)); },
                      onError: (err: string) => { console.log('[SkillExec-Resume] ★ onError:', err); setIsRunning(false); setConnectionError(err); },
                      onTodos: (newTodos: TodoItem[]) => setTodos(newTodos),
                      onQuestion: (q: QuestionEvent) => { setActiveQuestion(q); setIsRunning(false); setSessionStatus('idle'); setEntries(prev => prev.map(e => e.type === 'assistant' && !e.isComplete ? { ...e, isComplete: true } : e)); },
                    });
                  }
                }}
                onReject={async () => {
                  const qSessionId = activeQuestion.sessionID || currentSessionId;

                  // 1. Clear question panel immediately for responsive UX
                  setActiveQuestion(null);
                  if (activeQuestion.sessionID) {
                    setPendingQuestionSessionIds(prev => {
                      const next = new Set(prev);
                      next.delete(activeQuestion.sessionID);
                      return next;
                    });
                  }

                  // 2. Reject + resume SSE stream (same architecture as onAnswer)
                  const hasActiveStream = isRunning;

                  if (hasActiveStream) {
                    // Active SSE stream exists — reject via it
                    console.log('[SkillExec] ★ Rejecting via active SSE stream');
                    try {
                      await opencode.rejectQuestion(activeQuestion.id);
                      console.log('[SkillExec] ★ Reject sent, signaling stream');
                      opencode.signalQuestionAnswered();
                    } catch (err) {
                      console.warn('[SkillExec] Failed to reject:', err);
                      setIsRunning(false);
                      setSessionStatus('idle');
                    }
                  } else if (qSessionId) {
                    // No active stream — open a new one with reject action
                    console.log('[SkillExec] ★ No active stream, using resumeAfterQuestion (reject)');
                    setIsRunning(true);
                    setSessionStatus('busy');

                    opencode.resumeAfterQuestion(qSessionId, activeQuestion.id, [], {
                      onPartUpdated: (rawPart: Part, delta?: string) => {
                        const part = normalizePart(rawPart);
                        console.log(`[SkillExec-Reject] onPartUpdated: type=${part.type}, msgId=${part.messageID}, delta=${delta ? delta.length + 'ch' : 'none'}`);
                        setEntries((prev) => {
                          const idx = prev.findIndex(
                            (e) => e.type === 'assistant' && e.messageId === part.messageID
                          );
                          if (idx >= 0) {
                            const entry = prev[idx] as AssistantEntry;
                            const pIdx = entry.parts.findIndex((p) => p.id === part.id);
                            let newParts: Part[];
                            if (pIdx >= 0) {
                              newParts = [...entry.parts];
                              if (part.type === 'text' && delta) {
                                newParts[pIdx] = { ...newParts[pIdx], text: ((newParts[pIdx] as TextPart).text || '') + delta } as TextPart;
                              } else {
                                newParts[pIdx] = normalizePart({ ...newParts[pIdx], ...part });
                              }
                            } else {
                              newParts = [...entry.parts, { ...part }];
                            }
                            const newEntries = [...prev];
                            newEntries[idx] = { ...entry, parts: newParts };
                            return newEntries;
                          }
                          return [...prev, { type: 'assistant' as const, messageId: part.messageID, parts: [{ ...part }], isComplete: false }];
                        });
                      },
                      onMessageUpdated: (msg: Record<string, unknown>) => {
                        if (msg.role === 'assistant') {
                          setEntries(prev => {
                            const mId = msg.id as string | undefined;
                            const target = mId ? prev.findIndex(e => e.type === 'assistant' && e.messageId === mId) : -1;
                            if (target < 0) return prev;
                            const next = [...prev];
                            next[target] = { ...(next[target] as AssistantEntry), isComplete: msg.finish === 'stop' };
                            return next;
                          });
                        }
                      },
                      onSessionStatus: (status: string) => setSessionStatus(status),
                      onComplete: () => { console.log('[SkillExec-Reject] ★ onComplete'); setIsRunning(false); setSessionStatus('idle'); setEntries(prev => prev.map(e => e.type === 'assistant' && !e.isComplete ? { ...e, isComplete: true } : e)); },
                      onError: (err: string) => { console.log('[SkillExec-Reject] ★ onError:', err); setIsRunning(false); setConnectionError(err); },
                      onTodos: (newTodos: TodoItem[]) => setTodos(newTodos),
                      onQuestion: (q: QuestionEvent) => { setActiveQuestion(q); setIsRunning(false); setSessionStatus('idle'); setEntries(prev => prev.map(e => e.type === 'assistant' && !e.isComplete ? { ...e, isComplete: true } : e)); },
                    }, 'reject');
                  }
                }}
              />
            )}

            {/* ── Input area ─────────────────────────────────────────── */}
            <div className="px-5 py-4 border-t border-white/[0.06] bg-[#161b22]/50 shrink-0">
              <div className="relative max-w-4xl mx-auto">
                {/* Hidden file input */}
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={handleFileSelect}
                  accept="image/*,.pdf,.txt,.md,.json,.csv,.doc,.docx"
                  aria-label="Attach files"
                />

                {/* File attachments preview */}
                {attachedFiles.length > 0 && (
                  <div className="mb-2.5 flex flex-wrap gap-2">
                    {attachedFiles.map((file) => {
                      const FileIcon = getFileIcon(file.mimeType);
                      return (
                        <div
                          key={file.id}
                          className="group relative flex items-center gap-2 px-3 py-2 bg-white/[0.04] border border-white/[0.08] rounded-lg hover:bg-white/[0.06] transition-colors"
                        >
                          {isImageFile(file.mimeType) ? (
                            <img
                              src={file.dataUrl}
                              alt={file.fileName}
                              className="w-8 h-8 object-cover rounded"
                            />
                          ) : (
                            <FileIcon className="w-4 h-4 text-zinc-400" />
                          )}
                          <span className="text-xs text-zinc-300 max-w-[150px] truncate">
                            {file.fileName}
                          </span>
                          <button
                            onClick={() => removeFile(file.id)}
                            className="ml-1 p-1 rounded hover:bg-white/[0.1] text-zinc-500 hover:text-zinc-200 transition-colors cursor-pointer min-w-[20px] min-h-[20px] flex items-center justify-center"
                            aria-label={`Remove ${file.fileName}`}
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}

                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={activeQuestion ? "Type your answer here..." : "What should the agent do?"}
                  rows={2}
                  disabled={isRunning || !connected}
                  className="w-full pl-4 pr-28 py-3.5 bg-white/[0.04] border border-white/[0.08] rounded-xl
                    text-sm text-zinc-100 placeholder-zinc-600
                    focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500/30
                    resize-none disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200
                    hover:border-white/[0.12] hover:bg-white/[0.05]"
                  aria-label="Message input"
                />
                <div className="absolute right-2.5 bottom-2.5 flex items-center gap-1.5">
                  {/* File attachment button */}
                  {!isRunning && (
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={!connected}
                      className="p-2.5 bg-white/[0.04] text-zinc-400 rounded-lg hover:bg-white/[0.08] hover:text-zinc-200
                        disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200 cursor-pointer min-w-[38px] min-h-[38px] flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-zinc-500/30"
                      title="Attach files"
                      aria-label="Attach files"
                    >
                      <Paperclip className="w-4 h-4" />
                    </button>
                  )}
                  {isRunning ? (
                    <button
                      onClick={handleAbort}
                      className="p-2.5 bg-red-500/15 text-red-400 rounded-lg hover:bg-red-500/25 hover:text-red-300 border border-red-500/10 transition-all duration-200 cursor-pointer min-w-[38px] min-h-[38px] flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-red-500/50"
                      title="Stop agent"
                      aria-label="Stop agent"
                    >
                      <Square className="w-4 h-4" />
                    </button>
                  ) : (
                    <button
                      onClick={handleSend}
                      disabled={(!input.trim() && attachedFiles.length === 0) || !connected}
                        className="p-2.5 bg-gradient-to-r from-blue-600 to-blue-500 text-white rounded-lg hover:from-blue-500 hover:to-blue-400
                        disabled:opacity-30 disabled:from-blue-800 disabled:to-blue-700 disabled:cursor-not-allowed transition-all duration-200 cursor-pointer min-w-[38px] min-h-[38px] flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-blue-500/50 shadow-lg shadow-blue-500/10 disabled:shadow-none"
                      title="Send (Enter)"
                      aria-label="Send message"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
              <div className="flex justify-between items-center mt-2.5 px-1 max-w-4xl mx-auto">
                <span className="text-[11px] text-zinc-600">
                  Enter to send · Shift+Enter for new line
                </span>
                {isRunning && (
                  <span className="text-[11px] text-blue-400/80 flex items-center gap-1.5">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Agent is working...
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Edit & Save as My Skill Modal */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-xl p-6 max-w-lg w-full shadow-2xl max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900">Edit & Save as My Skill</h2>
              <button
                onClick={() => setShowEditModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-600" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Skill Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Skill Name</label>
                <input
                  type="text"
                  value={editingSkill.name || ''}
                  onChange={(e) => setEditingSkill({ ...editingSkill, name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., Data Analysis Expert"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                <textarea
                  value={editingSkill.description || ''}
                  onChange={(e) => setEditingSkill({ ...editingSkill, description: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  placeholder="Describe what this skill can do..."
                />
              </div>

              {/* Category */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
                <select
                  value={editingSkill.category || 'Custom'}
                  onChange={(e) => setEditingSkill({ ...editingSkill, category: e.target.value as any })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="Knowledge">Knowledge</option>
                  <option value="Analysis">Analysis</option>
                  <option value="Development">Development</option>
                  <option value="Design">Design</option>
                  <option value="Marketing">Marketing</option>
                  <option value="Productivity">Productivity</option>
                  <option value="Tools">Tools</option>
                  <option value="Research">Research</option>
                  <option value="Custom">Custom</option>
                </select>
              </div>

              {/* System Prompt */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">System Prompt</label>
                <textarea
                  value={editingSkill.config?.systemPrompt || ''}
                  onChange={(e) => setEditingSkill({
                    ...editingSkill,
                    config: { ...editingSkill.config!, systemPrompt: e.target.value }
                  })}
                  rows={6}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none font-mono text-sm"
                  placeholder="Enter the system prompt for this skill..."
                />
              </div>

              {/* Status Messages */}
              {saveStatus === 'success' && (
                <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                  <p className="text-sm text-green-800">Skill saved successfully!</p>
                </div>
              )}
              {saveStatus === 'error' && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-800">Failed to save skill. Please try again.</p>
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
                <button
                  onClick={() => setShowEditModal(false)}
                  disabled={saveStatus === 'saving'}
                  className="px-6 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveAsMySkill}
                  disabled={saveStatus === 'saving' || !editingSkill.name?.trim()}
                  className="px-6 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {saveStatus === 'saving' ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Saving...
                    </>
                  ) : saveStatus === 'success' ? (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      Saved!
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      Save as My Skill
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
