// Automated Debug Loop System
// Automatically deploys, monitors remote, fixes errors, and iterates until clean

export type DebugLoopState =
  | 'idle'           // Not started
  | 'running'        // Active general state
  | 'deploying'       // Pushing to remote
  | 'monitoring'      // Watching remote for errors
  | 'analyzing'       // AI analyzing errors
  | 'fixing'          // Generating/applying fixes
  | 'redeploying'      // Pushing fixes
  | 'completed'        // No errors found
  | 'failed'           // Max iterations reached
  | 'paused';         // User paused

export type ErrorSeverity = 'critical' | 'high' | 'medium' | 'low';
export type ErrorCategory = 'runtime' | 'build' | 'test' | 'deployment' | 'network' | 'unknown';

export interface RemoteError {
  id: string;
  timestamp: Date;
  severity: ErrorSeverity;
  category: ErrorCategory;
  message: string;
  stack?: string;
  source: {
    file: string;
    line: number;
    column?: number;
  };
  context?: {
    userId?: string;
    sessionId?: string;
    route?: string;
    userAgent?: string;
    additionalData?: Record<string, unknown>;
  };
  occurrenceCount: number;
  firstSeenAt: Date;
  lastSeenAt: Date;
  resolved: boolean;
}

export interface DeploymentConfig {
  // Git configuration
  gitRemote?: string;
  gitBranch?: string;

  // Deployment target
  target: 'github-pages' | 'vercel' | 'netlify' | 'custom';
  customUrl?: string;

  // Build commands
  buildCommand?: string;
  buildDirectory?: string;

  // Environment
  environment?: 'production' | 'staging' | 'development';

  // Authentication
  authToken?: string;
  deployKey?: string;
}

export interface MonitoringConfig {
  // Error sources
  sources: ErrorSource[];

  // Polling interval (ms)
  pollInterval?: number;

  // Real-time monitoring
  enableRealtime?: boolean;
  websocketUrl?: string;

  // Error filtering
  ignorePatterns?: string[];
  severityThreshold?: ErrorSeverity;

  // Session tracking
  trackSessions?: boolean;
  sessionSampleRate?: number;
}

export type ErrorSource =
  | 'sentry'         // Sentry.io
  | 'logrocket'       // LogRocket
  | 'browser-console'  // Browser console errors
  | 'server-logs'      // Server log scraping
  | 'api-endpoint'    // Custom API endpoint
  | 'github-actions';  // GitHub Actions workflow logs

export interface DebugLoopConfig {
  id: string;
  name: string;
  description?: string;

  // Deployment configuration
  deployment: DeploymentConfig;

  // Monitoring configuration
  monitoring: MonitoringConfig;

  // AI fix configuration
  aiFix: {
    enabled: boolean;
    provider: 'openai' | 'anthropic' | 'local';
    model?: string;
    maxTokens?: number;
    temperature?: number;

    // Fix strategy
    autoApply?: boolean;        // Auto-apply fixes
    requireApproval?: boolean;  // Require user approval
    maxIterations?: number;      // Max fix attempts
  };

  // Safety limits
  safety: {
    maxIterations: number;
    maxDuration: number;        // Max minutes
    rollbackOnFailure: boolean;
    createBackupBranch: boolean;
  };

  // Notifications
  notifications: {
    enabled: boolean;
    onIteration?: boolean;
    onError?: boolean;
    onComplete?: boolean;
    webhookUrl?: string;
  };

  // Schedule
  schedule?: {
    enabled: boolean;
    cron?: string;
    timezone?: string;
  };

  // State
  state: DebugLoopState;
  currentIteration: number;
  startedAt?: Date;
  completedAt?: Date;
  lastErrorCount?: number;
}

export interface FixSuggestion {
  id: string;
  errorId: string;

  // The fix
  type: 'code-change' | 'config-change' | 'dependency-update' | 'environment' | 'rollback';
  priority: 'critical' | 'high' | 'medium' | 'low';

  // Code changes
  file?: string;
  originalCode?: string;
  fixedCode?: string;
  lineStart?: number;
  lineEnd?: number;

  // Config changes
  configPath?: string;
  originalConfig?: Record<string, unknown>;
  fixedConfig?: Record<string, unknown>;

  // Dependencies
  dependencyName?: string;
  currentVersion?: string;
  suggestedVersion?: string;

  // Metadata
  explanation: string;
  confidence: number; // 0-1
  reasoning: string;
  estimatedImpact: 'low' | 'medium' | 'high';

  // Application status
  status: 'pending' | 'approved' | 'applied' | 'rejected' | 'failed';
  appliedAt?: Date;
}

export interface DebugLoopIteration {
  id: string;
  loopId: string;
  iterationNumber: number;

  // Timeline
  startedAt: Date;
  completedAt?: Date;
  duration?: number;

  // Deployment
  deploymentCommit?: string;
  deploymentUrl?: string;
  deploymentStatus: 'pending' | 'success' | 'failed';

  // Monitoring results
  errorCount: number;
  errors: RemoteError[];

  // Fixes generated
  fixesGenerated: FixSuggestion[];
  fixesApplied: FixSuggestion[];
  fixesRejected: FixSuggestion[];

  // Outcome
  outcome: 'running' | 'completed' | 'failed' | 'timeout';

  // Logs
  logs: IterationLog[];
}

export interface IterationLog {
  id: string;
  timestamp: Date;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  details?: Record<string, unknown>;
}

export interface DebugLoopStats {
  totalIterations: number;
  totalErrorsFixed: number;
  totalErrorsRemaining: number;
  averageIterationDuration: number;
  totalDuration: number;
  successRate: number;

  byCategory: Record<ErrorCategory, number>;
  bySeverity: Record<ErrorSeverity, number>;

  mostCommonErrors: Array<{
    message: string;
    count: number;
    file: string;
  }>;
}
