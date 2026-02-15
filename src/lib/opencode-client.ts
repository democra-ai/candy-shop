import { createOpencodeClient } from '@opencode-ai/sdk/client';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const OPENCODE_SERVER_URL =
  import.meta.env.VITE_OPENCODE_URL ||
  import.meta.env.VITE_API_BASE_URL ||
  'https://tao-shen-opencode.hf.space';

// User provided credentials: username 'opencode', password '6' for demo purposes
const OPENCODE_USERNAME = (import.meta.env.VITE_OPENCODE_USERNAME as string | undefined) || 'opencode';
const OPENCODE_PASSWORD = (import.meta.env.VITE_OPENCODE_PASSWORD as string | undefined) || '6';

function getBasicAuthHeader(): string | undefined {
  // Do NOT hardcode credentials in the repo. Pass via env vars.
  if (!OPENCODE_USERNAME || !OPENCODE_PASSWORD) return undefined;
  try {
    return `Basic ${btoa(`${OPENCODE_USERNAME}:${OPENCODE_PASSWORD}`)}`;
  } catch {
    return undefined;
  }
}

// ---------------------------------------------------------------------------
// Types – mirrors the OpenCode SDK part types
// ---------------------------------------------------------------------------

export interface TextPart {
  id: string;
  sessionID: string;
  messageID: string;
  type: 'text';
  text: string;
}

export interface ToolPart {
  id: string;
  sessionID: string;
  messageID: string;
  type: 'tool';
  tool: string;
  callID: string;
  state: 'pending' | 'running' | 'completed' | 'error';
  metadata?: Record<string, unknown>;
}

export interface ReasoningPart {
  id: string;
  sessionID: string;
  messageID: string;
  type: 'reasoning';
  text: string;
}

export interface StepStartPart {
  id: string;
  sessionID: string;
  messageID: string;
  type: 'step-start';
  snapshot?: string;
}

export interface StepFinishPart {
  id: string;
  sessionID: string;
  messageID: string;
  type: 'step-finish';
  reason: string;
  cost: number;
  tokens: {
    input: number;
    output: number;
    reasoning: number;
    cache: { read: number; write: number };
  };
}

export interface FilePart {
  id: string;
  sessionID: string;
  messageID: string;
  type: 'file';
  mime: string;
  filename?: string;
  url: string;
}

export interface SnapshotPart {
  id: string;
  sessionID: string;
  messageID: string;
  type: 'snapshot';
  snapshot: string;
}

export interface PatchPart {
  id: string;
  sessionID: string;
  messageID: string;
  type: 'patch';
  hash: string;
  files: string[];
}

export type Part =
  | TextPart
  | ToolPart
  | ReasoningPart
  | StepStartPart
  | StepFinishPart
  | FilePart
  | SnapshotPart
  | PatchPart;

export interface ModelConfig {
  providerID: string;
  modelID: string;
}

export interface ProviderModel {
  providerID: string;
  modelID: string;
  name: string;
  providerName: string;
  reasoning: boolean;
  toolcall: boolean;
}

export interface SessionInfo {
  id: string;
  title: string;
  time: { created: number; updated: number };
}

export interface TodoItem {
  id: string;
  content: string;
  status: string;
  priority: string;
}

export interface FileAttachment {
  id: string;
  mimeType: string;
  fileName: string;
  dataUrl: string;
}

// ---------------------------------------------------------------------------
// Stream callbacks
// ---------------------------------------------------------------------------

/** A single question within a question.asked request */
export interface QuestionInfo {
  question: string;
  header: string;
  options: { label: string; description?: string }[];
  multiple?: boolean;
  custom?: boolean;
}

/** The full question.asked event payload from OpenCode */
export interface QuestionEvent {
  id: string;
  sessionID: string;
  questions: QuestionInfo[];
  tool?: Record<string, unknown>;
}

export interface StreamCallbacks {
  onPartUpdated: (part: Part, delta?: string) => void;
  onMessageUpdated: (message: Record<string, unknown>) => void;
  onSessionStatus: (status: string) => void;
  onComplete: () => void;
  onError: (error: string) => void;
  onPermission?: (permission: Record<string, unknown>) => void;
  onTodos?: (todos: TodoItem[]) => void;
  onQuestion?: (question: QuestionEvent) => void;
}

// ---------------------------------------------------------------------------
// OpenCode Client
// ---------------------------------------------------------------------------

class OpenCodeClient {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private client: any = null;
  private abortController: AbortController | null = null;
  private baseUrl: string;

  /**
   * Signal callback: when set, calling signalQuestionAnswered() resets
   * hasReceivedQuestion in the active sendMessage SSE stream so the
   * stream can complete normally after the server continues processing.
   */
  private _onQuestionAnsweredCb: (() => void) | null = null;

  constructor(baseUrl: string = OPENCODE_SERVER_URL) {
    this.baseUrl = baseUrl;
  }

  /**
   * Call this after replyQuestion() succeeds.  It tells the active SSE
   * stream (from sendMessage) to reset its hasReceivedQuestion flag so
   * that subsequent idle / finish events can trigger onComplete.
   */
  signalQuestionAnswered(): void {
    if (this._onQuestionAnsweredCb) {
      console.log('[OpenCode] signalQuestionAnswered() → resetting hasReceivedQuestion');
      this._onQuestionAnsweredCb();
    } else {
      console.warn('[OpenCode] signalQuestionAnswered() called but no active stream');
    }
  }

  get connected(): boolean {
    return this.client !== null;
  }

  // ── Connect ─────────────────────────────────────────────────────────────

  async connect(baseUrl?: string): Promise<{ version: string }> {
    const url = baseUrl || this.baseUrl;

    // Create the SDK client
    const auth = getBasicAuthHeader();
    this.client = createOpencodeClient({
      baseUrl: url,
      headers: auth ? { Authorization: auth } : undefined,
    });

    // Verify connectivity with a health check (SDK v1 has no global.health())
    try {
      const resp = await fetch(`${url}/global/health`, {
        headers: auth ? { Authorization: auth } : undefined,
      });
      if (!resp.ok) throw new Error(`Server returned ${resp.status}`);
      const data = await resp.json();
      const version = data?.version ?? 'unknown';
      console.log('[OpenCode] Connected to', url, '– version', version);
      return { version };
    } catch (err: unknown) {
      this.client = null;
      throw new Error(
        `Cannot reach OpenCode server at ${url}: ${(err as Error).message}`
      );
    }
  }

  // ── Sessions ────────────────────────────────────────────────────────────

  async createSession(title: string): Promise<SessionInfo> {
    this.ensureClient();
    const result = await this.client.session.create({ body: { title } });
    const session = result?.data ?? result;
    if (!session?.id) {
      throw new Error('Failed to create session: no ID returned');
    }
    return {
      id: session.id,
      title: session.title ?? title,
      time: session.time ?? { created: Date.now(), updated: Date.now() },
    };
  }

  async listSessions(): Promise<SessionInfo[]> {
    this.ensureClient();
    const result = await this.client.session.list();
    const list = result?.data ?? result ?? [];
    return (Array.isArray(list) ? list : []).map(
      (s: Record<string, unknown>) => ({
        id: s.id as string,
        title: (s.title as string) ?? '',
        time: (s.time as { created: number; updated: number }) ?? {
          created: 0,
          updated: 0,
        },
      })
    );
  }

  async deleteSession(id: string): Promise<void> {
    this.ensureClient();
    await this.client.session.delete({ path: { id } });
  }

  async abortSession(id: string): Promise<void> {
    this.ensureClient();
    await this.client.session.abort({ path: { id } });
  }

  /**
   * Reply to a question.asked event with selected answers.
   * Each element of `answers` is an array of selected option labels for
   * the corresponding question in the request.
   */
  async replyQuestion(requestID: string, answers: string[][]): Promise<boolean> {
    const auth = getBasicAuthHeader();
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (auth) headers['Authorization'] = auth;

    const resp = await fetch(`${this.baseUrl}/question/${requestID}/reply`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ answers }),
    });
    if (!resp.ok) {
      throw new Error(`Failed to reply to question ${requestID}: ${resp.status}`);
    }
    return true;
  }

  /** Reject / dismiss a question.asked request. */
  async rejectQuestion(requestID: string): Promise<boolean> {
    const auth = getBasicAuthHeader();
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (auth) headers['Authorization'] = auth;

    const resp = await fetch(`${this.baseUrl}/question/${requestID}/reject`, {
      method: 'POST',
      headers,
    });
    if (!resp.ok) {
      throw new Error(`Failed to reject question ${requestID}: ${resp.status}`);
    }
    return true;
  }

  /**
   * List all pending questions from the server.
   * This is the PRIMARY method for getting pending questions – much more
   * reliable than relying on SSE events alone.
   */
  async listPendingQuestions(sessionID?: string): Promise<QuestionEvent[]> {
    const auth = getBasicAuthHeader();
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (auth) headers['Authorization'] = auth;

    try {
      const resp = await fetch(`${this.baseUrl}/question`, { headers });
      if (!resp.ok) {
        console.warn(`[OpenCode] listPendingQuestions: HTTP ${resp.status}`);
        return [];
      }
      const data = await resp.json();
      const rawList: Array<Record<string, unknown>> = Array.isArray(data) ? data : [];

      console.log(`[OpenCode] listPendingQuestions: got ${rawList.length} pending questions`);
      rawList.forEach((q, i) => {
        console.log(`[OpenCode]   question[${i}]: id=${q.id}, sessionID=${q.sessionID}, questions=${JSON.stringify(q.questions)?.slice(0, 200)}`);
      });

      // Map to QuestionEvent and optionally filter by session
      const mapped: QuestionEvent[] = rawList.map((q) => ({
        id: (q.id as string) ?? `q-${Date.now()}`,
        sessionID: (q.sessionID as string) ?? '',
        questions: (q.questions as QuestionInfo[]) ?? [],
        tool: (q.tool as Record<string, unknown>) ?? undefined,
      }));

      if (sessionID) {
        return mapped.filter((q) => q.sessionID === sessionID);
      }
      return mapped;
    } catch (err) {
      console.warn('[OpenCode] listPendingQuestions error:', err);
      return [];
    }
  }

  /**
   * Fetch full session details (including messages) from the server.
   * Returns the raw session object from `/session/{id}`.
   */
  async getSession(id: string): Promise<Record<string, unknown>> {
    this.ensureClient();
    const result = await this.client.session.get({ path: { id } });
    return (result?.data ?? result) as Record<string, unknown>;
  }

  /**
   * Fetch message list for a session.
   * Primary path: `/session/{id}/message`, fallback: `/session/{id}`.
   * Normalized return is always an array of raw message objects.
   */
  async getSessionMessages(id: string): Promise<Record<string, unknown>[]> {
    this.ensureClient();

    // Preferred API for history
    try {
      const result = await this.client.session.messages({ path: { id } });
      const data = (result?.data ?? result) as unknown;
      const directList: unknown[] | null = Array.isArray(data) ? data : null;
      const nestedList: unknown[] | null =
        !directList && data && typeof data === 'object'
          ? ((() => {
              const candidate =
                (data as { messages?: unknown; items?: unknown; data?: unknown }).messages ??
                (data as { messages?: unknown; items?: unknown; data?: unknown }).items ??
                (data as { messages?: unknown; items?: unknown; data?: unknown }).data;
              return Array.isArray(candidate) ? candidate : null;
            })())
          : null;

      const normalized: unknown[] = directList ?? nestedList ?? [];

      if (normalized.length > 0) {
        return normalized as Record<string, unknown>[];
      }
      console.warn(`[OpenCode] getSessionMessages(${id}) returned empty list from /session/{id}/message`);
    } catch (err) {
      console.warn(`[OpenCode] getSessionMessages(${id}) failed on /session/{id}/message:`, err);
    }

    // Backward-compatible fallback
    const session = await this.getSession(id);
    const fallbackMessages = session.messages;
    return Array.isArray(fallbackMessages)
      ? (fallbackMessages as Record<string, unknown>[])
      : [];
  }

  // ── Providers / Models ──────────────────────────────────────────────────

  async getModels(): Promise<{
    models: ProviderModel[];
    defaultModel: ModelConfig | null;
  }> {
    this.ensureClient();
    const result = await this.client.config.providers();
    const data = result?.data ?? result;

    const providers: Array<{
      id: string;
      name: string;
      models: Record<
        string,
        { id?: string; name?: string; capabilities?: Record<string, unknown> }
      >;
    }> = data?.providers ?? [];

    const defaultCfg = data?.default as Record<string, string> | undefined;

    const models: ProviderModel[] = [];
    for (const provider of providers) {
      if (!provider.models) continue;
      for (const [modelKey, model] of Object.entries(provider.models)) {
        models.push({
          providerID: provider.id,
          modelID: model.id ?? modelKey,
          name: model.name ?? modelKey,
          providerName: provider.name ?? provider.id,
          reasoning: !!(model.capabilities as Record<string, unknown>)
            ?.reasoning,
          toolcall: !!(model.capabilities as Record<string, unknown>)?.toolcall,
        });
      }
    }

    const defaultModel: ModelConfig | null =
      defaultCfg?.providerID && defaultCfg?.modelID
        ? { providerID: defaultCfg.providerID, modelID: defaultCfg.modelID }
        : models.length > 0
          ? { providerID: models[0].providerID, modelID: models[0].modelID }
          : null;

    return { models, defaultModel };
  }

  // ── Manual SSE reader (bypasses SDK for streaming reliability) ──────────

  private async *readSSE(
    url: string,
    signal: AbortSignal
  ): AsyncGenerator<{ event?: string; data: unknown }, void, unknown> {
    const auth = getBasicAuthHeader();
    const headers: Record<string, string> = {
      Accept: 'text/event-stream',
      'Cache-Control': 'no-cache',
    };
    if (auth) headers['Authorization'] = auth;

    console.log(`[OpenCode][SSE] Connecting to ${url} ...`);
    const t0 = performance.now();

    const response = await fetch(url, { headers, signal });
    console.log(
      `[OpenCode][SSE] Connected – status ${response.status} (${(performance.now() - t0).toFixed(0)}ms)`
    );

    if (!response.ok) {
      throw new Error(`SSE connection failed: ${response.status} ${response.statusText}`);
    }
    if (!response.body) {
      throw new Error('SSE response has no body');
    }

    const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
    let buffer = '';
    let chunkIndex = 0;

    // Helper: yield control to the browser so React can render between events.
    // Without this, a large chunk (e.g. 14 KB / 80 events) would be processed
    // synchronously, React would batch all setState calls, and the UI would
    // only update AFTER the entire chunk is consumed.
    const yieldToUI = () => new Promise<void>((r) => setTimeout(r, 0));

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          console.log('[OpenCode][SSE] Stream ended (done=true)');
          break;
        }

        chunkIndex++;
        const now = performance.now();
        console.log(
          `[OpenCode][SSE] chunk #${chunkIndex} received at +${(now - t0).toFixed(0)}ms, length=${value.length}`
        );

        buffer += value;
        // SSE events are separated by double newline
        const parts = buffer.split('\n\n');
        buffer = parts.pop() ?? '';

        let eventsSinceYield = 0;

        for (const raw of parts) {
          if (!raw.trim()) continue;

          const lines = raw.split('\n');
          let eventName: string | undefined;
          const dataLines: string[] = [];

          for (const line of lines) {
            if (line.startsWith('event:')) {
              eventName = line.slice(6).trim();
            } else if (line.startsWith('data:')) {
              dataLines.push(line.slice(5).trimStart());
            }
            // ignore id:, retry:, comments
          }

          if (dataLines.length === 0) continue;

          let data: unknown;
          const rawData = dataLines.join('\n');
          try {
            data = JSON.parse(rawData);
          } catch {
            data = rawData;
          }

          console.log(
            `[OpenCode][SSE] EVENT at +${(performance.now() - t0).toFixed(0)}ms – event=${eventName ?? '(none)'}, ` +
            `type=${(data as Record<string, unknown>)?.type ?? '?'}`
          );

          yield { event: eventName, data };
          eventsSinceYield++;

          // Every 8 events, yield to the browser so React can flush pending
          // state updates and repaint.  Time-based thresholds don't work here
          // because 40+ events can be processed in < 5ms — too fast for the
          // 16ms frame budget to ever trigger.  Count-based yields ensure the
          // UI updates progressively even within a single large chunk.
          if (eventsSinceYield >= 8) {
            await yieldToUI();
            eventsSinceYield = 0;
          }
        }
      }
    } finally {
      try { reader.cancel(); } catch { /* noop */ }
    }
  }

  // ── Send message with streaming ─────────────────────────────────────────

  async sendMessage(
    sessionId: string,
    text: string,
    callbacks: StreamCallbacks,
    options?: {
      model?: ModelConfig;
      system?: string;
      files?: FileAttachment[];
    }
  ): Promise<void> {
    this.ensureClient();

    // Clean up any prior stream
    this.cleanup();
    this.abortController = new AbortController();
    const ac = this.abortController;

    const t0 = performance.now();
    const ts = () => `+${(performance.now() - t0).toFixed(0)}ms`;

    let isCompleted = false;
    let hasReceivedParts = false;
    let hasReceivedQuestion = false;

    // Allow external code (SkillExecutor.onAnswer) to reset hasReceivedQuestion
    // after replying to a question, so the stream can complete normally.
    this._onQuestionAnsweredCb = () => {
      console.log(`[OpenCode] ${ts()} ★ hasReceivedQuestion reset (question answered)`);
      hasReceivedQuestion = false;
    };

    // Track which message IDs are user vs assistant so we can filter echoes
    const userMessageIds = new Set<string>();

    // 1. Open manual SSE stream BEFORE sending the prompt.
    //    Try /event first (was working before), fall back to /global/event.
    const sseUrl = `${this.baseUrl}/event`;
    console.log(`[OpenCode] sendMessage() start, session=${sessionId}`);

    const processEvents = async () => {
      try {
        for await (const raw of this.readSSE(sseUrl, ac.signal)) {
          if (ac.signal.aborted) break;

          const event = raw.data as Record<string, unknown> | undefined;
          if (!event || typeof event !== 'object') {
            console.log(`[OpenCode] ${ts()} skip non-object event`);
            continue;
          }

          // Determine event type: could be in SSE event: line, or in data.type
          const eventType: string | undefined =
            (event.type as string | undefined) ?? raw.event;

          if (!eventType) {
            console.log(`[OpenCode] ${ts()} skip event without type, keys:`, Object.keys(event));
            continue;
          }

          const props: Record<string, unknown> =
            (event.properties as Record<string, unknown>) ?? {};

          // Filter: only process events for our session
          const evtSid =
            (props.sessionID as string) ??
            ((props.info as Record<string, unknown>)?.sessionID as string) ??
            ((props.part as Record<string, unknown>)?.sessionID as string);

          if (evtSid && evtSid !== sessionId) continue;

          console.log(`[OpenCode] ${ts()} process: ${eventType}${evtSid ? ' (our session)' : ''}`);

          switch (eventType) {
            // ── Message lifecycle ───────────────────────────────────────
            case 'message.updated': {
              const info = (props.info ?? props) as Record<string, unknown>;
              const msgId = info.id as string | undefined;
              const role = info.role as string | undefined;

              if (msgId && role === 'user') {
                userMessageIds.add(msgId);
              }

              if (role === 'assistant') {
                console.log(`[OpenCode] ${ts()} → onMessageUpdated (finish=${info.finish})`);
                callbacks.onMessageUpdated(info);
              }

              if (role === 'assistant' && info.finish === 'stop') {
                if (hasReceivedQuestion) {
                  console.log(`[OpenCode] ${ts()} assistant finished (stop) but question pending – skipping onComplete`);
                } else {
                  console.log(`[OpenCode] ${ts()} ✓ assistant finished (stop)`);
                  isCompleted = true;
                  ac.abort();
                  callbacks.onComplete();
                  return;
                }
              }
              break;
            }

            // ── Part updates ────────────────────────────────────────────
            case 'message.part.updated': {
              const part = props.part as Part | undefined;
              if (!part) break;

              if (userMessageIds.has(part.messageID)) break;

              hasReceivedParts = true;
              const delta = props.delta as string | undefined;
              const textPreview =
                part.type === 'text'
                  ? (part as TextPart).text?.slice(0, 60)
                  : part.type;
              console.log(
                `[OpenCode] ${ts()} → onPartUpdated: type=${part.type}, id=${part.id}, ` +
                `delta=${delta ? delta.length + ' chars' : 'none'}, preview="${textPreview}"`
              );
              callbacks.onPartUpdated(part, delta);
              break;
            }

            // ── Session status ──────────────────────────────────────────
            case 'session.status': {
              const statusObj = props.status as
                | Record<string, unknown>
                | string
                | undefined;
              const status =
                typeof statusObj === 'string'
                  ? statusObj
                  : ((statusObj?.type as string) ?? '');
              console.log(`[OpenCode] ${ts()} session.status → "${status}" (hasReceivedParts=${hasReceivedParts}, hasReceivedQuestion=${hasReceivedQuestion})`);
              callbacks.onSessionStatus(status);

              // Don't auto-complete if the AI asked a question (the session
              // goes idle while waiting for the user's answer)
              if (status === 'idle' && hasReceivedParts && !hasReceivedQuestion) {
                // Delay completion slightly so a question.asked event in the
                // same or next chunk can still be processed
                console.log(`[OpenCode] ${ts()} session idle – scheduling completion check in 600ms`);
                setTimeout(async () => {
                  if (ac.signal.aborted || isCompleted || hasReceivedQuestion) return;
                  // Double-check: poll the /question endpoint for any pending questions
                  try {
                    const pending = await this.listPendingQuestions(sessionId);
                    if (pending.length > 0) {
                      console.log(`[OpenCode] ${ts()} Found ${pending.length} pending questions on idle – NOT completing`);
                      callbacks.onQuestion?.(pending[0]);
                      hasReceivedQuestion = true;
                      return;
                    }
                  } catch { /* ignore */ }
                  console.log(`[OpenCode] ${ts()} ✓ session idle confirmed → onComplete`);
                  isCompleted = true;
                  ac.abort();
                  callbacks.onComplete();
                }, 600);
              }
              break;
            }

            case 'session.idle': {
              console.log(`[OpenCode] ${ts()} session.idle (hasReceivedParts=${hasReceivedParts}, hasReceivedQuestion=${hasReceivedQuestion})`);
              callbacks.onSessionStatus('idle');
              if (hasReceivedParts && !hasReceivedQuestion) {
                // Same delayed check as session.status idle
                setTimeout(async () => {
                  if (ac.signal.aborted || isCompleted || hasReceivedQuestion) return;
                  try {
                    const pending = await this.listPendingQuestions(sessionId);
                    if (pending.length > 0) {
                      console.log(`[OpenCode] ${ts()} Found ${pending.length} pending questions on session.idle – NOT completing`);
                      callbacks.onQuestion?.(pending[0]);
                      hasReceivedQuestion = true;
                      return;
                    }
                  } catch { /* ignore */ }
                  console.log(`[OpenCode] ${ts()} ✓ session.idle confirmed → onComplete`);
                  isCompleted = true;
                  ac.abort();
                  callbacks.onComplete();
                }, 600);
              }
              break;
            }

            case 'permission.updated': {
              console.log(`[OpenCode] ${ts()} permission.updated`);
              callbacks.onPermission?.(props);
              break;
            }

            case 'todo.updated': {
              callbacks.onTodos?.(props.todos as TodoItem[]);
              break;
            }

            case 'question.asked': {
              console.log(`[OpenCode] ${ts()} ★ question.asked – full event:`, JSON.stringify(event).slice(0, 500));
              console.log(`[OpenCode] ${ts()} ★ question.asked – props keys:`, Object.keys(props));
              console.log(`[OpenCode] ${ts()} ★ question.asked – props.id=${props.id}, props.sessionID=${props.sessionID}`);
              console.log(`[OpenCode] ${ts()} ★ question.asked – props.questions:`, JSON.stringify(props.questions)?.slice(0, 500));

              const questionId = (props.id as string) ?? (event.id as string) ?? `q-${Date.now()}`;
              const rawQuestions = (props.questions as QuestionInfo[]) ?? [];
              const question: QuestionEvent = {
                id: questionId,
                sessionID: evtSid ?? sessionId,
                questions: rawQuestions,
                tool: (props.tool as Record<string, unknown>) ?? undefined,
              };

              hasReceivedQuestion = true;

              console.log(`[OpenCode] ${ts()} ★ → onQuestion (${rawQuestions.length} questions):`, JSON.stringify(question).slice(0, 500));
              callbacks.onQuestion?.(question);
              break;
            }

            case 'session.error': {
              const errInfo = props.error as Record<string, unknown> | undefined;
              const errMsg = (errInfo?.message as string) ?? 'Unknown session error';
              console.error(`[OpenCode] ${ts()} session.error: ${errMsg}`);
              callbacks.onError(errMsg);
              isCompleted = true;
              ac.abort();
              return;
            }

            default:
              console.log(`[OpenCode] ${ts()} unhandled event: ${eventType}`);
          }
        }

        // Stream ended naturally
        if (!isCompleted) {
          if (hasReceivedParts) {
            console.log(`[OpenCode] ${ts()} stream ended → onComplete`);
            callbacks.onComplete();
          } else {
            console.warn(`[OpenCode] ${ts()} stream ended without any parts`);
            callbacks.onError('Event stream ended without receiving any response');
          }
        }
      } catch (err: unknown) {
        const e = err as Error;
        if (e.name === 'AbortError' || ac.signal.aborted) {
          console.log(`[OpenCode] ${ts()} SSE aborted (expected)`);
          return;
        }
        console.error(`[OpenCode] ${ts()} Event processing error:`, e);
        callbacks.onError(e.message ?? 'Unknown stream error');
      }
    };

    // Start processing events in the background
    const eventPromise = processEvents();

    // Small delay to ensure the SSE connection is established
    await new Promise((r) => setTimeout(r, 300));

    // 2. Send the prompt via session.promptAsync() — returns immediately,
    //    the response streams back through the SSE events above.
    console.log(`[OpenCode] ${ts()} sending promptAsync...`);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const body: Record<string, any> = {
        parts: [{ type: 'text', text }],
      };

      // Add file attachments if provided
      if (options?.files && options.files.length > 0) {
        const fileParts = options.files.map((file) => ({
          id: file.id,
          type: 'file' as const,
          mime: file.mimeType,
          filename: file.fileName,
          url: file.dataUrl,
        }));
        body.parts = [...body.parts, ...fileParts];
      }

      if (options?.model) {
        body.model = {
          providerID: options.model.providerID,
          modelID: options.model.modelID,
        };
      }
      if (options?.system) {
        body.system = options.system;
      }

      await this.client.session.promptAsync({
        path: { id: sessionId },
        body,
      });
      console.log(`[OpenCode] ${ts()} promptAsync returned`);
    } catch (err: unknown) {
      const e = err as Error;
      if (e.name !== 'AbortError' && !ac.signal.aborted) {
        console.error(`[OpenCode] ${ts()} Prompt send error:`, e);
        callbacks.onError(`Failed to send message: ${e.message}`);
      }
    }

    // 3. Safety timeout (5 minutes)
    const timeoutId = setTimeout(() => {
      if (!ac.signal.aborted && !isCompleted) {
        console.warn(`[OpenCode] ${ts()} TIMEOUT after 5 minutes`);
        ac.abort();
        if (hasReceivedParts) {
          callbacks.onComplete();
        } else {
          callbacks.onError('Timeout: no response received after 5 minutes');
        }
      }
    }, 300_000);

    // Wait for event processing to finish, then clear timeout
    eventPromise.finally(() => clearTimeout(timeoutId));
  }

  // ── Resume listening after replying to a question ──────────────────────

  /**
   * Opens SSE stream FIRST, then replies to the question.
   * This ensures we capture all events from the server's continued processing.
   * (Mirrors the sendMessage pattern: connect SSE → wait → send action)
   */
  async resumeAfterQuestion(
    sessionId: string,
    requestID: string,
    answers: string[][],
    callbacks: StreamCallbacks,
    action: 'reply' | 'reject' = 'reply'
  ): Promise<void> {
    this.ensureClient();

    // Clean up any prior stream
    this.cleanup();
    this.abortController = new AbortController();
    const ac = this.abortController;

    const t0 = performance.now();
    const ts = () => `+${(performance.now() - t0).toFixed(0)}ms`;

    let isCompleted = false;
    let hasReceivedParts = false;
    let hasReceivedQuestion = false;

    const userMessageIds = new Set<string>();
    const sseUrl = `${this.baseUrl}/event`;

    console.log(`[OpenCode] resumeAfterQuestion() start, session=${sessionId}, requestID=${requestID}`);

    const processEvents = async () => {
      try {
        for await (const raw of this.readSSE(sseUrl, ac.signal)) {
          if (ac.signal.aborted) break;

          const event = raw.data as Record<string, unknown> | undefined;
          if (!event || typeof event !== 'object') continue;

          const eventType: string | undefined =
            (event.type as string | undefined) ?? raw.event;
          if (!eventType) continue;

          const props: Record<string, unknown> =
            (event.properties as Record<string, unknown>) ?? {};

          const evtSid =
            (props.sessionID as string) ??
            ((props.info as Record<string, unknown>)?.sessionID as string) ??
            ((props.part as Record<string, unknown>)?.sessionID as string);

          if (evtSid && evtSid !== sessionId) continue;

          console.log(`[OpenCode] ${ts()} resume: ${eventType}`);

          switch (eventType) {
            case 'message.updated': {
              const info = (props.info ?? props) as Record<string, unknown>;
              const role = info.role as string | undefined;
              const msgId = info.id as string | undefined;
              if (msgId && role === 'user') userMessageIds.add(msgId);
              if (role === 'assistant') callbacks.onMessageUpdated(info);
              if (role === 'assistant' && info.finish === 'stop' && !hasReceivedQuestion) {
                console.log(`[OpenCode] ${ts()} resume: assistant finished`);
                isCompleted = true;
                ac.abort();
                callbacks.onComplete();
                return;
              }
              break;
            }
            case 'message.part.updated': {
              const part = props.part as Part | undefined;
              if (!part) break;
              if (userMessageIds.has(part.messageID)) break;
              hasReceivedParts = true;
              const delta = props.delta as string | undefined;
              callbacks.onPartUpdated(part, delta);
              break;
            }
            case 'session.status': {
              const statusObj = props.status as Record<string, unknown> | string | undefined;
              const status = typeof statusObj === 'string' ? statusObj : ((statusObj?.type as string) ?? '');
              console.log(`[OpenCode] ${ts()} resume session.status: "${status}"`);
              callbacks.onSessionStatus(status);
              if (status === 'idle' && hasReceivedParts && !hasReceivedQuestion) {
                setTimeout(async () => {
                  if (ac.signal.aborted || isCompleted || hasReceivedQuestion) return;
                  try {
                    const pending = await this.listPendingQuestions(sessionId);
                    if (pending.length > 0) {
                      callbacks.onQuestion?.(pending[0]);
                      hasReceivedQuestion = true;
                      return;
                    }
                  } catch { /* ignore */ }
                  console.log(`[OpenCode] ${ts()} resume: idle confirmed → onComplete`);
                  isCompleted = true;
                  ac.abort();
                  callbacks.onComplete();
                }, 600);
              }
              break;
            }
            case 'session.idle': {
              callbacks.onSessionStatus('idle');
              if (hasReceivedParts && !hasReceivedQuestion) {
                setTimeout(async () => {
                  if (ac.signal.aborted || isCompleted || hasReceivedQuestion) return;
                  try {
                    const pending = await this.listPendingQuestions(sessionId);
                    if (pending.length > 0) {
                      callbacks.onQuestion?.(pending[0]);
                      hasReceivedQuestion = true;
                      return;
                    }
                  } catch { /* ignore */ }
                  isCompleted = true;
                  ac.abort();
                  callbacks.onComplete();
                }, 600);
              }
              break;
            }
            case 'question.asked': {
              console.log(`[OpenCode] ${ts()} resume: question.asked`);
              const questionId = (props.id as string) ?? `q-${Date.now()}`;
              const rawQuestions = (props.questions as QuestionInfo[]) ?? [];
              const question: QuestionEvent = {
                id: questionId,
                sessionID: evtSid ?? sessionId,
                questions: rawQuestions,
                tool: (props.tool as Record<string, unknown>) ?? undefined,
              };
              hasReceivedQuestion = true;
              callbacks.onQuestion?.(question);
              break;
            }
            case 'todo.updated': {
              callbacks.onTodos?.(props.todos as TodoItem[]);
              break;
            }
            case 'session.error': {
              const errMsg = ((props.error as Record<string, unknown>)?.message as string) ?? 'Session error';
              callbacks.onError(errMsg);
              isCompleted = true;
              ac.abort();
              return;
            }
            default:
              break;
          }
        }
        if (!isCompleted && hasReceivedParts) {
          callbacks.onComplete();
        }
      } catch (err: unknown) {
        const e = err as Error;
        if (e.name === 'AbortError' || ac.signal.aborted) return;
        callbacks.onError(e.message ?? 'Unknown stream error');
      }
    };

    // Start processing events in the background
    const eventPromise = processEvents();

    // Wait for SSE connection to be established (same pattern as sendMessage)
    await new Promise((r) => setTimeout(r, 400));

    // NOW perform the question action — the SSE stream is ready to catch events
    console.log(`[OpenCode] ${ts()} sending question ${action} after SSE established...`);
    try {
      if (action === 'reject') {
        await this.rejectQuestion(requestID);
      } else {
        await this.replyQuestion(requestID, answers);
      }
      console.log(`[OpenCode] ${ts()} question ${action} sent successfully`);
    } catch (err: unknown) {
      const e = err as Error;
      console.error(`[OpenCode] ${ts()} question ${action} error:`, e);
      callbacks.onError(`Failed to ${action} question: ${e.message}`);
    }

    // Safety timeout (5 minutes)
    const timeoutId = setTimeout(() => {
      if (!ac.signal.aborted && !isCompleted) {
        ac.abort();
        if (hasReceivedParts) callbacks.onComplete();
        else callbacks.onError('Timeout waiting for response after question reply');
      }
    }, 300_000);

    eventPromise.finally(() => clearTimeout(timeoutId));
  }

  // ── Cleanup ─────────────────────────────────────────────────────────────

  cleanup(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }

  // ── Internal ────────────────────────────────────────────────────────────

  private ensureClient(): void {
    if (!this.client) {
      throw new Error(
        'OpenCode client is not connected. Call connect() first.'
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Skill SKILL.md fetcher
// ---------------------------------------------------------------------------

export interface ParsedSkillMd {
  name: string;
  description: string;
  instructions: string;
}

/**
 * Convert raw GitHub URL to jsDelivr CDN URL so browser fetch works (CORS).
 * raw: https://raw.githubusercontent.com/owner/repo/branch/path
 * →    https://cdn.jsdelivr.net/gh/owner/repo@branch/path
 */
function toJsDelivrIfRawGitHub(url: string): string {
  const m = url.match(
    /^https:\/\/raw\.githubusercontent\.com\/([^/]+)\/([^/]+)\/([^/]+)\/(.+)$/
  );
  if (!m) return url;
  const [, owner, repo, branch, path] = m;
  return `https://cdn.jsdelivr.net/gh/${owner}/${repo}@${branch}/${path}`;
}

export async function fetchSkillMd(url: string): Promise<ParsedSkillMd> {
  const fetchUrl = toJsDelivrIfRawGitHub(url);
  const resp = await fetch(fetchUrl);
  if (!resp.ok) throw new Error(`Failed to fetch SKILL.md: ${resp.status}`);
  const raw = await resp.text();

  // Parse YAML front-matter (--- ... ---)
  let name = '';
  let description = '';
  let body = raw;

  const fmMatch = raw.match(/^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/);
  if (fmMatch) {
    const fm = fmMatch[1];
    body = fmMatch[2].trim();
    const nameMatch = fm.match(/^name:\s*(.+)$/m);
    const descMatch = fm.match(/^description:\s*(.+)$/m);
    if (nameMatch) name = nameMatch[1].trim().replace(/^["']|["']$/g, '');
    if (descMatch) description = descMatch[1].trim().replace(/^["']|["']$/g, '');
  }

  return { name, description, instructions: body };
}

// ---------------------------------------------------------------------------
// Singleton export
// ---------------------------------------------------------------------------

export const opencode = new OpenCodeClient();
