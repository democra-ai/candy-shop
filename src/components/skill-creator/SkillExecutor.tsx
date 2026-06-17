import { useState, useEffect, useCallback, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import {
  X,
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
  Copy,
  Check,
  Terminal,
  Zap,
  ArrowUp,
  ArrowLeft,
  PanelLeftClose,
  PanelLeftOpen,
  Workflow,
  BookOpen,
  Lock,
  ShoppingBag,
  LogIn,
  Plug,
  Play,
  Server,
} from 'lucide-react';
import type { Skill } from '../../types/skill-creator';
import { getCandyIcon } from '../illustrations';
import { SKILLS_DATA } from '../../data/skillsData';
import { getRuntime, getFormat } from '../../lib/runtimes/registry';
import { getFlavor } from '../../utils/candyShells';
import { useIsDark } from '../../hooks/useIsDark';
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
  type TodoItem,
  type SessionInfo,
  type QuestionEvent,
  type FileAttachment,
} from '../../lib/opencode-client';
import { sendCFChat, getCFBudget, type CFBudget } from '../../lib/cfChatClient';
import { ModelPicker } from './ModelPicker';
import {
  streamClaudeCodeRun,
  getCCBudget,
  warmClaudeAgent,
  // deriveRepoUrlFromSkillMd, // unused now that scratch is the default
  type CCBudget,
} from '../../lib/cfClaudeCodeClient';
import {
  streamOpenCodeRun,
  getOCBudget,
  warmOpenCode,
  type OCBudget,
} from '../../lib/cfOpenCodeClient';
import { streamLangGraphRun, warmLangGraph } from '../../lib/cfLangGraphClient';
import { streamN8nRun, warmN8n } from '../../lib/cfN8nClient';
import { streamPiRun, warmPi, type PiStdoutEvent } from '../../lib/cfPiClient';
import {
  streamDynamicWorkerRun,
  warmDynamicWorker,
  DW_RUN_URL,
} from '../../lib/cfDynamicWorkerClient';
import {
  inspectMcp,
  callMcpTool,
  warmMcp,
  type McpToolDescriptor,
  type McpInspectResult,
  type McpCallResult,
} from '../../lib/cfMcpClient';
import { checkAccess, getX402Pricing, formatPrice } from '../../lib/payment/payment-client';

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
  /** Current signed-in user id (Supabase). Undefined ⇒ anonymous visitor. */
  userId?: string;
  /** Open the auth modal — invoked from the purchase gate when signed out. */
  onRequireAuth?: () => void;
  /** Start Stripe checkout for the given skill id — invoked from the gate. */
  onPurchase?: (skillId: string) => void;
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

/**
 * Format a budget chip label. When `limit`/`remaining` are null the budget is
 * uncapped (no daily cap configured upstream) — show the used count instead of
 * the "{remaining}/{limit} … left" form, which would otherwise render a blank
 * "/ … left" with both null values stringified to "".
 */
function budgetChipLabel(
  b: { used: number; limit: number | null; remaining: number | null },
  unit: string,
): string {
  if (b.limit == null || b.remaining == null) return `${b.used} ${unit} used`;
  return `${b.remaining}/${b.limit} ${unit} left`;
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
// Shared presentation primitives (one cohesive "candy console" language)
// ---------------------------------------------------------------------------

/**
 * CopyButton — a tiny ghost copy affordance used on every code/output block so
 * the transcript reads like a real agent console (Claude.ai / Raycast).
 */
function CopyButton({ value, className = '' }: { value: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        try {
          void navigator.clipboard?.writeText(value);
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1400);
        } catch {
          /* clipboard may be unavailable */
        }
      }}
      title={copied ? 'Copied' : 'Copy'}
      aria-label={copied ? 'Copied' : 'Copy to clipboard'}
      className={`inline-flex items-center justify-center w-6 h-6 rounded-md text-foreground-tertiary hover:text-foreground hover:bg-foreground/10 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-ring/40 ${className}`}
    >
      {copied ? <Check className="w-3 h-3 text-mint" /> : <Copy className="w-3 h-3" />}
    </button>
  );
}

/**
 * CodeBlock — the one monospace surface for all tool input/output, thinking
 * traces and errors. A subtle header rail (label + copy) over a tinted Fira
 * Code body — the polished terminal block (Warp / Raycast).
 */
function CodeBlock({
  label,
  value,
  tone = 'neutral',
  maxClass = 'max-h-56',
}: {
  label?: string;
  value: string;
  tone?: 'neutral' | 'error';
  maxClass?: string;
}) {
  const isError = tone === 'error';
  return (
    <div
      className={`rounded-xl overflow-hidden border ${
        isError ? 'border-error/25 bg-error/[0.06]' : 'border-border/60 bg-background-secondary/70'
      }`}
    >
      <div
        className={`flex items-center gap-2 px-3 h-8 border-b ${
          isError ? 'border-error/20' : 'border-border/50'
        }`}
      >
        <span className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-error/60" />
          <span className="w-1.5 h-1.5 rounded-full bg-caramel/60" />
          <span className="w-1.5 h-1.5 rounded-full bg-mint/60" />
        </span>
        {label && (
          <span
            className={`text-[10px] font-mono uppercase tracking-[0.12em] ${
              isError ? 'text-error/80' : 'text-foreground-tertiary'
            }`}
          >
            {label}
          </span>
        )}
        <CopyButton value={value} className="ml-auto -mr-1" />
      </div>
      <pre
        className={`px-3 py-2.5 text-[12px] leading-relaxed overflow-x-auto ${maxClass} overflow-y-auto font-mono ${
          isError ? 'text-error/90' : 'text-foreground-secondary'
        }`}
      >
        {value}
      </pre>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components for rendering parts
// ---------------------------------------------------------------------------

function ToolStateIcon({ state }: { state: string }) {
  switch (state) {
    case 'completed':
      return <CheckCircle2 className="w-3.5 h-3.5 text-mint" />;
    case 'running':
      return <Loader2 className="w-3.5 h-3.5 text-primary animate-spin" />;
    case 'error':
      return <AlertCircle className="w-3.5 h-3.5 text-error" />;
    default:
      return <Clock className="w-3.5 h-3.5 text-foreground-tertiary" />;
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

  const isError = stateStr === 'error';
  const isRunning = stateStr === 'running';

  return (
    <div
      className={`my-2 rounded-xl border overflow-hidden transition-colors duration-200 ${
        isError
          ? 'border-error/25 bg-error/[0.05]'
          : isRunning
            ? 'border-primary/30 bg-primary/[0.04]'
            : 'border-border/60 bg-card/60'
      }`}
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left hover:bg-foreground/[0.03] transition-colors"
        aria-expanded={expanded}
      >
        <span
          className={`grid place-items-center w-6 h-6 rounded-lg shrink-0 ${
            isError ? 'bg-error/10' : isRunning ? 'bg-primary/10' : 'bg-info/10'
          }`}
        >
          <Wrench className={`w-3.5 h-3.5 ${isError ? 'text-error' : isRunning ? 'text-primary' : 'text-info'}`} />
        </span>
        <span className="text-[13px] font-semibold text-foreground font-mono truncate">
          {safeString(part.tool)}
        </span>
        {title && (
          <span className="text-xs text-foreground-tertiary truncate min-w-0">{title}</span>
        )}
        <span
          className={`ml-auto inline-flex items-center gap-1.5 pl-2 pr-2.5 h-6 rounded-full text-[10px] font-medium font-mono uppercase tracking-wide shrink-0 ${
            isError
              ? 'bg-error/10 text-error'
              : isRunning
                ? 'bg-primary/10 text-primary'
                : stateStr === 'completed'
                  ? 'bg-mint/10 text-mint'
                  : 'bg-secondary text-foreground-tertiary'
          }`}
        >
          <ToolStateIcon state={stateStr} />
          {stateStr}
        </span>
        {expanded ? (
          <ChevronDown className="w-4 h-4 text-foreground-tertiary shrink-0" />
        ) : (
          <ChevronRight className="w-4 h-4 text-foreground-tertiary shrink-0" />
        )}
      </button>
      {expanded && (input || output || error) && (
        <div className="px-3 pb-3 pt-0.5 space-y-2 border-t border-border/40 bg-background-secondary/30">
          {input && <div className="mt-2.5"><CodeBlock label="input" value={input} maxClass="max-h-48" /></div>}
          {output && <CodeBlock label="output" value={output} maxClass="max-h-48" />}
          {error && <CodeBlock label="error" value={error} tone="error" />}
        </div>
      )}
    </div>
  );
}

function ReasoningPartView({ part }: { part: ReasoningPart }) {
  const [expanded, setExpanded] = useState(false);
  if (!part.text) return null;
  return (
    <div className="my-2 rounded-xl border border-grape/20 bg-grape/[0.04] overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-grape/[0.07] transition-colors"
        aria-expanded={expanded}
      >
        <span className="grid place-items-center w-6 h-6 rounded-lg bg-grape/10 shrink-0">
          <Brain className="w-3.5 h-3.5 text-grape" />
        </span>
        <span className="text-[13px] font-medium text-grape font-body">Reasoning</span>
        <span className="ml-auto text-[10px] text-grape/60 font-mono">
          {part.text.length} chars
        </span>
        {expanded ? (
          <ChevronDown className="w-4 h-4 text-grape/60 shrink-0" />
        ) : (
          <ChevronRight className="w-4 h-4 text-grape/60 shrink-0" />
        )}
      </button>
      {expanded && (
        <div className="px-3 pb-3 pt-0.5 border-t border-grape/15">
          <pre className="mt-2.5 text-[12px] leading-relaxed text-foreground-secondary whitespace-pre-wrap max-h-64 overflow-y-auto font-mono">
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
    <div className="prose dark:prose-invert prose-sm max-w-none font-body leading-relaxed
      prose-headings:font-candy prose-headings:text-foreground prose-headings:font-semibold
      prose-p:text-foreground prose-p:leading-relaxed
      prose-li:text-foreground prose-strong:text-foreground prose-strong:font-semibold
      prose-pre:bg-background-secondary/80 prose-pre:border prose-pre:border-border/60 prose-pre:rounded-xl prose-pre:text-[12px] prose-pre:leading-relaxed
      prose-code:text-mint prose-code:bg-secondary/70 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded-md prose-code:font-mono prose-code:text-[0.85em] prose-code:before:content-none prose-code:after:content-none
      prose-a:text-primary prose-a:font-medium prose-a:no-underline hover:prose-a:underline
      prose-blockquote:border-l-2 prose-blockquote:border-grape/40 prose-blockquote:text-foreground-secondary prose-blockquote:not-italic prose-blockquote:font-mono prose-blockquote:text-[12px]
      prose-hr:border-border/60"
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{part.text}</ReactMarkdown>
    </div>
  );
}

function FilePartView({ part }: { part: FilePart }) {
  return (
    <div className="my-2 flex items-center gap-2.5 px-3 py-2 rounded-xl border border-mint/25 bg-mint/[0.05] text-sm">
      <span className="grid place-items-center w-6 h-6 rounded-lg bg-mint/10 shrink-0">
        <FileText className="w-3.5 h-3.5 text-mint" />
      </span>
      <span className="text-foreground font-mono text-[13px] truncate">{part.filename ?? 'File'}</span>
      {part.mime && (
        <span className="ml-auto text-[10px] text-foreground-tertiary font-mono uppercase tracking-wide shrink-0">{part.mime}</span>
      )}
    </div>
  );
}

function PatchPartView({ part }: { part: PatchPart }) {
  return (
    <div className="my-2 flex items-center gap-2.5 px-3 py-2 rounded-xl border border-caramel/30 bg-caramel/[0.06] text-sm">
      <span className="grid place-items-center w-6 h-6 rounded-lg bg-caramel/15 shrink-0">
        <GitBranch className="w-3.5 h-3.5 text-caramel" />
      </span>
      <span className="text-foreground font-medium font-body text-[13px]">Patch applied</span>
      {part.files?.length > 0 && (
        <span className="text-xs text-foreground-tertiary font-mono truncate">
          {part.files.join(', ')}
        </span>
      )}
    </div>
  );
}

function StepFinishView({ part }: { part: StepFinishPart }) {
  return (
    <div className="my-2.5 flex items-center gap-3 text-[10px] text-foreground-tertiary font-mono uppercase tracking-[0.12em]">
      <div className="h-px flex-1 bg-border/60" />
      <span className="shrink-0">
        step
        {part.tokens && (
          <> · {part.tokens.input + part.tokens.output} tok</>
        )}
        {typeof part.cost === 'number' && part.cost > 0 && (
          <> · ${part.cost.toFixed(4)}</>
        )}
      </span>
      <div className="h-px flex-1 bg-border/60" />
    </div>
  );
}

function SnapshotView() {
  return (
    <div className="my-1.5 flex items-center gap-2 px-1 text-[10px] text-foreground-tertiary font-mono uppercase tracking-[0.12em]">
      <Camera className="w-3 h-3" />
      <span>snapshot</span>
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

  const statusLabel = isThinking ? 'stirring…' : isTooling ? `running ${toolName}` : 'working…';

  return (
    <div className="flex justify-start group/msg">
      <div className="max-w-[95%] w-full">
        <div className="flex items-center gap-2.5 mb-2">
          <div className="grid place-items-center w-7 h-7 rounded-xl bg-primary text-primary-foreground shadow-candy-1 candy-gloss shrink-0">
            <Sparkles className="w-4 h-4" />
          </div>
          <span className="text-[13px] font-semibold text-foreground font-candy">Agent</span>
          {!entry.isComplete && (
            <span className="inline-flex items-center gap-1.5 pl-1.5 pr-2.5 h-6 rounded-full bg-primary/10 text-primary">
              <Loader2 className="w-3 h-3 animate-spin" />
              <span className="text-[10px] font-medium font-mono lowercase">{statusLabel}</span>
            </span>
          )}
          {entry.isComplete && entry.tokens && (
            <span className="text-[10px] text-foreground-tertiary ml-auto font-mono">
              {entry.tokens.input + entry.tokens.output} tok
              {typeof entry.cost === 'number' && entry.cost > 0 && ` · $${entry.cost.toFixed(4)}`}
            </span>
          )}
        </div>
        <div className="pl-[38px] space-y-0.5">
          {entry.parts.map((part, i) => (
            <PartRenderer key={part.id || `part-${i}`} part={part} />
          ))}
          {!entry.isComplete && entry.parts.length === 0 && (
            <div className="flex items-center gap-2 py-1">
              <span className="flex gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-primary/70 animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-primary/70 animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-primary/70 animate-bounce" style={{ animationDelay: '300ms' }} />
              </span>
              <span className="text-[13px] text-foreground-tertiary font-body">thinking…</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// User message — solid tinted prompt block (raspberry tint + ink), per DESIGN.md
// "color carried by tinted accents on a clean canvas" (no rainbow gradient).
function UserMessageView({ entry }: { entry: UserEntry }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[80%] px-4 py-2.5 rounded-2xl rounded-br-md bg-secondary border border-primary/15 text-foreground text-[14px] leading-relaxed whitespace-pre-wrap shadow-candy-1 font-body">
        {entry.text}
      </div>
    </div>
  );
}

// Todos sidebar display
function TodosView({ todos }: { todos: TodoItem[] }) {
  if (!todos.length) return null;
  const done = todos.filter((t) => t.status === 'completed').length;
  return (
    <div className="px-4 py-3 border-b border-border/50 bg-background-secondary/40">
      <div className="flex items-center gap-2 mb-2.5">
        <ListTodo className="w-3.5 h-3.5 text-foreground-tertiary" />
        <span className="text-[10px] font-semibold text-foreground-tertiary uppercase tracking-[0.14em] font-mono">Plan</span>
        <span className="ml-auto text-[10px] font-mono text-foreground-tertiary tabular-nums">{done}/{todos.length}</span>
      </div>
      <div className="space-y-1.5">
        {todos.map((todo) => (
          <div key={todo.id} className="flex items-center gap-2.5 text-[13px]">
            {todo.status === 'completed' ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-mint shrink-0" />
            ) : todo.status === 'in_progress' ? (
              <Loader2 className="w-3.5 h-3.5 text-primary animate-spin shrink-0" />
            ) : (
              <Circle className="w-3.5 h-3.5 text-foreground-tertiary shrink-0" />
            )}
            <span className={todo.status === 'completed' ? 'text-foreground-tertiary line-through font-body' : todo.status === 'in_progress' ? 'text-foreground font-medium font-body' : 'text-foreground-secondary font-body'}>
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
    <div className="mx-4 mb-3 rounded-2xl border border-primary/25 bg-card overflow-hidden shadow-candy-2">
      {/* Header */}
      <div className="px-4 py-3 bg-primary/[0.06] border-b border-primary/15 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="grid place-items-center w-7 h-7 rounded-xl bg-primary/12 shrink-0">
            <MessageSquare className="w-3.5 h-3.5 text-primary" />
          </div>
          <div>
            <div className="text-[13px] font-semibold text-foreground font-candy">Agent needs your input</div>
            <div className="text-[11px] text-foreground-tertiary font-body">Select an option or type a response</div>
          </div>
        </div>
        <button
          onClick={onReject}
          className="text-xs text-foreground-tertiary hover:text-error transition-colors duration-200 px-3 py-2 rounded-md hover:bg-error/10 cursor-pointer min-h-[36px] focus:outline-none focus:ring-2 focus:ring-error/30"
          title="Dismiss question"
          aria-label="Dismiss question"
        >
          Dismiss
        </button>
      </div>

      {/* Question groups */}
      {question.questions.map((q, qIdx) => (
        <div key={qIdx} className="px-4 py-4 border-b border-border/20 last:border-b-0">
          {q.header && (
            <div className="text-[11px] font-bold uppercase tracking-wider text-primary/70 mb-1 font-body">{q.header}</div>
          )}
          {q.question && (
            <div className="text-sm text-foreground mb-3 leading-relaxed font-body">{q.question}</div>
          )}
          <div className="grid gap-2" style={{ gridTemplateColumns: q.options.length > 4 ? 'repeat(auto-fill, minmax(140px, 1fr))' : `repeat(${Math.min(q.options.length, 3)}, 1fr)` }}>
            {q.options.map((opt, optIdx) => {
              const isSelected = (selections[qIdx] ?? []).includes(opt.label);
              return (
                <button
                  key={optIdx}
                  onClick={() => handleOptionToggle(qIdx, opt.label, q.multiple)}
                  className={`group relative text-left px-3 py-3 rounded-lg border transition-all duration-150 cursor-pointer min-h-[44px] focus:outline-none focus:ring-2 focus:ring-primary/40 ${
                    isSelected
                      ? 'bg-primary/15 border-primary/60 ring-1 ring-primary/30'
                      : 'bg-secondary/60 border-border/50 hover:border-primary/40 hover:bg-secondary'
                  }`}
                  aria-pressed={isSelected}
                >
                  <div className="flex items-start gap-2">
                    {q.multiple && (
                      <div className={`mt-0.5 w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 transition-colors ${
                        isSelected ? 'bg-primary border-primary' : 'border-foreground-tertiary'
                      }`}>
                        {isSelected && <CheckCircle2 className="w-2.5 h-2.5 text-primary-foreground" />}
                      </div>
                    )}
                    {!q.multiple && (
                      <div className={`mt-0.5 w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                        isSelected ? 'border-primary' : 'border-foreground-tertiary'
                      }`}>
                        {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-primary" />}
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className={`text-xs font-medium leading-snug ${isSelected ? 'text-primary' : 'text-foreground'}`}>
                        {opt.label}
                      </div>
                      {opt.description && (
                        <div className="text-[10px] text-foreground-tertiary mt-0.5 leading-snug line-clamp-2">
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
              className={`mt-2 inline-flex items-center gap-1.5 px-3 py-2 text-xs rounded-xl border transition-all duration-200 cursor-pointer min-h-[36px] focus:outline-none focus:ring-2 focus:ring-primary/30 ${
                showCustom[qIdx]
                  ? 'bg-secondary border-border-hover text-foreground'
                  : 'bg-secondary/40 border-border/40 text-foreground-tertiary hover:text-foreground-secondary hover:border-border-hover'
              }`}
            >
              <Edit2 className="w-3 h-3" /> Custom answer…
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
              className="mt-2 w-full px-3 py-2 text-sm bg-secondary/80 border border-border-hover/50 rounded-lg
                text-foreground placeholder-foreground-tertiary focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 font-body"
              autoFocus
            />
          )}
        </div>
      ))}

      {/* Actions */}
      <div className="px-4 py-3 bg-background-secondary/30 flex items-center justify-between">
        <span className="text-[10px] text-foreground-muted font-mono">
          {Object.values(selections).flat().length} selected
        </span>
        <div className="flex gap-2">
          <button
            onClick={onReject}
            className="px-4 py-2 text-xs rounded-lg bg-secondary border border-border/50 text-foreground-secondary hover:text-foreground hover:bg-secondary/80 transition-colors duration-200 cursor-pointer min-h-[36px] focus:outline-none focus:ring-2 focus:ring-border/30 btn-press"
            aria-label="Skip question"
          >
            Skip
          </button>
          <button
            onClick={handleSubmit}
            disabled={!hasSelection}
            className="candy-btn inline-flex items-center gap-1.5 px-5 py-2 text-xs font-semibold rounded-xl
              disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer min-h-[36px]
              focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:focus:ring-0 btn-press font-body"
            aria-label="Submit answer"
          >
            Submit answer
            <ArrowUp className="w-3.5 h-3.5 rotate-90" />
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
    <div className="w-56 border-r border-border/60 flex flex-col bg-background-secondary/40 shrink-0">
      <div className="px-3 py-3 border-b border-border/60 flex items-center justify-between">
        <span className="text-[10px] font-semibold text-foreground-tertiary uppercase tracking-[0.14em] font-mono">Sessions</span>
        <button
          onClick={onNew}
          className="grid place-items-center w-8 h-8 rounded-lg hover:bg-primary/10 text-foreground-secondary hover:text-primary transition-colors duration-200 cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/30"
          title="New session"
          aria-label="Create new session"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-1.5 space-y-0.5">
        {sessions.length === 0 && (
          <p className="px-2 py-3 text-xs text-foreground-tertiary font-body">No sessions yet</p>
        )}
        {sessions.map((s) => {
          const hasPendingQ = pendingQuestionSessionIds.has(s.id);
          const active = s.id === currentSessionId;
          return (
            <div
              key={s.id}
              className={`group flex items-center gap-2 px-2.5 py-2 rounded-xl cursor-pointer transition-colors ${
                active
                  ? 'bg-primary/10 text-foreground'
                  : hasPendingQ
                    ? 'text-primary hover:bg-primary/5'
                    : 'text-foreground-secondary hover:bg-secondary/70 hover:text-foreground'
              }`}
              onClick={() => onSelect(s.id)}
            >
              <MessageSquare className={`w-3.5 h-3.5 shrink-0 ${hasPendingQ || active ? 'text-primary' : ''}`} />
              <span className="text-[13px] truncate flex-1 font-body">{s.title || 'Untitled'}</span>
              {hasPendingQ && (
                <span className="w-2 h-2 rounded-full bg-primary animate-pulse shrink-0" title="Awaiting your response" />
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(s.id);
                }}
                className="opacity-0 group-hover:opacity-100 grid place-items-center w-6 h-6 rounded-md hover:bg-error/10 transition-all duration-200 cursor-pointer focus:outline-none focus:ring-2 focus:ring-error/30 shrink-0"
                title="Delete session"
                aria-label={`Delete session ${s.title || 'Untitled'}`}
              >
                <Trash2 className="w-3 h-3 text-foreground-tertiary hover:text-error" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// MCP server runtime view
// ---------------------------------------------------------------------------
// An MCP server exposes a SET OF TOOLS, not a single task — so its UX differs
// from the chat / fixed-runtime transcript paths. On open we warm + auto-connect
// (inspectMcp → handshake + tools/list), render the server info + the full tool
// list (name + description + input schema), and let the user CALL a tool: pick
// one, edit JSON args (prefilled from the tool's inputSchema), Call → callMcpTool
// → show the result. Servers that need credentials still list their tools, with
// a note that calling may require keys/config.

/** Build a minimal JSON-skeleton string from an MCP tool inputSchema so the
 *  args textarea is prefilled with the expected keys. Falls back to `{}`. */
function prefillArgsFromSchema(schema: Record<string, unknown> | undefined): string {
  if (!schema || typeof schema !== 'object') return '{}';
  const props = schema.properties as Record<string, Record<string, unknown>> | undefined;
  if (!props || typeof props !== 'object') return '{}';
  const required = Array.isArray(schema.required) ? (schema.required as string[]) : null;
  const keys = Object.keys(props);
  if (keys.length === 0) return '{}';
  const obj: Record<string, unknown> = {};
  for (const key of keys) {
    // Prefill only required keys by default (or all if none are marked required)
    if (required && required.length > 0 && !required.includes(key)) continue;
    const p = props[key] ?? {};
    const t = p.type as string | undefined;
    if (Array.isArray((p as { enum?: unknown[] }).enum)) {
      obj[key] = (p as { enum: unknown[] }).enum[0];
    } else if (t === 'number' || t === 'integer') obj[key] = 0;
    else if (t === 'boolean') obj[key] = false;
    else if (t === 'array') obj[key] = [];
    else if (t === 'object') obj[key] = {};
    else obj[key] = '';
  }
  // If nothing got prefilled (e.g. all optional), still surface the shape.
  if (Object.keys(obj).length === 0) {
    for (const key of keys) obj[key] = '';
  }
  return JSON.stringify(obj, null, 2);
}

/** Stringify an MCP CallToolResult into readable text for the result block. */
function formatMcpResult(result: unknown): string {
  if (result == null) return '(no result)';
  const r = result as { content?: unknown; isError?: boolean } & Record<string, unknown>;
  // MCP CallToolResult: { content: [{type:'text', text}, ...], isError? }
  if (Array.isArray(r.content)) {
    const parts = (r.content as Array<Record<string, unknown>>).map((c) => {
      if (c.type === 'text' && typeof c.text === 'string') return c.text;
      if (c.type === 'image') return `[image ${c.mimeType ?? ''}]`;
      if (c.type === 'resource') return `[resource ${safeString(c.resource)}]`;
      return safeString(c);
    });
    const text = parts.join('\n');
    return r.isError ? `(tool error)\n${text}` : text;
  }
  return safeString(result);
}

function McpToolRow({
  tool,
  selected,
  onSelect,
  accentBase,
}: {
  tool: McpToolDescriptor;
  selected: boolean;
  onSelect: () => void;
  accentBase: string;
}) {
  const [showSchema, setShowSchema] = useState(false);
  const schemaStr =
    tool.inputSchema && Object.keys(tool.inputSchema).length > 0
      ? JSON.stringify(tool.inputSchema, null, 2)
      : '';
  return (
    <div
      className={`rounded-xl border transition-colors ${
        selected ? 'bg-card border-transparent ring-2' : 'bg-card/60 border-border/60 hover:border-border-hover'
      }`}
      style={selected ? ({ '--tw-ring-color': accentBase } as React.CSSProperties) : undefined}
    >
      <div className="flex items-start gap-2.5 px-3 py-2.5">
        <span
          className="grid place-items-center w-7 h-7 rounded-lg shrink-0 mt-0.5"
          style={{ backgroundColor: `${accentBase}1A`, color: accentBase }}
        >
          <Wrench className="w-3.5 h-3.5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[13px] font-semibold text-foreground font-mono break-all">{tool.name}</span>
          </div>
          {tool.description && (
            <p className="text-xs text-foreground-secondary mt-0.5 leading-relaxed font-body">{tool.description}</p>
          )}
          <div className="flex items-center gap-2 mt-1.5">
            {schemaStr && (
              <button
                type="button"
                onClick={() => setShowSchema((v) => !v)}
                className="inline-flex items-center gap-1 px-2 h-6 text-[10px] font-mono rounded-md bg-secondary/70 text-foreground-tertiary hover:text-foreground hover:bg-secondary transition-colors"
              >
                {showSchema ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                schema
              </button>
            )}
            <button
              type="button"
              onClick={onSelect}
              className="inline-flex items-center gap-1.5 px-2.5 h-6 text-[11px] font-medium rounded-md text-white transition-transform active:scale-95"
              style={{ backgroundColor: accentBase }}
            >
              <Play className="w-3 h-3" />
              {selected ? 'Selected' : 'Use tool'}
            </button>
          </div>
        </div>
      </div>
      {showSchema && schemaStr && (
        <div className="px-3 pb-3">
          <CodeBlock label="input schema" value={schemaStr} maxClass="max-h-56" />
        </div>
      )}
    </div>
  );
}

function McpServerView({
  skill,
  onClose,
  isDark,
}: {
  skill: Skill;
  onClose: () => void;
  isDark: boolean;
}) {
  const runtimeDescriptor = getRuntime('mcp');
  const accent = getFlavor(runtimeDescriptor.accentFlavor, isDark);
  const command = skill.installCommand?.trim() || '';
  const needsCredentials = (skill.tags ?? []).some((t) => /needs-credential/i.test(t));
  const SkillCandy = getCandyIcon(skill.category);

  const githubUrl = skill.artifactUrl?.startsWith('http')
    ? skill.artifactUrl
    : skill.repo
      ? `https://github.com/${skill.repo}`
      : null;

  // Connection / inspect state
  const [connecting, setConnecting] = useState(true);
  const [serverInfo, setServerInfo] = useState<McpInspectResult['serverInfo']>(null);
  const [tools, setTools] = useState<McpToolDescriptor[]>([]);
  const [inspectError, setInspectError] = useState<string | null>(null);
  const [log, setLog] = useState<string[]>([]);

  // Tool-call state
  const [selectedTool, setSelectedTool] = useState<string | null>(null);
  const [argsText, setArgsText] = useState('{}');
  const [calling, setCalling] = useState(false);
  const [callResult, setCallResult] = useState<{ text: string; isError: boolean } | null>(null);
  const [argsError, setArgsError] = useState<string | null>(null);

  const selected = tools.find((t) => t.name === selectedTool) ?? null;

  // Warm + auto-connect on open.
  useEffect(() => {
    if (!command) {
      setConnecting(false);
      setInspectError('No launch command configured for this MCP server.');
      return;
    }
    let cancelled = false;
    warmMcp();
    setConnecting(true);
    setInspectError(null);
    setLog([]);
    inspectMcp(
      { command },
      {
        onLog: (d) => {
          const stage = typeof d.stage === 'string' ? d.stage : 'log';
          const detail =
            typeof d.message === 'string'
              ? d.message
              : typeof d.text === 'string'
                ? d.text
                : '';
          if (!cancelled) setLog((prev) => [...prev, detail ? `${stage}: ${detail}` : stage]);
        },
        onTools: (data) => {
          if (cancelled) return;
          setServerInfo(data.serverInfo ?? null);
          setTools(Array.isArray(data.tools) ? data.tools : []);
        },
        onError: (err) => {
          if (!cancelled) setInspectError(err.message);
        },
        onDone: () => {
          if (!cancelled) setConnecting(false);
        },
      },
    )
      .catch((err) => {
        if (!cancelled) setInspectError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (!cancelled) setConnecting(false);
      });
    return () => {
      cancelled = true;
    };
  }, [command]);

  const handleSelectTool = useCallback(
    (tool: McpToolDescriptor) => {
      setSelectedTool(tool.name);
      setArgsText(prefillArgsFromSchema(tool.inputSchema));
      setCallResult(null);
      setArgsError(null);
    },
    [],
  );

  const handleCall = useCallback(async () => {
    if (!selectedTool || !command) return;
    let args: Record<string, unknown> = {};
    if (argsText.trim()) {
      try {
        const parsed = JSON.parse(argsText);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          args = parsed as Record<string, unknown>;
        } else {
          setArgsError('Arguments must be a JSON object, e.g. { "key": "value" }');
          return;
        }
      } catch {
        setArgsError('Invalid JSON — check your arguments.');
        return;
      }
    }
    setArgsError(null);
    setCalling(true);
    setCallResult(null);
    try {
      await callMcpTool(
        { command, tool: selectedTool, args },
        {
          onResult: (data: McpCallResult) => {
            const r = data.result as { isError?: boolean } | undefined;
            setCallResult({ text: formatMcpResult(data.result), isError: Boolean(r?.isError) });
          },
          onError: (err) => {
            setCallResult({ text: err.message, isError: true });
          },
        },
      );
    } catch (err) {
      setCallResult({ text: err instanceof Error ? err.message : String(err), isError: true });
    } finally {
      setCalling(false);
    }
  }, [selectedTool, command, argsText]);

  return (
    <div className="h-screen w-full flex flex-col bg-background animate-fade-in overflow-hidden">
      {/* Header */}
      <header className="relative shrink-0 bg-card border-b border-border z-20">
        <div className="absolute inset-x-0 top-0 h-[3px]" style={{ backgroundColor: accent.base }} />
        <div className="flex items-center gap-3 px-3 sm:px-5 h-16">
          <button
            onClick={onClose}
            className="group inline-flex items-center gap-1.5 pl-2 pr-3 h-9 rounded-xl bg-secondary/70 hover:bg-secondary text-foreground-secondary hover:text-foreground transition-colors duration-200 cursor-pointer focus:outline-none focus:ring-2 focus:ring-ring shrink-0 font-body"
            aria-label="Back to Candy Shop"
            title="Back to Candy Shop"
          >
            <ArrowLeft className="w-4 h-4 transition-transform duration-200 group-hover:-translate-x-0.5" />
            <span className="hidden sm:inline text-[13px] font-medium">Candy Shop</span>
          </button>
          <div className="h-7 w-px bg-border/70 mx-0.5 hidden sm:block" />
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="grid place-items-center w-9 h-9 rounded-xl bg-secondary ring-1 ring-border/60 shrink-0 overflow-hidden">
              <SkillCandy size={26} />
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-2 min-w-0">
                <h1 className="text-[15px] leading-tight font-semibold text-foreground font-candy truncate">{skill.name}</h1>
                <span
                  className="hidden sm:inline-flex items-center gap-1 px-2 h-[18px] rounded-full border text-[10px] font-bold font-mono uppercase tracking-wide shrink-0"
                  style={{ backgroundColor: accent.tint, color: accent.ink, borderColor: accent.base }}
                >
                  <Server className="w-2.5 h-2.5" />
                  MCP Server
                </span>
              </div>
              <div className="mt-0.5 flex items-center gap-2">
                <span
                  className={`inline-flex items-center gap-1.5 pl-1.5 pr-2 h-[20px] rounded-full bg-foreground/[0.04] border border-border/60 text-[10px] font-mono font-medium ${
                    connecting ? 'text-caramel' : inspectError ? 'text-error' : 'text-mint'
                  }`}
                >
                  {connecting ? (
                    <Loader2 className="w-2.5 h-2.5 animate-spin" />
                  ) : (
                    <span className={`w-1.5 h-1.5 rounded-full ${inspectError ? 'bg-error' : 'bg-mint'} ${!inspectError ? 'animate-pulse' : ''}`} />
                  )}
                  {connecting ? 'connecting…' : inspectError ? 'connect failed' : `${tools.length} tools`}
                </span>
                {serverInfo?.name && (
                  <span className="hidden md:inline text-foreground-muted font-mono text-[10px]">
                    {serverInfo.name}
                    {serverInfo.version ? ` v${serverInfo.version}` : ''}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="ml-auto flex items-center gap-1.5 shrink-0">
            {githubUrl && (
              <a
                href={githubUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="hidden md:inline-flex items-center gap-1.5 px-3 h-9 rounded-xl bg-secondary/60 hover:bg-secondary text-foreground-secondary hover:text-foreground transition-colors duration-200 text-[12px] font-medium shrink-0 font-body"
                title="View source"
              >
                <Github className="w-3.5 h-3.5" />
                <span className="hidden lg:inline">Source</span>
                <ExternalLink className="w-2.5 h-2.5 opacity-50" />
              </a>
            )}
            {runtimeDescriptor.docsUrl && (
              <a
                href={runtimeDescriptor.docsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="hidden md:inline-flex items-center gap-1.5 px-3 h-9 rounded-xl bg-secondary/60 hover:bg-secondary text-foreground-secondary hover:text-foreground transition-colors duration-200 text-[12px] font-medium shrink-0 font-body"
                title="MCP docs"
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span className="hidden lg:inline">MCP docs</span>
              </a>
            )}
          </div>
        </div>
      </header>

      {/* Body — two readable columns on desktop: tools list + call panel */}
      <div className="flex-1 overflow-y-auto bg-background">
        <div className="mx-auto w-full max-w-5xl px-4 sm:px-6 py-6 space-y-5">
          {/* Identity / launch-command hero */}
          <div
            className="rounded-3xl p-5 sm:p-6 border flex items-start gap-4"
            style={{ backgroundColor: accent.tint, color: accent.ink, borderColor: accent.base }}
          >
            <span
              className="grid place-items-center w-12 h-12 rounded-2xl shrink-0 text-white shadow-candy-1"
              style={{ backgroundColor: accent.base }}
              aria-hidden="true"
            >
              <Plug className="w-6 h-6" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="font-mono text-[11px] uppercase tracking-[0.18em] opacity-80">MCP Server · stdio</div>
              <h2 className="font-candy font-bold text-xl leading-tight mt-1">{skill.name}</h2>
              <p className="text-sm mt-1.5 leading-relaxed opacity-90 font-body">{skill.description}</p>
              {command && (
                <div className="mt-3 rounded-xl bg-background/70 border border-border/50 overflow-hidden">
                  <div className="flex items-center gap-2 px-3 h-8 border-b border-border/40">
                    <Terminal className="w-3.5 h-3.5 text-foreground-tertiary" />
                    <span className="text-[10px] font-mono uppercase tracking-[0.12em] text-foreground-tertiary">launch command</span>
                    <CopyButton value={command} className="ml-auto -mr-1" />
                  </div>
                  <pre className="px-3 py-2 text-[12px] font-mono text-foreground-secondary overflow-x-auto">{command}</pre>
                </div>
              )}
            </div>
          </div>

          {/* Needs-credentials note */}
          {needsCredentials && (
            <div className="flex items-start gap-2.5 px-3.5 py-3 rounded-xl border border-warning/30 bg-warning/[0.06] text-sm">
              <Lock className="w-4 h-4 text-warning shrink-0 mt-0.5" />
              <div className="font-body text-foreground-secondary leading-relaxed">
                This server <strong className="text-foreground">requires credentials</strong>. Its tools are listed below,
                but calling a tool may fail unless the API key / token in the launch command is configured.
              </div>
            </div>
          )}

          {/* Inspect error */}
          {inspectError && (
            <div className="flex items-start gap-2.5 px-3.5 py-3 rounded-xl border border-error/25 bg-error/[0.06] text-sm">
              <AlertCircle className="w-4 h-4 text-error shrink-0 mt-0.5" />
              <div className="font-body text-error leading-relaxed break-words">{inspectError}</div>
            </div>
          )}

          {/* Connecting overlay state */}
          {connecting && tools.length === 0 && !inspectError && (
            <div className="rounded-2xl border border-border bg-card p-8 text-center shadow-candy-1">
              <div className="grid place-items-center w-12 h-12 rounded-2xl bg-primary/10 mx-auto mb-3">
                <Loader2 className="w-6 h-6 text-primary animate-spin" />
              </div>
              <h3 className="text-[15px] font-semibold text-foreground font-candy">Connecting to the MCP server</h3>
              <p className="text-xs text-foreground-tertiary mt-1.5 font-body">
                Spawning <span className="font-mono">{command.split(' ').slice(0, 3).join(' ')}…</span> and listing its tools
              </p>
              {log.length > 0 && (
                <div className="mt-4 max-w-md mx-auto text-left">
                  <CodeBlock label="bridge log" value={log.slice(-8).join('\n')} maxClass="max-h-32" />
                </div>
              )}
            </div>
          )}

          {/* Tools + call panel */}
          {tools.length > 0 && (
            <div className="grid gap-5 lg:grid-cols-[1fr_1fr]">
              {/* Tools list */}
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-2.5">
                  <Wrench className="w-3.5 h-3.5 text-foreground-tertiary" />
                  <span className="text-[10px] font-semibold text-foreground-tertiary uppercase tracking-[0.14em] font-mono">
                    Tools ({tools.length})
                  </span>
                </div>
                <div className="space-y-2">
                  {tools.map((tool) => (
                    <McpToolRow
                      key={tool.name}
                      tool={tool}
                      selected={selectedTool === tool.name}
                      onSelect={() => handleSelectTool(tool)}
                      accentBase={accent.base}
                    />
                  ))}
                </div>
              </div>

              {/* Call panel */}
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-2.5">
                  <Play className="w-3.5 h-3.5 text-foreground-tertiary" />
                  <span className="text-[10px] font-semibold text-foreground-tertiary uppercase tracking-[0.14em] font-mono">
                    Call a tool
                  </span>
                </div>
                <div className="rounded-2xl border border-border bg-card p-4 shadow-candy-1 lg:sticky lg:top-2">
                  {!selected ? (
                    <p className="text-sm text-foreground-tertiary font-body leading-relaxed py-6 text-center">
                      Pick a tool on the left to call it. The arguments below are prefilled from the tool's input schema.
                    </p>
                  ) : (
                    <>
                      <div className="flex items-center gap-2 mb-3">
                        <span
                          className="grid place-items-center w-7 h-7 rounded-lg shrink-0"
                          style={{ backgroundColor: `${accent.base}1A`, color: accent.base }}
                        >
                          <Wrench className="w-3.5 h-3.5" />
                        </span>
                        <span className="text-[13px] font-semibold text-foreground font-mono break-all">{selected.name}</span>
                      </div>
                      {selected.description && (
                        <p className="text-xs text-foreground-secondary mb-3 leading-relaxed font-body">{selected.description}</p>
                      )}
                      <label className="block text-[10px] font-semibold text-foreground-tertiary uppercase tracking-[0.12em] mb-1.5 font-mono">
                        Arguments (JSON)
                      </label>
                      <textarea
                        value={argsText}
                        onChange={(e) => setArgsText(e.target.value)}
                        rows={6}
                        spellCheck={false}
                        className="w-full px-3 py-2.5 rounded-xl border border-input-border bg-input text-foreground font-mono text-[12px] leading-relaxed focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 resize-y transition-colors"
                        placeholder="{}"
                        aria-label="Tool arguments JSON"
                      />
                      {argsError && (
                        <p className="text-[11px] text-error mt-1.5 font-mono">{argsError}</p>
                      )}
                      <button
                        type="button"
                        onClick={handleCall}
                        disabled={calling}
                        className="mt-3 inline-flex items-center justify-center gap-2 w-full h-11 rounded-2xl text-sm font-semibold font-body text-white shadow-candy-1 transition-transform duration-150 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-card"
                        style={{ backgroundColor: accent.base }}
                      >
                        {calling ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Calling {selected.name}…
                          </>
                        ) : (
                          <>
                            <Play className="w-4 h-4" />
                            Call {selected.name}
                          </>
                        )}
                      </button>
                      {needsCredentials && (
                        <p className="text-[11px] text-foreground-tertiary mt-2 font-body leading-relaxed">
                          Note: this call may require credentials set in the launch command.
                        </p>
                      )}
                      {callResult && (
                        <div className="mt-4">
                          <CodeBlock
                            label={callResult.isError ? 'error' : 'result'}
                            value={callResult.text}
                            tone={callResult.isError ? 'error' : 'neutral'}
                            maxClass="max-h-80"
                          />
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function SkillExecutor({ skill, onClose, userId, onRequireAuth, onPurchase }: SkillExecutorProps) {
  // ── Run-dispatch by format/runtime (declared first; used by effects below) ─
  // claude-skill        → runner 'cc-sandbox'        → existing cf-cc/cf-ai/opencode
  //                       chat flow, UNCHANGED.
  // langgraph           → runner 'langgraph-sandbox' → real LangGraph execution
  //                       runtime (cf-langgraph worker); streams graph output
  //                       into the same transcript UI.
  // everything else     → runner 'coming-soon'       → the import/coming-soon panel.
  const executorIsDark = useIsDark();
  const itemFormat = getFormat(skill);
  const runtimeDescriptor = getRuntime(itemFormat);
  const isLangGraph = runtimeDescriptor.runner === 'langgraph-sandbox';
  // n8n           → runner 'n8n-sandbox' → real n8n workflow execution runtime
  //                 (cf-n8n worker); streams node-by-node run output.
  const isN8n = runtimeDescriptor.runner === 'n8n-sandbox';
  // dynamic-worker → runner 'dw-sandbox' → real Dynamic Worker execution runtime
  //                  (dw-sandbox worker + Worker Loader); loads a self-contained
  //                  JS Worker module on the fly and streams the run log + result.
  const isDynamicWorker = runtimeDescriptor.runner === 'dw-sandbox';
  // mcp → runner 'mcp-sandbox' → real MCP server runtime (mcp-sandbox worker).
  //       An MCP server exposes a SET OF TOOLS rather than running a single task,
  //       so it renders its own dedicated view (McpServerView): warm + connect
  //       (inspect → tools/list), then pick + call a tool (callMcpTool).
  const isMcp = runtimeDescriptor.runner === 'mcp-sandbox';
  // Whether the Dynamic Worker sandbox is actually reachable from the deployed
  // Pages site. The dw-sandbox build deployed to a PUBLIC workers.dev origin
  // (account is Worker-Loader closed-beta enrolled), so DW_RUN_URL is public and
  // the deployed site can reach it. If enrollment were missing, the build would
  // be local-only (a 127.0.0.1 / localhost dev URL) and the deployed site could
  // NOT reach it — in that case the run branch renders an inline "pending beta"
  // note instead of attempting (and failing) a cross-origin run to localhost.
  const dwDeployed = !/^https?:\/\/(127\.0\.0\.1|localhost)(:|\/|$)/i.test(DW_RUN_URL);
  // Formats that run against a dedicated single-runtime sandbox worker
  // (LangGraph / n8n / Dynamic Worker) share the same "fixed runtime, stream
  // into transcript" UI shape — distinct from the multi-runtime claude-skill
  // chat path.
  const isFixedRuntime = isLangGraph || isN8n || isDynamicWorker;
  const isComingSoon = runtimeDescriptor.runner === 'coming-soon';

  // ── Buyer-side entitlement gate ───────────────────────────────────────────
  // Source of truth is the Worker `checkAccess`, NOT a frontend pricing field
  // (the Skill type has none). Catalog runs prefix the id with `store-`
  // (see App.handleRunSkill); the D1 row is keyed by the bare catalog id, so we
  // strip that prefix before asking the Worker. Free/unknown/entitled skills
  // resolve to hasAccess !== false and run unchanged; paid-but-unentitled skills
  // resolve to hasAccess === false → Purchase Gate (no runtime, no warming).
  const entitlementSkillId = String(skill.id).replace(/^store-/, '');
  const [gate, setGate] = useState<{
    loading: boolean;
    hasAccess: boolean | null;
    reason: string;
  }>({ loading: true, hasAccess: null, reason: '' });
  // Resolved price label for the gate panel (best-effort; falls back to "Premium").
  const [gatePriceLabel, setGatePriceLabel] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setGate({ loading: true, hasAccess: null, reason: '' });
    setGatePriceLabel(null);
    checkAccess(userId ?? 'anonymous', entitlementSkillId)
      .then((res) => {
        if (cancelled) return;
        setGate({ loading: false, hasAccess: res.hasAccess, reason: res.reason });
        // Only fetch pricing when actually gated — keeps free skills zero-cost.
        if (res.hasAccess === false) {
          getX402Pricing(entitlementSkillId)
            .then((p) => {
              if (cancelled) return;
              if (p?.fiat?.amount != null) {
                setGatePriceLabel(
                  p.fiat.display || formatPrice(p.fiat.amount, p.fiat.currency)
                );
              }
            })
            .catch(() => { /* fallback label handles this */ });
        }
      })
      .catch(() => {
        // Fail OPEN: if the check itself errors (network/worker down), don't
        // trap a legitimate user behind a gate — let the normal run path decide.
        if (!cancelled) setGate({ loading: false, hasAccess: true, reason: 'check_failed' });
      });
    return () => { cancelled = true; };
  }, [userId, entitlementSkillId]);

  // True while we must NOT touch any runtime: still checking, or gated.
  const gateBlocksRuntime = gate.loading || gate.hasAccess === false;

  // Connection state
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(true);
  const [serverVersion, setServerVersion] = useState('');
  const [connectionError, setConnectionError] = useState<string | null>(null);

  // Session state
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  // Sessions panel: open by default on desktop, collapsed on small screens so
  // the transcript + composer aren't squeezed (the top-bar toggle reopens it).
  const [showSessions, setShowSessions] = useState(
    () => typeof window === 'undefined' || window.innerWidth >= 768
  );

  // Chat state
  const [entries, setEntries] = useState<ChatEntry[]>([]);
  const [greetingEntry, setGreetingEntry] = useState<AssistantEntry | null>(null);
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

  // Model selection is per-runtime state (defined below, after RuntimeMode).

  // Runtime picker. `cf-cc` is the primary, production path: a PERSISTENT
  // warm Claude Code session over WebSocket (no per-turn cold start) —
  // this is what makes the web UX feel like using Claude Code directly,
  // so it is the default.
  //   cf-cc    → persistent warm Claude Code agent (cc-sandbox). DEFAULT.
  //   cf-ai    → Workers AI Llama 3.1 8B (single-shot chat, no tools)
  //   opencode → legacy local OpenCode SDK path (kept as a fallback)
  //   pi       → Pi coding agent (pi-sandbox), headless `pi -p --mode json`,
  //             KEYLESS over a Workers-AI OpenAI shim; streams real Pi output.
  type RuntimeMode = 'opencode' | 'cf-ai' | 'cf-cc' | 'pi';
  const [runtimeMode, setRuntimeMode] = useState<RuntimeMode>('cf-cc');

  // Per-runtime model selection. cc/oc run GLM models on z.ai; cf-ai and pi run
  // Workers AI (pi via its keyless OpenAI-compat shim). The <ModelPicker> writes
  // the chosen ModelConfig for whichever runtime is active; every run path below
  // reads `selectedModel`.
  const [modelByRuntime, setModelByRuntime] = useState<Record<RuntimeMode, ModelConfig>>({
    'cf-cc':    { providerID: 'zhipuai-coding-plan', modelID: 'glm-4.5-air' },
    'opencode': { providerID: 'zhipuai-coding-plan', modelID: 'glm-4.5-air' },
    'cf-ai':    { providerID: 'workers-ai',          modelID: '@cf/meta/llama-3.1-8b-instruct-fast' },
    'pi':       { providerID: 'workers-ai',          modelID: '@cf/meta/llama-3.3-70b-instruct-fp8-fast' },
  });
  const selectedModel = modelByRuntime[runtimeMode];
  const setSelectedModel = (m: ModelConfig) =>
    setModelByRuntime((prev) => ({ ...prev, [runtimeMode]: m }));
  const [cfBudget, setCfBudget] = useState<CFBudget | null>(null);
  const [ccBudget, setCcBudget] = useState<CCBudget | null>(null);
  const [ocBudget, setOcBudget] = useState<OCBudget | null>(null);
  // Repo to clone in the sandbox (optional). Empty means "use the
  // pre-baked scratch workspace" — much faster for skill execution
  // since the SKILL.md is delivered via system prompt anyway.
  const [sandboxRepo, setSandboxRepo] = useState<string>('');
  // Coarse-grained "what is the sandbox doing" indicator (sandbox modes)
  const [sandboxPhase, setSandboxPhase] = useState<string | null>(null);
  // Elapsed-time ticker during a sandbox run, so the user sees
  // "Sandbox: opencode… (24s)" instead of a frozen-looking spinner
  // when z.ai's TTFT is being slow.
  const [sandboxElapsed, setSandboxElapsed] = useState(0);
  useEffect(() => {
    if (!sandboxPhase) {
      setSandboxElapsed(0);
      return;
    }
    const startedAt = Date.now();
    setSandboxElapsed(0);
    const id = window.setInterval(() => {
      setSandboxElapsed(Math.floor((Date.now() - startedAt) / 1000));
    }, 500);
    return () => window.clearInterval(id);
  }, [sandboxPhase]);
  useEffect(() => {
    if (isComingSoon) return; // no runtime to warm for import-only formats
    if (isMcp) return; // MCP renders its own view (McpServerView), which warms itself
    // Gated/while-checking: do NOT warm any container for a skill the user
    // can't run yet. Warming resumes automatically once the gate clears.
    if (gateBlocksRuntime) return;
    if (isLangGraph) {
      // Pre-boot the LangGraph sandbox container so the first run skips the
      // cold boot. Best-effort; the runtime picker doesn't apply here.
      warmLangGraph();
      return;
    }
    if (isN8n) {
      // Pre-boot the n8n sandbox container (provision + resident n8n CLI) so
      // the first run skips the cold boot. Best-effort.
      warmN8n();
      return;
    }
    if (isDynamicWorker) {
      // Pre-warm the Worker Loader path (loads + invokes the bundled example)
      // so the first real run is hot. Only when actually reachable from here.
      if (dwDeployed) warmDynamicWorker();
      return;
    }
    if (runtimeMode === 'cf-ai') getCFBudget().then(setCfBudget);
    if (runtimeMode === 'cf-cc') {
      getCCBudget().then(setCcBudget);
      // Pre-boot the warm container so the first turn has no cold start.
      warmClaudeAgent();
    }
    if (runtimeMode === 'opencode') {
      getOCBudget().then(setOcBudget);
      // Pre-boot the OpenCode container + opencode-server so the first turn
      // skips the cold start (container wake + provider init). Best-effort.
      warmOpenCode();
    }
    if (runtimeMode === 'pi') {
      // Pre-boot the Pi sandbox container (provision + resident pi CLI +
      // models.json) so the first run skips the cold boot. Best-effort.
      warmPi();
    }
  }, [runtimeMode, isComingSoon, isMcp, isLangGraph, isN8n, isDynamicWorker, dwDeployed, gateBlocksRuntime]);

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
    // coming-soon formats never touch the sandbox — skip connecting/warming.
    // MCP renders its own dedicated view, so the opencode chat path never runs.
    if (isComingSoon || isMcp) {
      setConnecting(false);
      return;
    }
    // Gated/while-checking: don't open an opencode session/server for a skill
    // the user can't run. The gate panel renders instead; once it clears this
    // effect re-runs and connects normally.
    if (gateBlocksRuntime) return;
    // LangGraph / n8n run against their dedicated sandbox worker directly (no
    // opencode session/server). Mark connected so the transcript + composer
    // render, and skip the opencode.connect()/listSessions flow entirely.
    if (isFixedRuntime) {
      setConnected(true);
      setConnecting(false);
      return;
    }
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
  }, [skill, isComingSoon, isMcp, isFixedRuntime, gateBlocksRuntime]);

  // ── Auto-scroll ─────────────────────────────────────────────────────────

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [entries]);

  // ── Greeting: skill introduces itself on first open ─────────────────────

  useEffect(() => {
    if (!connected || connecting || greetingEntry) return;
    const greeting: AssistantEntry = {
      type: 'assistant',
      messageId: `greeting-${Date.now()}`,
      parts: [{
        id: `greeting-part-${Date.now()}`,
        sessionID: '',
        messageID: `greeting-${Date.now()}`,
        type: 'text' as const,
        text: `Hi! I'm **${skill.name}**.\n\n${skill.description}\n\nHow can I help you today?`,
      }],
      isComplete: true,
    };
    setGreetingEntry(greeting);
  }, [connected, connecting, greetingEntry, skill.name, skill.description]);

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
    if ((!text && attachedFiles.length === 0) || isRunning) return;

    // Defensive: if the skill markdown isn't loaded yet but we *have* a URL,
    // fetch it inline so the request never goes out without instructions.
    // This is a safety net in addition to the input-disable while loading.
    let resolvedSkillInstructions = skillInstructions;
    if (!resolvedSkillInstructions && skill.skillMdUrl) {
      try {
        const parsed = await fetchSkillMd(skill.skillMdUrl);
        resolvedSkillInstructions = parsed.instructions;
        // Cache for subsequent sends in this window
        setSkillInstructions(parsed.instructions);
        setSkillLoadStatus('loaded');
      } catch {
        // Fall back to systemPrompt/description; better than nothing
        resolvedSkillInstructions = skill.config.systemPrompt || skill.description || null;
      }
    }

    // ── LangGraph runtime branch (real graph execution) ─────────────────
    // Runs the seed item's graph in the cf-langgraph container sandbox and
    // streams its output into the transcript as a single, growing text part.
    // The graph's LLM calls go through the worker's Workers-AI OpenAI shim.
    if (isLangGraph) {
      setInput('');
      setAttachedFiles([]);
      setIsRunning(true);
      setConnectionError(null);
      setSandboxPhase('starting');

      const userEntry: UserEntry = { type: 'user', text, time: Date.now() };
      const msgId = `lg-${Date.now()}`;
      const partId = `lg-part-${Date.now()}`;
      const placeholder: AssistantEntry = {
        type: 'assistant',
        messageId: msgId,
        parts: [{ id: partId, sessionID: 'lg', messageID: msgId, type: 'text', text: '' } as TextPart],
        isComplete: false,
      };
      setEntries(prev => [...prev, userEntry, placeholder]);

      // Accumulate streamed stdout; re-render the placeholder's text part as
      // chunks arrive (throttled via rAF so token bursts don't tank perf).
      let log = '';
      let rafScheduled = false;
      let runDone = false;
      const flushLog = () => {
        if (rafScheduled || runDone) return;
        rafScheduled = true;
        requestAnimationFrame(() => {
          rafScheduled = false;
          const snapshot = log;
          setEntries(prev => prev.map(e =>
            e.type === 'assistant' && e.messageId === msgId
              ? { ...e, parts: [{ id: partId, sessionID: 'lg', messageID: msgId, type: 'text', text: snapshot } as TextPart] }
              : e
          ));
        });
      };
      const finalize = (extra?: string) => {
        runDone = true;
        if (extra) log += extra;
        const snapshot = log.trim() || '(no output)';
        setEntries(prev => prev.map(e =>
          e.type === 'assistant' && e.messageId === msgId
            ? { ...e, isComplete: true, parts: [{ id: partId, sessionID: 'lg', messageID: msgId, type: 'text', text: snapshot } as TextPart] }
            : e
        ));
      };

      try {
        await streamLangGraphRun(
          // `fresh: true` — the sandbox container caches the fetched graph at a
          // fixed path; without this a warm container would re-run whichever
          // graph was fetched first instead of THIS item's artifactUrl.
          { artifactUrl: skill.artifactUrl, task: text, fresh: true },
          {
            onPhase: (phase) => setSandboxPhase(phase),
            onStdout: (chunk) => {
              log += chunk;
              flushLog();
            },
            onResult: () => {
              setSandboxPhase(null);
              finalize();
            },
            onError: (err) => {
              setSandboxPhase(null);
              finalize(`\n\n**Error:** ${err.message}`);
              setConnectionError(err.message);
              setTimeout(() => setConnectionError(null), 8000);
            },
          },
        );
        if (!runDone) finalize();
      } catch (err) {
        // onError already finalized; this just guards the network/throw path.
        if (!runDone) {
          const msg = err instanceof Error ? err.message : String(err);
          finalize(`\n\n**Error:** ${msg}`);
        }
      } finally {
        setSandboxPhase(null);
        setIsRunning(false);
      }
      return;
    }

    // ── n8n runtime branch (real workflow execution) ────────────────────
    // Imports the item's workflow JSON into a headless n8n CLI in the cf-n8n
    // container sandbox and executes it once, streaming node-by-node execution
    // + the run result into the transcript as a single, growing markdown part.
    if (isN8n) {
      setInput('');
      setAttachedFiles([]);
      setIsRunning(true);
      setConnectionError(null);
      setSandboxPhase('starting');

      const userEntry: UserEntry = { type: 'user', text, time: Date.now() };
      const msgId = `n8n-${Date.now()}`;
      const partId = `n8n-part-${Date.now()}`;
      const placeholder: AssistantEntry = {
        type: 'assistant',
        messageId: msgId,
        parts: [{ id: partId, sessionID: 'n8n', messageID: msgId, type: 'text', text: '' } as TextPart],
        isComplete: false,
      };
      setEntries(prev => [...prev, userEntry, placeholder]);

      // Build a readable markdown log as events arrive: a "Nodes" list as they
      // are detected, then the live run output, then the parsed result.
      const nodes: string[] = [];
      let runLog = '';
      let rafScheduled = false;
      let runDone = false;
      const composed = () => {
        let md = '';
        if (nodes.length) {
          md += `**Workflow nodes**\n${nodes.map(n => `- ${n}`).join('\n')}\n\n`;
        }
        if (runLog.trim()) {
          md += `**Run log**\n\n\`\`\`\n${runLog.trimEnd()}\n\`\`\`\n`;
        }
        return md;
      };
      const flush = () => {
        if (rafScheduled || runDone) return;
        rafScheduled = true;
        requestAnimationFrame(() => {
          rafScheduled = false;
          const snapshot = composed();
          setEntries(prev => prev.map(e =>
            e.type === 'assistant' && e.messageId === msgId
              ? { ...e, parts: [{ id: partId, sessionID: 'n8n', messageID: msgId, type: 'text', text: snapshot } as TextPart] }
              : e
          ));
        });
      };
      const finalize = (extra?: string) => {
        runDone = true;
        let md = composed();
        if (extra) md += extra;
        const snapshot = md.trim() || '(no output)';
        setEntries(prev => prev.map(e =>
          e.type === 'assistant' && e.messageId === msgId
            ? { ...e, isComplete: true, parts: [{ id: partId, sessionID: 'n8n', messageID: msgId, type: 'text', text: snapshot } as TextPart] }
            : e
        ));
      };

      try {
        await streamN8nRun(
          // `fresh: true` — the sandbox container caches the fetched workflow
          // JSON at a fixed path; without this a warm container would re-run
          // whichever workflow was fetched first instead of THIS item's.
          { artifactUrl: skill.artifactUrl, input: text, fresh: true },
          {
            onPhase: (phase) => setSandboxPhase(phase),
            onNode: (n) => { nodes.push(n.name); flush(); },
            onStdout: (chunk) => { runLog += chunk; flush(); },
            onResult: (data) => {
              setSandboxPhase(null);
              // Append a compact summary of the parsed run result, if present.
              let summary = '';
              const r = data.result as
                | { data?: { resultData?: { lastNodeExecuted?: string; runData?: Record<string, unknown> } }; status?: string }
                | undefined;
              if (r && r.data?.resultData) {
                const last = r.data.resultData.lastNodeExecuted;
                const status = r.status ?? (data.success ? 'success' : 'error');
                summary = `\n**Result:** status \`${status}\`${last ? ` · last node \`${last}\`` : ''}${typeof data.exitCode === 'number' ? ` · exit ${data.exitCode}` : ''}\n`;
              } else {
                summary = `\n**Result:** ${data.success ? 'success' : 'failed'}${typeof data.exitCode === 'number' ? ` · exit ${data.exitCode}` : ''}\n`;
              }
              finalize(summary);
            },
            onError: (err) => {
              setSandboxPhase(null);
              finalize(`\n\n**Error:** ${err.message}`);
              setConnectionError(err.message);
              setTimeout(() => setConnectionError(null), 8000);
            },
          },
        );
        if (!runDone) finalize();
      } catch (err) {
        if (!runDone) {
          const msg = err instanceof Error ? err.message : String(err);
          finalize(`\n\n**Error:** ${msg}`);
        }
      } finally {
        setSandboxPhase(null);
        setIsRunning(false);
      }
      return;
    }

    // ── Dynamic Worker runtime branch (Worker Loader execution) ─────────
    // Loads this item's self-contained JS Worker module into the dw-sandbox
    // worker via the Worker Loader (env.LOADER) and runs it on the fly,
    // streaming the run log + the module's JSON result into the transcript as a
    // single, growing markdown part. The user's typed text is forwarded as JSON
    // `input` to the module's fetch (parsed if it's valid JSON, else wrapped).
    if (isDynamicWorker) {
      setInput('');
      setAttachedFiles([]);

      const userEntry: UserEntry = { type: 'user', text, time: Date.now() };
      const msgId = `dw-${Date.now()}`;
      const partId = `dw-part-${Date.now()}`;

      // betaBlocked guard: if dw-sandbox only deployed locally (account not
      // enrolled in the Worker Loader closed beta), the deployed Pages site
      // cannot reach the localhost dev URL — so don't attempt a run that would
      // just error. Render the item + a clear inline note instead.
      if (!dwDeployed) {
        const note =
          `**${runtimeDescriptor.label}** execution is pending Cloudflare closed-beta enrollment — ` +
          `runs in local dev only.\n\n` +
          `The \`dw-sandbox\` worker (Worker Loader / \`env.LOADER\`) is not deployed to a public ` +
          `origin for this account, so the deployed site can't reach it. To try it locally, run ` +
          `\`cd cf-dynamic-worker && npx wrangler dev --port 8799\` and set ` +
          `\`VITE_DW_SANDBOX_URL=http://127.0.0.1:8799\`.` +
          (skill.artifactUrl ? `\n\nModule artifact: ${skill.artifactUrl}` : '');
        setEntries(prev => [...prev, userEntry, {
          type: 'assistant',
          messageId: msgId,
          parts: [{ id: partId, sessionID: 'dw', messageID: msgId, type: 'text', text: note } as TextPart],
          isComplete: true,
        }]);
        return;
      }

      setIsRunning(true);
      setConnectionError(null);
      setSandboxPhase('starting');

      const placeholder: AssistantEntry = {
        type: 'assistant',
        messageId: msgId,
        parts: [{ id: partId, sessionID: 'dw', messageID: msgId, type: 'text', text: '' } as TextPart],
        isComplete: false,
      };
      setEntries(prev => [...prev, userEntry, placeholder]);

      // Forward the typed text as the module's JSON `input`: if it parses as
      // JSON use it directly, otherwise pass it as { text } (the example modules
      // both read `text`). Empty input → undefined (module uses its defaults).
      let dwInput: unknown;
      if (text.trim()) {
        try { dwInput = JSON.parse(text); }
        catch { dwInput = { text }; }
      }

      // Build a readable markdown log: source-resolution line, run-log lines,
      // then the parsed JSON result fenced as a code block.
      let setupLine = '';
      const logLines: string[] = [];
      let resultBlock = '';
      let rafScheduled = false;
      let runDone = false;
      const composed = () => {
        let md = '';
        if (setupLine) md += `${setupLine}\n\n`;
        if (logLines.length) {
          md += `**Run log**\n\n\`\`\`\n${logLines.join('\n')}\n\`\`\`\n`;
        }
        if (resultBlock) md += resultBlock;
        return md;
      };
      const flush = () => {
        if (rafScheduled || runDone) return;
        rafScheduled = true;
        requestAnimationFrame(() => {
          rafScheduled = false;
          const snapshot = composed();
          setEntries(prev => prev.map(e =>
            e.type === 'assistant' && e.messageId === msgId
              ? { ...e, parts: [{ id: partId, sessionID: 'dw', messageID: msgId, type: 'text', text: snapshot } as TextPart] }
              : e
          ));
        });
      };
      const finalize = (extra?: string) => {
        runDone = true;
        let md = composed();
        if (extra) md += extra;
        const snapshot = md.trim() || '(no output)';
        setEntries(prev => prev.map(e =>
          e.type === 'assistant' && e.messageId === msgId
            ? { ...e, isComplete: true, parts: [{ id: partId, sessionID: 'dw', messageID: msgId, type: 'text', text: snapshot } as TextPart] }
            : e
        ));
      };

      try {
        await streamDynamicWorkerRun(
          // `fresh: true` — force env.LOADER.load so each run re-fetches and runs
          // THIS item's module rather than serving a hash-cached earlier one.
          { artifactUrl: skill.artifactUrl, input: dwInput, fresh: true },
          {
            onPhase: (phase) => setSandboxPhase(phase),
            onSetup: (data) => {
              const src = data.source ?? 'module';
              const meta = [
                data.mainModule ? `\`${data.mainModule}\`` : null,
                typeof data.bytes === 'number' ? `${data.bytes} bytes` : null,
                data.hash ? `hash \`${data.hash}\`` : null,
                data.mode ? data.mode : null,
              ].filter(Boolean).join(' · ');
              setupLine = `**Module** (${src})${meta ? ` — ${meta}` : ''}`;
              flush();
            },
            onLog: (l) => { logLines.push(l.text); flush(); },
            onResult: (data) => {
              setSandboxPhase(null);
              const status = typeof data.status === 'number' ? data.status : (data.success ? 200 : 500);
              const payload = data.result !== undefined
                ? JSON.stringify(data.result, null, 2)
                : (data.raw ?? '');
              resultBlock =
                `\n**Result:** ${data.success ? 'success' : 'failed'} · HTTP \`${status}\`` +
                (data.hash ? ` · hash \`${data.hash}\`` : '') + `\n\n` +
                (payload ? `\`\`\`json\n${payload}\n\`\`\`\n` : '');
              finalize();
            },
            onError: (err) => {
              setSandboxPhase(null);
              finalize(`\n\n**Error:** ${err.message}`);
              setConnectionError(err.message);
              setTimeout(() => setConnectionError(null), 8000);
            },
          },
        );
        if (!runDone) finalize();
      } catch (err) {
        if (!runDone) {
          const msg = err instanceof Error ? err.message : String(err);
          finalize(`\n\n**Error:** ${msg}`);
        }
      } finally {
        setSandboxPhase(null);
        setIsRunning(false);
      }
      return;
    }

    // ── Cloudflare Workers AI branch (single-shot chat) ─────────────────
    if (runtimeMode === 'cf-ai') {
      setInput('');
      setAttachedFiles([]);
      setIsRunning(true);
      setConnectionError(null);

      const userEntry: UserEntry = { type: 'user', text, time: Date.now() };
      setEntries(prev => [...prev, userEntry]);

      try {
        // Build message history from existing entries (last 6 turns)
        const history: { role: 'user' | 'assistant'; content: string }[] = [];
        for (const e of entries.slice(-12)) {
          if (e.type === 'user') {
            history.push({ role: 'user', content: e.text });
          } else if (e.type === 'assistant') {
            const textPart = e.parts.find(p => p.type === 'text') as TextPart | undefined;
            if (textPart?.text) history.push({ role: 'assistant', content: textPart.text });
          }
        }
        history.push({ role: 'user', content: text });

        const systemPrompt = resolvedSkillInstructions
          ? `You are helping with the skill "${skill.name}". Stay on-topic.\n\n${resolvedSkillInstructions.slice(0, 800)}`
          : `You are a concise AI assistant.`;

        const reply = await sendCFChat(
          [
            { role: 'system', content: systemPrompt },
            ...history,
          ],
          selectedModel?.modelID,
        );

        const msgId = `cf-${Date.now()}`;
        const assistantEntry: AssistantEntry = {
          type: 'assistant',
          messageId: msgId,
          parts: [{
            id: `cf-part-${Date.now()}`,
            sessionID: 'cf',
            messageID: msgId,
            type: 'text',
            text: reply.content,
          } as TextPart],
          isComplete: true,
        };
        setEntries(prev => [...prev, assistantEntry]);
        setCfBudget(b => b ? { ...b, used: reply.budget.used, remaining: Math.max(0, b.limit - reply.budget.used) } : b);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setConnectionError(msg);
        setTimeout(() => setConnectionError(null), 8000);
      } finally {
        setIsRunning(false);
      }
      return;
    }

    // ── Pi runtime branch (headless `pi -p --mode json`, keyless) ────────
    // Runs the Pi coding agent in the pi-sandbox container and streams its JSON
    // event output into a live "terminal log" markdown — setup, session header,
    // streamed assistant text / reasoning, tool calls, then the result. Mirrors
    // the OpenCode branch's render shape. The SKILL.md is delivered to Pi via
    // its appended system prompt (skillMd), so it runs AS the marketplace skill.
    if (runtimeMode === 'pi') {
      setInput('');
      setAttachedFiles([]);
      setIsRunning(true);
      setConnectionError(null);
      setSandboxPhase('starting');

      const userEntry: UserEntry = { type: 'user', text, time: Date.now() };
      const msgId = `pi-${Date.now()}`;
      const partId = `pi-part-${Date.now()}`;
      const placeholder: AssistantEntry = {
        type: 'assistant',
        messageId: msgId,
        parts: [{ id: partId, sessionID: 'pi', messageID: msgId, type: 'text', text: '' } as TextPart],
        isComplete: false,
      };
      setEntries(prev => [...prev, userEntry, placeholder]);

      // Live markdown log buffer, coalesced to one setEntries per animation
      // frame so Pi's token-level `stdout` text deltas don't tank perceived perf.
      let log = '';
      let rafScheduled = false;
      let runDone = false;
      const flushLog = () => {
        if (rafScheduled || runDone) return;
        rafScheduled = true;
        requestAnimationFrame(() => {
          rafScheduled = false;
          const snapshot = log;
          setEntries(prev => prev.map(e =>
            e.type === 'assistant' && e.messageId === msgId
              ? { ...e, parts: [{ id: partId, sessionID: 'pi', messageID: msgId, type: 'text', text: snapshot } as TextPart] }
              : e
          ));
        });
      };
      const finishImmediately = (extraLine?: string) => {
        if (extraLine) log += extraLine;
        runDone = true;
        const snapshot = log.trim() || '(no output)';
        setEntries(prev => prev.map(e =>
          e.type === 'assistant' && e.messageId === msgId
            ? { ...e, isComplete: true, parts: [{ id: partId, sessionID: 'pi', messageID: msgId, type: 'text', text: snapshot } as TextPart] }
            : e
        ));
        setIsRunning(false);
        setSandboxPhase(null);
      };

      const startedAt = Date.now();
      // `fast` uses the smaller/faster Workers-AI model (llama-3.1-8b); the 70B
      // default carries the model id we seed for pi above.
      const fast = selectedModel?.modelID?.includes('8b') ?? false;

      try {
        await streamPiRun(
          {
            task: text,
            skillMd: resolvedSkillInstructions ?? undefined,
            fast,
          },
          {
            onPhase: (phase) => {
              setSandboxPhase(phase);
              flushLog();
            },
            onSetup: (data) => {
              const provider = (data as { provider?: string }).provider;
              const model = (data as { model?: string }).model;
              if (model) log += `model: \`${model}\`${provider ? ` _(${provider})_` : ''}\n`;
              flushLog();
            },
            onSession: (s) => {
              if (s.sessionId) log += `session: \`${s.sessionId}\`${s.cwd ? ` · cwd \`${s.cwd}\`` : ''}\n`;
              flushLog();
            },
            onStdout: (ev: PiStdoutEvent) => {
              switch (ev.type) {
                case 'text':
                  if (ev.text) log += ev.text;
                  break;
                case 'reasoning':
                  if (ev.text) log += `\n> ${ev.text.replace(/\n/g, '\n> ')}\n`;
                  break;
                case 'tool_use':
                  log += `\n🔧 **${ev.name ?? 'tool'}**${ev.args ? ` \`${typeof ev.args === 'string' ? ev.args.slice(0, 200) : JSON.stringify(ev.args).slice(0, 200)}\`` : ''}\n`;
                  break;
                case 'tool_result': {
                  const out = ev.text ?? '';
                  const trimmed = out.length > 600 ? out.slice(0, 600) + `\n…(+${out.length - 600} chars)` : out;
                  log += `${ev.isError ? '❌' : '↪'} \`\`\`\n${trimmed}\n\`\`\`\n`;
                  break;
                }
                case 'step_start':
                  log += `\n▶ _step_\n`;
                  break;
                case 'step_finish':
                  log += `\n_step finished${ev.reason ? ` — ${ev.reason}` : ''}_\n`;
                  break;
                default:
                  if (ev.text) log += ev.text;
                  break;
              }
              flushLog();
            },
            onResult: (res) => {
              // The streamed `stdout` text deltas already carry the complete
              // answer; result.text is a best-effort accumulation (may clip the
              // first token), so we don't re-append it — just close out.
              const dur = ((Date.now() - startedAt) / 1000).toFixed(1);
              const tail = res.success
                ? `\n✓ **finished** in ${dur}s${res.model ? ` · \`${res.model}\`` : ''}\n`
                : `\n❌ **failed**${res.error ? ` — ${res.error}` : ''} (${dur}s)\n`;
              finishImmediately(tail);
            },
            onError: (err) => {
              setConnectionError(err.message);
              setTimeout(() => setConnectionError(null), 8000);
            },
          },
        );
        // Fallback if result never came (network drop, etc.)
        if (!runDone) {
          const dur = ((Date.now() - startedAt) / 1000).toFixed(1);
          finishImmediately(`\n✓ **finished** in ${dur}s\n`);
        }
      } catch (err) {
        if (!runDone) {
          const msg = err instanceof Error ? err.message : String(err);
          finishImmediately(`\n\n**Error:** ${msg}`);
        }
      } finally {
        setIsRunning(false);
        setSandboxPhase(null);
      }
      return;
    }

    // ── Sandbox modes (OpenCode / Claude Code on Cloudflare) ─────────────
    // Both modes render every sandbox event as a line in a live "terminal
    // log" markdown — phases, tool calls, thinking, streamed text, results.
    if (runtimeMode === 'opencode' || runtimeMode === 'cf-cc') {
      // Empty repo means "use the sandbox's pre-baked scratch workspace" —
      // no clone, no R2 restore, fastest TTFR. The skill itself is sent
      // via skillMd → system prompt, so the agent doesn't need files
      // from a specific repo for most skill executions.
      setInput('');
      setAttachedFiles([]);
      setIsRunning(true);
      setConnectionError(null);
      setSandboxPhase('starting');

      const userEntry: UserEntry = { type: 'user', text, time: Date.now() };
      const kind = runtimeMode === 'cf-cc' ? 'cc' : 'oc';
      const msgId = `${kind}-${Date.now()}`;
      const partId = `${kind}-part-${Date.now()}`;
      const placeholder: AssistantEntry = {
        type: 'assistant',
        messageId: msgId,
        parts: [{
          id: partId, sessionID: kind, messageID: msgId, type: 'text', text: '',
        } as TextPart],
        isComplete: false,
      };
      setEntries(prev => [...prev, userEntry, placeholder]);

      // Live log buffer: keep building markdown as events stream.
      let log = '';
      // Track current open block(s) so we can format streaming deltas correctly.
      const openBlocks = new Map<number, { type: 'text' | 'thinking' | 'tool_use'; tool?: string; inputJson?: string }>();
      let pushedSection: string | null = null;

      // ─ render throttle ─────────────────────────────────────────
      // Token-level events fire dozens of times per second; re-parsing the
      // full markdown on each one tanks perceived perf. We coalesce into
      // one setEntries per animation frame (~16ms / 60fps).
      let rafScheduled = false;
      let runDone = false;  // once result/success arrives, stop updating UI
      const flushLog = () => {
        if (rafScheduled || runDone) return;
        rafScheduled = true;
        requestAnimationFrame(() => {
          rafScheduled = false;
          setEntries(prev => prev.map(e => {
            if (e.type !== 'assistant' || e.messageId !== msgId) return e;
            return { ...e, parts: [{ ...(e.parts[0] as TextPart), text: log }] };
          }));
        });
      };
      const finishImmediately = (extraLine?: string) => {
        if (extraLine) log += extraLine;
        runDone = true;
        // One last synchronous flush so the final text + ✓ is visible
        setEntries(prev => prev.map(e => {
          if (e.type !== 'assistant' || e.messageId !== msgId) return e;
          return { ...e, parts: [{ ...(e.parts[0] as TextPart), text: log }], isComplete: true };
        }));
        setIsRunning(false);
        setSandboxPhase(null);
      };

      const startSection = (label: string) => {
        if (pushedSection !== label) {
          if (log && !log.endsWith('\n')) log += '\n';
          log += `\n**[${label}]**\n`;
          pushedSection = label;
        }
      };

      const startedAt = Date.now();
      try {
        if (runtimeMode === 'cf-cc') {
          await streamClaudeCodeRun(
            {
              repo: sandboxRepo || undefined,  // empty → sandbox uses scratch
              task: text,
              skillMd: resolvedSkillInstructions ?? undefined,
              // Let the Worker re-resolve SKILL.md server-side (no CORS) when
              // the in-browser fetch above failed/returned nothing — the
              // reliable fallback so the agent runs AS the skill.
              skillMdUrl: skill.skillMdUrl,
              skillName: skill.name,
              model: selectedModel.modelID,
            },
            {
              onPhase: (phase) => {
                setSandboxPhase(phase);
                startSection(phase);
                flushLog();
              },
              onSandboxEvent: (ev, data) => {
                if (ev === 'restore') {
                  const skipped = (data as { skipped?: boolean }).skipped;
                  log += skipped
                    ? `✓ _restore skipped (warm scratch)_\n`
                    : `✓ container ready (${data.ms ?? '?'}ms)\n`;
                }
                else if (ev === 'setup') {
                  const skipped = (data as { skipped?: boolean }).skipped;
                  const tail = (data as { tail?: string }).tail;
                  log += `✓ ${skipped ? '_skipped (warm scratch)_' : (tail || 'cloned')}\n`;
                }
                else if (ev === 'claude_ttfo') {
                  const ms = (data as { ms?: number }).ms ?? 0;
                  log += `✓ **first response** in ${(ms / 1000).toFixed(1)}s\n`;
                }
                else if (ev === 'stall-warning') {
                  const msg = (data as { message?: string }).message ?? 'model stalled';
                  log += `\n⚠ **${msg}**\n`;
                }
                else if (ev === 'done') log += `\n✓ done\n`;
                flushLog();
              },
              onSystemInit: (info) => {
                if (info.model) log += `model: \`${info.model}\`\n`;
                if (info.cwd) log += `cwd: \`${info.cwd}\`\n`;
                if (info.tools?.length) log += `tools: ${info.tools.map(t => `\`${t}\``).join(' · ')}\n`;
                flushLog();
              },
              onBlockStart: (b) => {
                openBlocks.set(b.index, { type: b.type, tool: b.tool?.name, inputJson: '' });
                if (b.type === 'thinking') {
                  log += `\n🤔 _thinking…_\n\n> `;
                } else if (b.type === 'tool_use') {
                  log += `\n🔧 **${b.tool?.name ?? 'tool'}** \`\``;  // double-tick so input_json_delta below appends inside backticks
                } else if (b.type === 'text') {
                  log += `\n💬 `;
                }
                flushLog();
              },
              onTextDelta: (d) => { log += d; flushLog(); },
              onThinkingDelta: (d) => { log += d.replace(/\n/g, '\n> '); flushLog(); },
              onToolInputDelta: (d, idx) => {
                const blk = openBlocks.get(idx);
                if (blk) blk.inputJson = (blk.inputJson || '') + d;
                // Append visibly so the user sees args appear live
                log += d;
                flushLog();
              },
              onBlockStop: (idx) => {
                const blk = openBlocks.get(idx);
                if (blk?.type === 'tool_use') log += `\`\n`;
                else if (blk?.type === 'thinking') log += `\n`;
                else if (blk?.type === 'text') log += `\n`;
                openBlocks.delete(idx);
                flushLog();
              },
              onToolResult: (r) => {
                const trimmed = r.content.length > 600
                  ? r.content.slice(0, 600) + `\n…(+${r.content.length - 600} chars)`
                  : r.content;
                log += `${r.isError ? '❌' : '↪'} ${'```'}\n${trimmed}\n${'```'}\n`;
                flushLog();
              },
              onAssistantFinal: () => { /* already streamed via deltas */ },
              onResult: (res) => {
                // Cut the user-perceived wait short: snapshot/diff/done
                // events still arrive after this but they're just the
                // sandbox saving state to R2 for the next warm run.
                const dur = res.durationMs != null
                  ? `${(res.durationMs / 1000).toFixed(1)}s`
                  : `${((Date.now() - startedAt) / 1000).toFixed(1)}s`;
                finishImmediately(`\n✓ **finished** in ${dur}\n`);
              },
              onError: (err) => {
                setConnectionError(err.message);
                setTimeout(() => setConnectionError(null), 8000);
              },
            },
          );
          // Fallback if result/success never came (network drop, etc.)
          if (!runDone) {
            const dur = ((Date.now() - startedAt) / 1000).toFixed(1);
            finishImmediately(`\n✓ **finished** in ${dur}s\n`);
          }
        } else {
          // OpenCode mode — full text per part, plus tool_use with state.input/output
          await streamOpenCodeRun(
            {
              repo: sandboxRepo || undefined,
              task: text,
              model: `${selectedModel.providerID}/${selectedModel.modelID}`,
              skillMd: resolvedSkillInstructions ?? undefined,
            },
            {
              onPhase: (phase) => {
                setSandboxPhase(phase);
                startSection(phase);
                flushLog();
              },
              onSandboxEvent: (ev, data) => {
                if (ev === 'restore') {
                  const skipped = (data as { skipped?: boolean }).skipped;
                  log += skipped
                    ? `✓ _restore skipped (warm scratch)_\n`
                    : `✓ container ready (${data.ms ?? '?'}ms)\n`;
                }
                else if (ev === 'setup') {
                  const skipped = (data as { skipped?: boolean }).skipped;
                  const tail = (data as { tail?: string }).tail;
                  log += `✓ ${skipped ? '_skipped (warm scratch)_' : (tail || 'cloned')}\n`;
                }
                else if (ev === 'server') {
                  const state = (data as { state?: string }).state;
                  if (state === 'spawning') log += `… spawning opencode server\n`;
                  else if (state === 'force-restart') log += `↻ restarting opencode server\n`;
                  else if (state === 'unhealthy') log += `↻ opencode server unhealthy — restarting\n`;
                  else if (state === 'ready') log += `✓ opencode server ready (${(data as { ms?: number }).ms ?? '?'}ms)\n`;
                }
                else if (ev === 'opencode-submit') {
                  const ok = (data as { ok?: boolean }).ok;
                  if (!ok) log += `❌ submit failed: ${(data as { status?: string }).status ?? '?'}\n`;
                }
                else if (ev === 'stall-diagnostics') {
                  log += `\n⚠ **agent stalled** — no events from upstream\n`;
                }
                flushLog();
              },
              onStderr: (line) => {
                log += `\`${line.replace(/\n/g, ' ')}\`\n`;
                flushLog();
              },
              onStepStart: () => {
                log += `\n▶ _step_\n`;
                flushLog();
              },
              onText: (t) => {
                log += `\n💬 ${t}\n`;
                flushLog();
              },
              onToolUse: (info) => {
                const args = info.input
                  ? Object.entries(info.input)
                      .map(([k, v]) => `${k}=${typeof v === 'string' ? v.slice(0, 120) : JSON.stringify(v).slice(0, 120)}`)
                      .join(', ')
                  : '';
                log += `\n🔧 **${info.tool}** \`${args}\`\n`;
                if (info.output) {
                  const out = info.output.length > 500
                    ? info.output.slice(0, 500) + `\n…(+${info.output.length - 500} chars)`
                    : info.output;
                  log += `${info.isError ? '❌' : '↪'} \`\`\`\n${out}\n\`\`\`\n`;
                }
                flushLog();
              },
              onStepFinish: (info) => {
                const tk = info.tokens;
                log += `_step finished — reason: ${info.reason}${tk?.total ? `, ${tk.total} tokens` : ''}_\n`;
                // Cut UX wait short: when OpenCode reports the agent's
                // final stop reason, we're done. The sandbox still emits
                // opencode_ms/diff/snapshot/done over the next ~2s but
                // those are post-processing — user already has the answer.
                if (info.reason === 'stop' || info.reason === 'end_turn') {
                  const dur = ((Date.now() - startedAt) / 1000).toFixed(1);
                  finishImmediately(`\n✓ **finished** in ${dur}s\n`);
                } else {
                  flushLog();
                }
              },
              onError: (err) => {
                setConnectionError(err.message);
                setTimeout(() => setConnectionError(null), 8000);
              },
            },
          );
          // If step_finish/stop never came (timeout, error path), finalize anyway
          if (!runDone) {
            const dur = ((Date.now() - startedAt) / 1000).toFixed(1);
            finishImmediately(`\n✓ **finished** in ${dur}s\n`);
          }
        }
      } finally {
        setIsRunning(false);
        setSandboxPhase(null);
      }
      return;
    }

    // If not connected yet, wait briefly for connection to establish
    if (!connected) {
      setConnectionError('Still connecting to server, please try again in a moment.');
      setTimeout(() => setConnectionError(null), 3000);
      return;
    }

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
    let retryCount = 0;

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

        // Detect infinite retry loop: if the backend keeps retrying without
        // producing any content, the AI model is likely unreachable.
        if (status === 'retry') {
          retryCount++;
          if (retryCount >= 3 && partUpdateCount === 0) {
            console.error(`[SkillExec] ${cbTs()} Model retry loop detected (${retryCount} retries, 0 parts). Aborting.`);
            opencode.cleanup();
            if (sid) {
              opencode.abortSession(sid).catch(() => {});
            }
            setIsRunning(false);
            setSessionStatus('idle');
            setEntries((prev) => {
              const last = prev[prev.length - 1];
              if (last?.type === 'assistant') {
                const errorPart: TextPart = {
                  id: `retry-error-${Date.now()}`,
                  sessionID: sid!,
                  messageID: last.messageId,
                  type: 'text',
                  text: '**Error:** The AI model failed to respond after multiple retries. The model API may be temporarily unavailable. Please try a different model or try again later.',
                };
                return [
                  ...prev.slice(0, -1),
                  { ...last, parts: [...last.parts, errorPart], isComplete: true },
                ];
              }
              return prev;
            });
          }
        } else if (status === 'busy') {
          // Reset retry count when busy (not retrying)
          // Don't reset — retry alternates busy→retry→busy→retry
        }
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
    const instructions = resolvedSkillInstructions || skill.config.systemPrompt;
    if (instructions) {
      systemParts.push('\n\n--- Skill instructions ---\n\n');
      systemParts.push(instructions);
    }
    const isFindSkills = skill.id === 'find-skills' || String(skill.id).endsWith('find-skills');
    if (isFindSkills) {
      systemParts.push('\n\n--- Candy Shop catalog (id - name). In this browser environment npx skills find cannot run; use the list below to suggest skills when the user asks e.g. "有没有写论文的 skill". ---\n');
      const catalogLines = SKILLS_DATA.filter((s) => s?.id != null && s?.name != null).map((s) => `${s.id} - ${s.name}`);
      systemParts.push(catalogLines.join('\n'));
      systemParts.push('\n\nWhen the user asks for skills (thesis, paper, writing, etc.), suggest matching skills from the list above by id and name, and mention they can run them here or browse the registry for more.');
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
  }, [input, attachedFiles, isRunning, connected, currentSessionId, createNewSession, selectedModel, skill.id, skill.name, skill.description, skill.artifactUrl, skill.skillMdUrl, skillInstructions, skill.config.systemPrompt, runtimeMode, sandboxRepo, entries, isLangGraph, isN8n, isDynamicWorker, dwDeployed, runtimeDescriptor.label]);

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

  // NOTE: No early returns for connecting/error states.
  // The full dialog (including input box) always renders.
  // Connection status is shown as an overlay inside the chat area.

  // Build GitHub URL from skill.repo if available
  const githubUrl = skill.repo
    ? `https://github.com/${skill.repo}`
    : skill.skillMdUrl
      ? (() => {
        const m = skill.skillMdUrl!.match(/github(?:usercontent)?\.com\/([^/]+\/[^/]+)/);
        return m ? `https://github.com/${m[1]}` : null;
      })()
      : null;

  // ── Runtime mode badge (dw / langgraph / n8n / pi / cf-cc / cf-ai / opencode) ─
  const modeBadge = isN8n
    ? { label: 'n8n Workflow', tone: 'text-mint bg-mint/10 border-mint/20' }
    : isLangGraph
    ? { label: 'LangGraph', tone: 'text-grape bg-grape/10 border-grape/20' }
    : isDynamicWorker
    ? { label: 'Dynamic Worker', tone: 'text-chocolate bg-chocolate/10 border-chocolate/20' }
    : runtimeMode === 'cf-cc'
      ? { label: 'Claude Code', tone: 'text-primary bg-primary/10 border-primary/20' }
      : runtimeMode === 'cf-ai'
        ? { label: 'Workers AI', tone: 'text-info bg-info/10 border-info/20' }
        : runtimeMode === 'pi'
          ? { label: 'Pi', tone: 'text-caramel bg-caramel/10 border-caramel/20' }
          : { label: 'OpenCode', tone: 'text-grape bg-grape/10 border-grape/20' };

  // ── Live status pill — reads the streaming state with a candy-kitchen
  //    flavor while staying legible (idle / warming / stirring / plating /
  //    running tool / error). Pure presentation; derived from existing state.
  const statusPill = (() => {
    if (connecting) return { label: 'warming up', dot: 'bg-caramel', text: 'text-caramel', spin: true };
    if (connectionError && !connected) return { label: 'disconnected', dot: 'bg-error', text: 'text-error', spin: false };
    if (isRunning) {
      const phase = (sandboxPhase || sessionStatus || '').toLowerCase();
      let label = 'cooking…';
      if (phase.includes('think') || sessionStatus === 'busy') label = 'stirring…';
      else if (phase === 'claude' || phase === 'opencode') label = 'plating…';
      else if (phase.includes('start') || phase.includes('restore') || phase.includes('setup')) label = 'prepping…';
      else if (phase.includes('tool')) label = 'running tool…';
      return { label, dot: 'bg-primary', text: 'text-primary', spin: true };
    }
    return { label: runtimeMode === 'cf-cc' ? 'warm · ready' : 'ready', dot: 'bg-mint', text: 'text-mint', spin: false };
  })();

  // Skill identity illustration — DESIGN.md hard rule #1: no emoji as UI.
  const SkillCandy = getCandyIcon(skill.category);
  // Model label/selection is rendered by <ModelPicker> (LangGraph keeps a static chip).

  // ── Entitlement gate dispatch ─────────────────────────────────────────────
  // Resolved BEFORE the coming-soon / chat paths so a paid-but-unentitled skill
  // never reaches a runtime. Two states: (1) checking access — a light shell
  // with a "checking access…" pill; (2) gated — a first-class Purchase Gate
  // panel in place of the transcript/run area. Free/entitled skills fall
  // through to the existing paths below, unchanged.
  const gateFlavor = getFlavor(skill.category, executorIsDark);

  // (1) Still resolving entitlement — hold the run UI; never auto-run.
  if (gate.loading) {
    return (
      <div className="h-screen w-full flex flex-col bg-background animate-fade-in overflow-hidden">
        <header className="relative shrink-0 bg-card border-b border-border z-20">
          <div className="absolute inset-x-0 top-0 h-[3px]" style={{ backgroundColor: gateFlavor.base }} />
          <div className="flex items-center gap-3 px-3 sm:px-5 h-16">
            <button
              onClick={onClose}
              className="group inline-flex items-center gap-1.5 pl-2 pr-3 h-9 rounded-xl bg-secondary/70 hover:bg-secondary text-foreground-secondary hover:text-foreground transition-colors duration-200 cursor-pointer focus:outline-none focus:ring-2 focus:ring-ring shrink-0 font-body"
              aria-label="Back to Candy Shop"
              title="Back to Candy Shop"
            >
              <ArrowLeft className="w-4 h-4 transition-transform duration-200 group-hover:-translate-x-0.5" />
              <span className="hidden sm:inline text-[13px] font-medium">Candy Shop</span>
            </button>
            <div className="h-7 w-px bg-border/70 mx-0.5 hidden sm:block" />
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="grid place-items-center w-9 h-9 rounded-xl bg-secondary ring-1 ring-border/60 shrink-0 overflow-hidden">
                <SkillCandy size={26} />
              </span>
              <div className="min-w-0">
                <h1 className="text-[15px] leading-tight font-semibold text-foreground font-candy truncate">{skill.name}</h1>
                <span className="inline-flex items-center gap-1.5 mt-0.5 pl-1.5 pr-2 h-[20px] rounded-full bg-foreground/[0.04] border border-border/60 text-[10px] font-mono font-medium text-foreground-tertiary">
                  <Loader2 className="w-2.5 h-2.5 animate-spin" />
                  checking access…
                </span>
              </div>
            </div>
          </div>
        </header>
        <div className="flex-1 grid place-items-center bg-background">
          <div className="flex flex-col items-center gap-3 text-foreground-tertiary">
            <Loader2 className="w-6 h-6 animate-spin" style={{ color: gateFlavor.base }} />
            <span className="text-sm font-body">Checking access…</span>
          </div>
        </div>
      </div>
    );
  }

  // (2) Gated — paid skill the user hasn't purchased. Purchase Gate panel.
  if (gate.hasAccess === false) {
    const priceLabel = gatePriceLabel ?? 'Premium';
    return (
      <div className="h-screen w-full flex flex-col bg-background animate-fade-in overflow-hidden">
        <header className="relative shrink-0 bg-card border-b border-border z-20">
          <div className="absolute inset-x-0 top-0 h-[3px]" style={{ backgroundColor: gateFlavor.base }} />
          <div className="flex items-center gap-3 px-3 sm:px-5 h-16">
            <button
              onClick={onClose}
              className="group inline-flex items-center gap-1.5 pl-2 pr-3 h-9 rounded-xl bg-secondary/70 hover:bg-secondary text-foreground-secondary hover:text-foreground transition-colors duration-200 cursor-pointer focus:outline-none focus:ring-2 focus:ring-ring shrink-0 font-body"
              aria-label="Back to Candy Shop"
              title="Back to Candy Shop"
            >
              <ArrowLeft className="w-4 h-4 transition-transform duration-200 group-hover:-translate-x-0.5" />
              <span className="hidden sm:inline text-[13px] font-medium">Candy Shop</span>
            </button>
            <div className="h-7 w-px bg-border/70 mx-0.5 hidden sm:block" />
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="grid place-items-center w-9 h-9 rounded-xl bg-secondary ring-1 ring-border/60 shrink-0 overflow-hidden">
                <SkillCandy size={26} />
              </span>
              <div className="min-w-0">
                <div className="flex items-center gap-2 min-w-0">
                  <h1 className="text-[15px] leading-tight font-semibold text-foreground font-candy truncate">{skill.name}</h1>
                  {/* 🔒 Premium badge while gated */}
                  <span
                    className="inline-flex items-center gap-1 px-2 h-[18px] rounded-full border text-[10px] font-bold font-mono uppercase tracking-wide shrink-0"
                    style={{ backgroundColor: gateFlavor.tint, color: gateFlavor.ink, borderColor: gateFlavor.base }}
                  >
                    <Lock className="w-2.5 h-2.5" />
                    Premium
                  </span>
                </div>
                <div className="mt-0.5 text-[11px] text-foreground-tertiary font-mono">purchase required to run</div>
              </div>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto bg-background">
          <div className="mx-auto w-full max-w-xl px-4 sm:px-6 py-10 sm:py-16">
            <div className="rounded-3xl border border-border bg-card shadow-candy-2 overflow-hidden">
              {/* Flavored hero band */}
              <div
                className="relative px-6 sm:px-8 pt-9 pb-7 flex flex-col items-center text-center"
                style={{ backgroundColor: gateFlavor.tint, color: gateFlavor.ink }}
              >
                <div className="relative">
                  <span
                    className="grid place-items-center w-20 h-20 rounded-3xl shadow-candy-1 overflow-hidden bg-card ring-1 ring-border/60"
                    aria-hidden="true"
                  >
                    <SkillCandy size={48} />
                  </span>
                  {/* lock chip overlapping the skill candy */}
                  <span
                    className="absolute -bottom-2 -right-2 grid place-items-center w-9 h-9 rounded-2xl text-white shadow-candy-1 ring-2 ring-card"
                    style={{ backgroundColor: gateFlavor.base }}
                  >
                    <Lock className="w-4 h-4" />
                  </span>
                </div>
                <h2 className="mt-5 font-candy font-bold text-2xl leading-tight">{skill.name}</h2>
                <div
                  className="mt-3 inline-flex items-center gap-1.5 px-3 h-8 rounded-full text-sm font-semibold font-body text-white shadow-candy-1"
                  style={{ backgroundColor: gateFlavor.base }}
                >
                  <ShoppingBag className="w-3.5 h-3.5" />
                  {priceLabel}
                </div>
              </div>

              {/* Copy + actions */}
              <div className="px-6 sm:px-8 py-7">
                <p className="text-center text-foreground font-body leading-relaxed">
                  This is a premium skill — purchase to run it.
                </p>
                <p className="mt-2 text-center text-sm text-foreground-tertiary font-body leading-relaxed">
                  {userId
                    ? 'Unlock execution to start a live session with this skill.'
                    : 'Sign in to purchase, then run it right here in the browser.'}
                </p>

                <div className="mt-7 flex flex-col gap-2.5">
                  {userId ? (
                    <button
                      onClick={() => onPurchase?.(entitlementSkillId)}
                      className="inline-flex items-center justify-center gap-2 w-full h-12 rounded-2xl text-sm font-semibold font-body text-white shadow-candy-1 transition-transform duration-150 ease-candy active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-card"
                      style={{ backgroundColor: gateFlavor.base }}
                    >
                      <ShoppingBag className="w-4 h-4" />
                      Buy to run
                    </button>
                  ) : (
                    <button
                      onClick={() => onRequireAuth?.()}
                      className="inline-flex items-center justify-center gap-2 w-full h-12 rounded-2xl text-sm font-semibold font-body text-white shadow-candy-1 transition-transform duration-150 ease-candy active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-card"
                      style={{ backgroundColor: gateFlavor.base }}
                    >
                      <LogIn className="w-4 h-4" />
                      Sign in to purchase
                    </button>
                  )}
                  <button
                    onClick={onClose}
                    className="inline-flex items-center justify-center gap-2 w-full h-11 rounded-2xl text-sm font-medium font-body bg-secondary border border-border text-foreground-secondary hover:text-foreground hover:border-border-hover transition-colors focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    Back
                  </button>
                </div>

                {skill.description && (
                  <p className="mt-6 text-xs text-foreground-tertiary leading-relaxed font-body border-t border-border/50 pt-5">
                    {skill.description}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── MCP dispatch ──────────────────────────────────────────────────────────
  // An MCP server exposes a SET OF TOOLS rather than running a single task, so
  // it gets its own dedicated view: warm + auto-connect (inspect → tools/list),
  // render the server info + tool list (name + description + input schema), then
  // pick a tool, supply JSON args, and call it live (callMcpTool). Resolved here
  // — AFTER the entitlement gate — so a paid MCP item is still gated first.
  if (isMcp) {
    return <McpServerView skill={skill} onClose={onClose} isDark={executorIsDark} />;
  }

  // ── Coming-soon dispatch ──────────────────────────────────────────────────
  // Non-claude formats (n8n / dify / langgraph / workflow) have no in-platform
  // runtime yet. Instead of the chat console + runtime picker, show a clean,
  // on-brand import panel: format identity + importHint + open-artifact / docs
  // + a "coming soon" note. The claude-skill chat path below is untouched.
  if (isComingSoon) {
    const accent = getFlavor(runtimeDescriptor.accentFlavor, executorIsDark);
    return (
      <div className="h-screen w-full flex flex-col bg-background animate-fade-in overflow-hidden">
        <header className="relative shrink-0 bg-card border-b border-border z-20">
          <div className="absolute inset-x-0 top-0 h-[3px]" style={{ backgroundColor: accent.base }} />
          <div className="flex items-center gap-3 px-3 sm:px-5 h-16">
            <button
              onClick={onClose}
              className="group inline-flex items-center gap-1.5 pl-2 pr-3 h-9 rounded-xl bg-secondary/70 hover:bg-secondary text-foreground-secondary hover:text-foreground transition-colors duration-200 cursor-pointer focus:outline-none focus:ring-2 focus:ring-ring shrink-0 font-body"
              aria-label="Back to Candy Shop"
              title="Back to Candy Shop"
            >
              <ArrowLeft className="w-4 h-4 transition-transform duration-200 group-hover:-translate-x-0.5" />
              <span className="hidden sm:inline text-[13px] font-medium">Candy Shop</span>
            </button>
            <div className="h-7 w-px bg-border/70 mx-0.5 hidden sm:block" />
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="grid place-items-center w-9 h-9 rounded-xl bg-secondary ring-1 ring-border/60 shrink-0 overflow-hidden">
                <SkillCandy size={26} />
              </span>
              <div className="min-w-0">
                <div className="flex items-center gap-2 min-w-0">
                  <h1 className="text-[15px] leading-tight font-semibold text-foreground font-candy truncate">{skill.name}</h1>
                  <span
                    className="hidden sm:inline-flex items-center px-2 h-[18px] rounded-full border text-[10px] font-bold font-mono uppercase tracking-wide shrink-0"
                    style={{ backgroundColor: accent.tint, color: accent.ink, borderColor: accent.base }}
                  >
                    {runtimeDescriptor.label}
                  </span>
                </div>
                <div className="mt-0.5 text-[11px] text-foreground-tertiary font-mono">import · execution coming soon</div>
              </div>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto bg-background">
          <div className="mx-auto w-full max-w-2xl px-4 sm:px-6 py-10 sm:py-14">
            {/* Format identity hero */}
            <div
              className="rounded-3xl p-6 sm:p-7 border flex items-start gap-4"
              style={{ backgroundColor: accent.tint, color: accent.ink, borderColor: accent.base }}
            >
              <span
                className="grid place-items-center w-14 h-14 rounded-2xl shrink-0 text-white shadow-candy-1"
                style={{ backgroundColor: accent.base }}
                aria-hidden="true"
              >
                <Workflow className="w-7 h-7" />
              </span>
              <div className="min-w-0">
                <div className="font-mono text-[11px] uppercase tracking-[0.18em] opacity-80">{runtimeDescriptor.label}</div>
                <h2 className="font-candy font-bold text-2xl leading-tight mt-1">{skill.name}</h2>
                {runtimeDescriptor.importHint && (
                  <p className="text-sm mt-2 leading-relaxed opacity-90 font-body">{runtimeDescriptor.importHint}</p>
                )}
              </div>
            </div>

            {/* Coming-soon note */}
            <div className="mt-5 rounded-2xl border border-border bg-card p-5 shadow-candy-1">
              <p className="text-foreground font-body leading-relaxed">
                In-platform execution for <strong>{runtimeDescriptor.label}</strong> is coming soon. For now,
                open the artifact and run it in your own environment{runtimeDescriptor.docsUrl ? ' (see the docs link below)' : ''}.
              </p>

              {/* Actions */}
              <div className="flex flex-wrap items-center gap-2.5 mt-5">
                {skill.artifactUrl && (
                  <a
                    href={skill.artifactUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-5 h-11 rounded-2xl text-sm font-body font-semibold text-white transition-transform duration-150 ease-candy active:scale-95"
                    style={{ backgroundColor: accent.base }}
                  >
                    <ExternalLink className="w-4 h-4" />
                    {itemFormat === 'n8n' ? 'Import to n8n' : itemFormat === 'dify' ? 'Import to Dify' : 'Open artifact'}
                  </a>
                )}
                {runtimeDescriptor.docsUrl && (
                  <a
                    href={runtimeDescriptor.docsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-5 h-11 rounded-2xl text-sm font-body font-medium bg-secondary border border-border text-foreground-secondary hover:text-foreground hover:border-border-hover transition-colors"
                  >
                    <BookOpen className="w-4 h-4" />
                    {runtimeDescriptor.label} docs
                  </a>
                )}
                {githubUrl && (
                  <a
                    href={githubUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-5 h-11 rounded-2xl text-sm font-body font-medium bg-secondary border border-border text-foreground-secondary hover:text-foreground hover:border-border-hover transition-colors"
                  >
                    <Github className="w-4 h-4" />
                    Source
                  </a>
                )}
              </div>
            </div>

            {skill.description && (
              <p className="mt-5 text-sm text-foreground-secondary leading-relaxed font-body">{skill.description}</p>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-full flex flex-col bg-background animate-fade-in overflow-hidden">
      {/* ── Top bar (full-width, solid, no backdrop-blur to avoid scroll
          flicker on a fixed bar) ────────────────────────────────────── */}
      <header className="relative shrink-0 bg-card border-b border-border z-20">
        {/* candy-wrapper hairline accent */}
        <div className="absolute inset-x-0 top-0 h-[3px] bg-primary" />
        <div className="flex items-center justify-between gap-3 px-3 sm:px-5 h-16">
          {/* Left cluster — back + sidebar toggle + skill identity */}
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <button
              onClick={onClose}
              className="group inline-flex items-center gap-1.5 pl-2 pr-3 h-9 rounded-xl bg-secondary/70 hover:bg-secondary text-foreground-secondary hover:text-foreground transition-colors duration-200 cursor-pointer focus:outline-none focus:ring-2 focus:ring-ring shrink-0 font-body"
              aria-label="Back to Candy Shop"
              title="Back to Candy Shop"
            >
              <ArrowLeft className="w-4 h-4 transition-transform duration-200 group-hover:-translate-x-0.5" />
              <span className="hidden sm:inline text-[13px] font-medium">Candy Shop</span>
            </button>

            <button
              onClick={() => setShowSessions((v) => !v)}
              className="grid place-items-center w-9 h-9 rounded-xl hover:bg-secondary text-foreground-tertiary hover:text-foreground transition-colors duration-200 cursor-pointer focus:outline-none focus:ring-2 focus:ring-ring shrink-0"
              title={showSessions ? 'Hide sessions' : 'Show sessions'}
              aria-label={showSessions ? 'Hide sessions panel' : 'Show sessions panel'}
              aria-pressed={showSessions}
            >
              {showSessions ? <PanelLeftClose className="w-4.5 h-4.5" /> : <PanelLeftOpen className="w-4.5 h-4.5" />}
            </button>

            <div className="h-7 w-px bg-border/70 mx-0.5 hidden sm:block" />

            {/* Skill identity — illustration chip + name + mode badge */}
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="grid place-items-center w-9 h-9 rounded-xl bg-secondary ring-1 ring-border/60 shrink-0 overflow-hidden">
                <SkillCandy size={26} />
              </span>
              <div className="min-w-0">
                <div className="flex items-center gap-2 min-w-0">
                  <h1 className="text-[15px] leading-tight font-semibold text-foreground font-candy truncate">{skill.name}</h1>
                  <span className={`hidden sm:inline-flex items-center px-2 h-[18px] rounded-full border text-[10px] font-medium font-mono uppercase tracking-wide shrink-0 ${modeBadge.tone}`}>
                    {modeBadge.label}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className={`inline-flex items-center gap-1.5 pl-1.5 pr-2 h-[20px] rounded-full bg-foreground/[0.04] border border-border/60 text-[10px] font-mono font-medium ${statusPill.text}`}>
                    {statusPill.spin ? (
                      <Loader2 className="w-2.5 h-2.5 animate-spin" />
                    ) : (
                      <span className={`w-1.5 h-1.5 rounded-full ${statusPill.dot} ${statusPill.label.endsWith('ready') ? 'animate-pulse' : ''}`} />
                    )}
                    {statusPill.label}
                  </span>
                  {serverVersion && (
                    <span className="hidden md:inline text-foreground-muted font-mono text-[10px]">v{serverVersion}</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Right cluster — source + model */}
          <div className="flex items-center gap-1.5 shrink-0">
            {githubUrl && (
              <a
                href={githubUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="hidden md:inline-flex items-center gap-1.5 px-3 h-9 rounded-xl bg-secondary/60 hover:bg-secondary text-foreground-secondary hover:text-foreground transition-colors duration-200 text-[12px] font-medium shrink-0 font-body"
                title="View source on GitHub"
              >
                <Github className="w-3.5 h-3.5" />
                <span className="hidden lg:inline">Source</span>
                <ExternalLink className="w-2.5 h-2.5 opacity-50" />
              </a>
            )}
            {isFixedRuntime ? (
              <div className="hidden sm:flex items-center gap-1.5 px-3 h-9 text-[12px] border border-border/60 rounded-xl text-foreground-secondary font-mono">
                <Settings className="w-3.5 h-3.5" />
                <span>{isN8n ? 'n8n CLI' : isDynamicWorker ? 'Worker Loader' : 'Llama 3.3 70B'}</span>
              </div>
            ) : (
              <ModelPicker
                runtimeMode={runtimeMode}
                selected={selectedModel}
                onSelect={setSelectedModel}
              />
            )}
          </div>
        </div>
      </header>

      {/* ── Body ───────────────────────────────────────────────────── */}
      <div className="flex-1 flex overflow-hidden min-h-0">
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
          <div className="flex-1 flex flex-col min-w-0 min-h-0">
            {/* Todos bar */}
            <TodosView todos={todos} />

            {/* Run console strip — slim, on-system; shows while the agent works */}
            {isRunning && (
              <div className="shrink-0 px-4 sm:px-5 py-2.5 bg-primary/[0.05] border-b border-primary/12">
                <div className="flex items-center gap-3">
                  <Loader2 className="w-4 h-4 text-primary animate-spin shrink-0" />
                  <span className="text-[13px] text-primary font-medium font-body">
                    {sessionStatus === 'busy' ? 'Agent is working' : sessionStatus || 'Processing'}
                  </span>
                  {/* indeterminate candy progress track */}
                  <div className="flex-1 h-1 bg-primary/10 rounded-full overflow-hidden">
                    <div className="h-full w-1/3 bg-primary/60 rounded-full animate-shimmer" style={{ backgroundImage: 'linear-gradient(90deg, transparent, var(--color-primary), transparent)', backgroundSize: '200% 100%' }} />
                  </div>
                  <button
                    onClick={handleAbort}
                    className="inline-flex items-center gap-1.5 px-3 h-7 text-xs font-medium rounded-lg bg-error/10 hover:bg-error/20 text-error border border-error/15 transition-all duration-200 cursor-pointer focus:outline-none focus:ring-2 focus:ring-error/30 btn-press"
                    aria-label="Stop agent"
                  >
                    <Square className="w-3 h-3 fill-current" />
                    Stop
                  </button>
                </div>
              </div>
            )}

            {/* Messages — full-width scroll region; the transcript itself is a
                centered, readable column (ChatGPT / Claude.ai pattern). */}
            <div className="flex-1 overflow-y-auto min-h-0 relative bg-background">
              {/* Connection overlay — shown inside chat area, input stays visible */}
              {connecting && (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/85 backdrop-blur-sm">
                  <div className="text-center">
                    <div className="grid place-items-center w-14 h-14 rounded-2xl bg-primary/10 mx-auto mb-4">
                      <Loader2 className="w-7 h-7 text-primary animate-spin" />
                    </div>
                    <h3 className="text-[15px] font-semibold text-foreground font-candy">Warming up the kitchen</h3>
                    <p className="text-xs text-foreground-tertiary mt-1.5 font-body">Connecting to the agent runtime…</p>
                  </div>
                </div>
              )}
              {connectionError && !connected && !connecting && (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/85 backdrop-blur-sm px-4">
                  <div className="text-center max-w-sm w-full p-6 rounded-2xl bg-card border border-error/20 shadow-candy-2">
                    <div className="grid place-items-center w-14 h-14 rounded-2xl bg-error/10 mx-auto mb-4">
                      <AlertCircle className="w-7 h-7 text-error" />
                    </div>
                    <h3 className="text-[15px] font-semibold text-foreground font-candy">Connection failed</h3>
                    <p className="text-xs text-foreground-secondary mt-1.5 font-body break-words">{connectionError}</p>
                    <div className="flex gap-2 justify-center mt-5">
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
                        className="candy-btn px-5 h-9 text-xs font-semibold rounded-xl cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/50 btn-press font-body"
                      >
                        Retry
                      </button>
                      <button
                        onClick={onClose}
                        className="px-5 h-9 bg-card text-foreground-secondary text-xs font-medium rounded-xl hover:text-foreground hover:border-border-hover transition-all cursor-pointer focus:outline-none border border-border btn-press font-body"
                      >
                        Close
                      </button>
                    </div>
                  </div>
                </div>
              )}
              {/* Centered, readable transcript column */}
              <div className="mx-auto w-full max-w-3xl px-4 sm:px-6 py-6 space-y-5">
              {/* Skill intro: self-intro + view instructions + edit */}
              {showSkillBanner && skillLoadStatus !== 'idle' && (
                <div className="rounded-2xl border border-border/70 bg-card/70 text-sm overflow-hidden shadow-candy-1">
                  <div className="flex items-start gap-3 px-4 py-3">
                    <span className={`grid place-items-center w-8 h-8 rounded-xl shrink-0 ${
                      skillLoadStatus === 'loaded' ? 'bg-mint/10' : skillLoadStatus === 'loading' ? 'bg-primary/10' : 'bg-warning/10'
                    }`}>
                      {skillLoadStatus === 'loading' ? (
                        <Loader2 className="w-4 h-4 text-primary animate-spin" />
                      ) : skillLoadStatus === 'loaded' ? (
                        <CheckCircle2 className="w-4 h-4 text-mint" />
                      ) : (
                        <AlertCircle className="w-4 h-4 text-warning" />
                      )}
                    </span>
                    <div className="flex-1 min-w-0">
                      <span className="font-semibold text-foreground font-body">
                        {skillLoadStatus === 'loading'
                          ? `Loading ${skill.name}…`
                          : skillLoadStatus === 'loaded'
                            ? `Running ${skill.name}`
                            : `Could not load ${skill.name} SKILL.md`}
                      </span>
                      {skillLoadStatus === 'loaded' && (
                        <p className="text-xs text-foreground-secondary mt-1 leading-relaxed font-body">{skill.description}</p>
                      )}
                      {skillLoadStatus === 'loaded' && (skillInstructions || skill.skillMdUrl) && (
                        <div className="flex flex-wrap items-center gap-2 mt-2.5">
                          {skillInstructions && (
                            <button
                              type="button"
                              onClick={() => setShowViewInstructions(v => !v)}
                              className="inline-flex items-center gap-1.5 px-2.5 h-7 text-[11px] font-medium rounded-lg bg-secondary/70 text-foreground-secondary hover:text-foreground hover:bg-secondary transition-colors cursor-pointer"
                            >
                              <FileText className="w-3.5 h-3.5" />
                              {showViewInstructions ? 'Hide instructions' : 'View instructions'}
                            </button>
                          )}
                          <button
                            onClick={handleOpenEditModal}
                            className="inline-flex items-center gap-1.5 px-2.5 h-7 text-[11px] font-medium rounded-lg bg-secondary/70 text-foreground-secondary hover:text-foreground hover:bg-secondary transition-colors cursor-pointer"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                            Edit &amp; save
                          </button>
                        </div>
                      )}
                    </div>
                    {skillLoadStatus !== 'loading' && (
                      <button
                        onClick={() => setShowSkillBanner(false)}
                        className="grid place-items-center w-8 h-8 rounded-lg hover:bg-secondary/70 shrink-0 cursor-pointer transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-border/20 text-foreground-tertiary hover:text-foreground"
                        aria-label="Dismiss skill intro"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  {showViewInstructions && (skillInstructions || skill.skillMdUrl) && (
                    <div className="border-t border-border/30 overflow-hidden flex flex-col">
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
                              <div className="px-4 py-3 bg-background-secondary/40 border-b border-border/30">
                                <div className="text-[10px] font-semibold text-foreground-tertiary uppercase tracking-[0.12em] mb-2 font-mono">File structure</div>
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
                                          <FileText className="w-3.5 h-3.5 shrink-0 text-caramel" />
                                        ) : depth === 0 ? (
                                          <FolderOpen className="w-3.5 h-3.5 shrink-0 text-foreground-tertiary" />
                                        ) : (
                                          <Folder className="w-3.5 h-3.5 shrink-0 text-foreground-tertiary" />
                                        )}
                                        <span className={isFile ? 'text-caramel font-medium' : 'text-foreground-secondary'}>{name}</span>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                            {skillInstructions && (
                              <div className="flex-1 min-h-0 max-h-64 overflow-y-auto">
                                <div className="text-[10px] font-semibold text-foreground-tertiary uppercase tracking-[0.12em] px-4 pt-3 pb-1 font-mono">Content</div>
                                <pre className="p-4 pt-0 text-xs whitespace-pre-wrap font-mono text-foreground-secondary leading-relaxed">
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
                <div className="flex items-center gap-2.5 px-3.5 py-2.5 bg-error/[0.06] border border-error/25 rounded-xl text-sm text-error font-body">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  {connectionError}
                </div>
              )}

              {!greetingEntry && entries.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full text-center px-4">
                  <div className="grid place-items-center w-20 h-20 rounded-3xl bg-primary/[0.06] ring-1 ring-primary/15 mb-6 shadow-candy-1">
                    <div className="grid place-items-center w-14 h-14 rounded-2xl bg-primary candy-gloss shadow-candy-1">
                      <Sparkles className="w-7 h-7 text-primary-foreground" />
                    </div>
                  </div>
                  <h3 className="text-2xl font-semibold text-foreground mb-2 font-candy">
                    Ready to run {skill.name}
                  </h3>
                  <p className="text-sm text-foreground-secondary max-w-md mb-6 leading-relaxed font-body">
                    {skillLoadStatus === 'loaded'
                      ? 'Skill instructions are loaded. Describe a task below and the agent will get cooking.'
                      : skillLoadStatus === 'loading'
                        ? 'Loading skill instructions…'
                        : 'Describe a task below to start the agent. It runs with full tool access on the server.'}
                  </p>
                  <div className="flex items-center gap-2.5">
                    {skillLoadStatus === 'loaded' && (
                      <div className="inline-flex items-center gap-1.5 px-3.5 h-9 rounded-full bg-mint/10 border border-mint/20 text-mint text-xs font-medium font-body">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Skill loaded
                      </div>
                    )}
                    {githubUrl && (
                      <a
                        href={githubUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3.5 h-9 rounded-full bg-card border border-border text-foreground-secondary hover:text-foreground hover:border-border-hover text-xs font-medium transition-all duration-200 hover:shadow-candy-1"
                      >
                        <Github className="w-3.5 h-3.5" />
                        View source
                        <ExternalLink className="w-3 h-3 opacity-50" />
                      </a>
                    )}
                  </div>
                  <button
                    onClick={() => inputRef.current?.focus()}
                    className="candy-btn mt-6 px-6 h-11 rounded-2xl cursor-pointer text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary/50 btn-press font-body"
                    aria-label="Start a conversation"
                  >
                    Start a conversation
                  </button>
                </div>
              )}

              {greetingEntry && (
                <AssistantMessageView key={greetingEntry.messageId} entry={greetingEntry} />
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
            </div>

            {/* ── Question panel — centered to the transcript column ──── */}
            {activeQuestion && activeQuestion.questions.length > 0 && (
              <div className="mx-auto w-full max-w-3xl px-0 sm:px-2">
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
              </div>
            )}

            {/* ── Composer — docked at the bottom of the transcript column ── */}
            <div className="px-3 sm:px-5 py-3.5 border-t border-border bg-card shrink-0">
              <div className="max-w-3xl mx-auto">
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

                {/* Composer shell — one elevated rounded surface (Claude/ChatGPT) */}
                <div className="rounded-2xl border border-input-border bg-input shadow-candy-1 transition-colors duration-200 focus-within:border-primary/40 focus-within:ring-2 focus-within:ring-primary/20">
                  {/* File attachments preview (chips inside the shell) */}
                  {attachedFiles.length > 0 && (
                    <div className="flex flex-wrap gap-2 px-3 pt-3">
                      {attachedFiles.map((file) => {
                        const FileIcon = getFileIcon(file.mimeType);
                        return (
                          <div
                            key={file.id}
                            className="group relative flex items-center gap-2 pl-1.5 pr-2 py-1.5 bg-secondary/70 border border-border/60 rounded-xl"
                          >
                            {isImageFile(file.mimeType) ? (
                              <img
                                src={file.dataUrl}
                                alt={file.fileName}
                                className="w-7 h-7 object-cover rounded-lg"
                              />
                            ) : (
                              <span className="grid place-items-center w-7 h-7 rounded-lg bg-background-secondary">
                                <FileIcon className="w-3.5 h-3.5 text-foreground-tertiary" />
                              </span>
                            )}
                            <span className="text-xs text-foreground-secondary max-w-[150px] truncate font-body">
                              {file.fileName}
                            </span>
                            <button
                              onClick={() => removeFile(file.id)}
                              className="grid place-items-center w-5 h-5 rounded-md hover:bg-error/10 text-foreground-tertiary hover:text-error transition-colors cursor-pointer"
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
                    placeholder={
                      activeQuestion
                        ? "Type your answer here…"
                        : skillLoadStatus === 'loading'
                          ? "Loading skill instructions… one moment"
                          : "What should the agent do?"
                    }
                    rows={2}
                    disabled={isRunning || skillLoadStatus === 'loading'}
                    className="w-full px-4 pt-3.5 pb-1 bg-transparent border-0
                      text-sm text-foreground placeholder-foreground-tertiary font-body leading-relaxed
                      focus:outline-none focus:ring-0
                      resize-none disabled:opacity-50 disabled:cursor-not-allowed"
                    aria-label="Message input"
                  />

                  {/* Control row inside the shell */}
                  <div className="flex items-center gap-2 px-2.5 pb-2.5 pt-1">
                    {/* File attachment button */}
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isRunning}
                      className="grid place-items-center w-9 h-9 bg-transparent text-foreground-tertiary rounded-xl hover:bg-secondary hover:text-foreground-secondary
                        disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200 cursor-pointer focus:outline-none focus:ring-2 focus:ring-border/30"
                      title="Attach files"
                      aria-label="Attach files"
                    >
                      <Paperclip className="w-4 h-4" />
                    </button>

                    <span className="ml-auto text-[11px] text-foreground-muted font-mono hidden sm:inline pr-1">
                      Enter to send
                    </span>

                    {isRunning ? (
                      <button
                        onClick={handleAbort}
                        className="grid place-items-center w-9 h-9 bg-error/15 text-error rounded-xl hover:bg-error/25 border border-error/15 transition-all duration-200 cursor-pointer focus:outline-none focus:ring-2 focus:ring-error/50 btn-press"
                        title="Stop agent"
                        aria-label="Stop agent"
                      >
                        <Square className="w-4 h-4 fill-current" />
                      </button>
                    ) : (
                      <button
                        onClick={handleSend}
                        disabled={(!input.trim() && attachedFiles.length === 0) || skillLoadStatus === 'loading'}
                        className="candy-btn grid place-items-center w-9 h-9 rounded-xl
                          disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/50 btn-press"
                        title="Send (Enter)"
                        aria-label="Send message"
                      >
                        <ArrowUp className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex flex-col gap-2.5 mt-2.5 px-0.5 max-w-3xl mx-auto">
                {/* Optional repo input — empty uses the sandbox's scratch dir.
                    Hidden for fixed-runtime formats (LangGraph / n8n): the
                    artifact comes from the item. */}
                {!isFixedRuntime && (runtimeMode === 'opencode' || runtimeMode === 'cf-cc') && (
                  <div className="flex items-center gap-2 text-[11px]">
                    <span className="text-foreground-tertiary shrink-0 font-mono uppercase tracking-wide text-[10px]">
                      Repo
                    </span>
                    <input
                      type="text"
                      value={sandboxRepo}
                      onChange={(e) => setSandboxRepo(e.target.value)}
                      placeholder="leave empty for fastest run (uses scratch dir)"
                      className="flex-1 px-2.5 h-7 rounded-lg border border-input-border bg-input text-foreground placeholder-foreground-muted font-mono text-[11px] focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-colors"
                    />
                  </div>
                )}

                <div className="flex justify-between items-center gap-3 flex-wrap">
                  {/* Runtime picker — Claude Code (persistent warm session)
                      is the primary path and listed first. Hidden for the
                      fixed-runtime formats (LangGraph / n8n), each of which has
                      a single dedicated sandbox worker. */}
                  {!isFixedRuntime ? (
                  <div className="flex items-center gap-0.5 text-[11px] rounded-xl border border-border bg-background-secondary p-1">
                    {([
                      { id: 'cf-cc', label: 'Claude Code', Icon: Zap,
                        title: 'Persistent warm Claude Code session over WebSocket — no per-turn cold start, instant after the first turn. Recommended.' },
                      { id: 'cf-ai', label: 'Workers AI', Icon: Sparkles,
                        title: 'Workers AI Llama 3.1 8B — single-shot chat, no tools' },
                      { id: 'opencode', label: 'OpenCode', Icon: Terminal,
                        title: 'Legacy local OpenCode SDK path (fallback)' },
                      { id: 'pi', label: 'Pi', Icon: Terminal,
                        title: 'Pi coding agent (pi-sandbox), headless `pi -p --mode json` — runs keyless on a Workers-AI shim and streams real Pi output' },
                    ] as const).map(opt => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setRuntimeMode(opt.id)}
                        title={opt.title}
                        className={`inline-flex items-center gap-1.5 px-2.5 h-7 rounded-lg font-medium transition-colors ${
                          runtimeMode === opt.id
                            ? 'bg-primary text-primary-foreground shadow-candy-1'
                            : 'text-foreground-secondary hover:text-foreground hover:bg-secondary/70'
                        }`}
                      >
                        <opt.Icon className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">{opt.label}</span>
                      </button>
                    ))}
                  </div>
                  ) : (
                    <span className={`inline-flex items-center gap-1.5 px-2.5 h-7 text-[11px] font-mono ${isN8n ? 'text-mint' : isDynamicWorker ? 'text-chocolate' : 'text-grape'}`}>
                      <Workflow className="w-3.5 h-3.5" />
                      {isN8n ? 'n8n runtime' : isDynamicWorker ? 'Dynamic Worker runtime' : 'LangGraph runtime'}
                    </span>
                  )}

                  <div className="flex items-center gap-3 flex-wrap">
                    {/* Budget chip — per mode */}
                    {runtimeMode === 'opencode' && ocBudget && (
                      <span className="text-[11px] text-foreground-tertiary font-mono">
                        {budgetChipLabel(ocBudget, 'runs')}
                      </span>
                    )}
                    {runtimeMode === 'cf-ai' && cfBudget && (
                      <span className="text-[11px] text-foreground-tertiary font-mono">
                        {budgetChipLabel(cfBudget, 'chats')}
                      </span>
                    )}
                    {runtimeMode === 'cf-cc' && ccBudget && (
                      <span className="text-[11px] text-foreground-tertiary font-mono">
                        {budgetChipLabel(ccBudget, 'runs')}
                      </span>
                    )}

                    {isRunning && (
                      <span className="text-[11px] text-primary flex items-center gap-1.5 font-mono">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        {runtimeMode === 'cf-ai'
                          ? 'thinking…'
                          : sandboxPhase === 'opencode' || sandboxPhase === 'claude'
                            ? `waiting for model… (${sandboxElapsed}s)`
                            : `${sandboxPhase || 'starting'}… (${sandboxElapsed}s)`}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

      {/* Edit & Save as My Skill Modal */}
      {showEditModal && (
        <div className="fixed inset-0 bg-foreground/40 flex items-center justify-center z-[120] p-4 backdrop-blur-sm animate-fade-in">
          <div className="bg-card rounded-3xl max-w-lg w-full shadow-candy-3 max-h-[85vh] overflow-y-auto border border-border animate-zoom-in">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border/60 sticky top-0 bg-card z-10">
              <h2 className="text-lg font-semibold text-card-foreground font-candy">Edit &amp; save as my skill</h2>
              <button
                onClick={() => setShowEditModal(false)}
                className="grid place-items-center w-9 h-9 rounded-full bg-secondary/70 hover:bg-secondary text-foreground-secondary hover:text-foreground transition-colors focus:outline-none focus:ring-2 focus:ring-ring"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 p-6">
              {/* Skill Name */}
              <div>
                <label className="block text-[11px] font-semibold text-foreground-tertiary uppercase tracking-[0.1em] mb-2 font-mono">Skill name</label>
                <input
                  type="text"
                  value={editingSkill.name || ''}
                  onChange={(e) => setEditingSkill({ ...editingSkill, name: e.target.value })}
                  className="w-full px-3.5 h-11 border border-input-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40 bg-input text-foreground font-body transition-colors"
                  placeholder="e.g., Data Analysis Expert"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-[11px] font-semibold text-foreground-tertiary uppercase tracking-[0.1em] mb-2 font-mono">Description</label>
                <textarea
                  value={editingSkill.description || ''}
                  onChange={(e) => setEditingSkill({ ...editingSkill, description: e.target.value })}
                  rows={3}
                  className="w-full px-3.5 py-2.5 border border-input-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40 resize-none bg-input text-foreground font-body transition-colors"
                  placeholder="Describe what this skill can do…"
                />
              </div>

              {/* Category */}
              <div>
                <label className="block text-[11px] font-semibold text-foreground-tertiary uppercase tracking-[0.1em] mb-2 font-mono">Category</label>
                <select
                  value={editingSkill.category || 'Custom'}
                  onChange={(e) => setEditingSkill({ ...editingSkill, category: e.target.value as any })}
                  className="w-full px-3.5 h-11 border border-input-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40 bg-input text-foreground font-body transition-colors"
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
                <label className="block text-[11px] font-semibold text-foreground-tertiary uppercase tracking-[0.1em] mb-2 font-mono">System prompt</label>
                <textarea
                  value={editingSkill.config?.systemPrompt || ''}
                  onChange={(e) => setEditingSkill({
                    ...editingSkill,
                    config: { ...editingSkill.config!, systemPrompt: e.target.value }
                  })}
                  rows={6}
                  className="w-full px-3.5 py-2.5 border border-input-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40 resize-none font-mono text-[13px] leading-relaxed bg-input text-foreground transition-colors"
                  placeholder="Enter the system prompt for this skill…"
                />
              </div>

              {/* Status Messages */}
              {saveStatus === 'success' && (
                <div className="flex items-center gap-2 p-3 bg-mint/[0.08] border border-mint/25 rounded-xl">
                  <CheckCircle2 className="w-4 h-4 text-mint shrink-0" />
                  <p className="text-sm text-foreground font-body">Skill saved successfully.</p>
                </div>
              )}
              {saveStatus === 'error' && (
                <div className="flex items-center gap-2 p-3 bg-error/[0.06] border border-error/25 rounded-xl">
                  <AlertCircle className="w-4 h-4 text-error shrink-0" />
                  <p className="text-sm text-foreground font-body">Failed to save skill. Please try again.</p>
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-border/60">
                <button
                  onClick={() => setShowEditModal(false)}
                  disabled={saveStatus === 'saving'}
                  className="px-5 h-10 text-sm font-medium text-foreground-secondary bg-card border border-border rounded-2xl hover:bg-secondary hover:border-border-hover transition-colors disabled:opacity-50 btn-press font-body"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveAsMySkill}
                  disabled={saveStatus === 'saving' || !editingSkill.name?.trim()}
                  className="candy-btn px-5 h-10 text-sm font-semibold rounded-2xl disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2 btn-press font-body"
                >
                  {saveStatus === 'saving' ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Saving…
                    </>
                  ) : saveStatus === 'success' ? (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      Saved
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      Save as my skill
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
