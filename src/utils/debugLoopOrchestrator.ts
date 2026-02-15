// Debug Loop Orchestrator
// Coordinates deployment, monitoring, and fixing in an automated loop

import type {
  DebugLoopConfig,
  DebugLoopState,
  DebugLoopIteration,
  DebugLoopStats,
  FixSuggestion,
  RemoteError,
  IterationLog,
} from '../types/auto-debug';
import { AutoDeployer } from './autoDeployer';
import { RemoteMonitor, type MonitoringResult } from './remoteMonitor';
import { AIFixGenerator, type FixGenerationResult } from './aiFixGenerator';

export interface OrchestratorOptions {
  config: DebugLoopConfig;
  onIterationUpdate?: (iteration: DebugLoopIteration) => void;
  onStateChange?: (state: DebugLoopState) => void;
  onLog?: (log: IterationLog) => void;
  onComplete?: (result: DebugLoopResult) => void;
}

export interface DebugLoopResult {
  success: boolean;
  iterations: number;
  errorsFixed: number;
  errorsRemaining: number;
  totalDuration: number;
  finalDeploymentUrl?: string;
  reason?: string;
}

export class DebugLoopOrchestrator {
  private config: DebugLoopConfig;
  private deployer: AutoDeployer;
  private monitor: RemoteMonitor;
  private fixGenerator: AIFixGenerator;

  private currentIteration: number;
  private iterations: DebugLoopIteration[];
  private isRunning: boolean;
  private isPaused: boolean;
  private startTime: Date;

  private onIterationUpdate?: (iteration: DebugLoopIteration) => void;
  private onStateChange?: (state: DebugLoopState) => void;
  private onLog?: (log: IterationLog) => void;


  constructor(options: OrchestratorOptions) {
    this.config = options.config;
    this.deployer = new AutoDeployer(this.config.deployment);
    this.monitor = new RemoteMonitor(this.config.monitoring);
    this.fixGenerator = new AIFixGenerator({
      apiKey: this.config.aiFix.provider === 'openai'
        ? this.config.deployment.authToken
        : undefined,
      provider: this.config.aiFix.provider,
      model: this.config.aiFix.model,
    });

    this.currentIteration = 0;
    this.iterations = [];
    this.isRunning = false;
    this.isPaused = false;
    this.startTime = new Date();

    this.onIterationUpdate = options.onIterationUpdate;
    this.onStateChange = options.onStateChange;
    this.onLog = options.onLog;

  }

  /**
   * Start the debug loop
   */
  async start(): Promise<DebugLoopResult> {
    if (this.isRunning) {
      return {
        success: false,
        iterations: this.currentIteration,
        errorsFixed: 0,
        errorsRemaining: 0,
        totalDuration: 0,
        reason: 'Debug loop already running',
      };
    }

    this.isRunning = true;
    this.startTime = new Date();
    this.updateState('deploying');

    this.log('info', 'Debug loop started', {
      config: this.config.name,
      maxIterations: this.config.safety.maxIterations,
    });

    try {
      // Main loop
      while (this.shouldContinue()) {
        if (this.isPaused) {
          await this.waitForResume();
          continue;
        }

        const result = await this.runIteration();

        if (result.completed) {
          this.updateState('completed');
          this.log('info', 'Debug loop completed successfully - no errors found', {
            iterations: this.currentIteration,
            duration: Date.now() - this.startTime.getTime(),
          });

          return {
            success: true,
            iterations: this.currentIteration,
            errorsFixed: this.getTotalErrorsFixed(),
            errorsRemaining: 0,
            totalDuration: Date.now() - this.startTime.getTime(),
            finalDeploymentUrl: result.deploymentUrl,
          };
        }

        if (result.failed) {
          this.updateState('failed');
          this.log('error', 'Debug loop failed - max iterations reached', {
            iterations: this.currentIteration,
            errorsRemaining: result.errorsRemaining,
          });

          return {
            success: false,
            iterations: this.currentIteration,
            errorsFixed: this.getTotalErrorsFixed(),
            errorsRemaining: result.errorsRemaining,
            totalDuration: Date.now() - this.startTime.getTime(),
            reason: 'Maximum iterations reached without resolving all errors',
          };
        }
      }

      // Should not reach here, but handle gracefully
      return {
        success: false,
        iterations: this.currentIteration,
        errorsFixed: this.getTotalErrorsFixed(),
        errorsRemaining: 0,
        totalDuration: Date.now() - this.startTime.getTime(),
        reason: 'Loop terminated unexpectedly',
      };
    } catch (error) {
      this.updateState('failed');
      this.log('error', 'Debug loop failed with exception', {
        error: error instanceof Error ? error.message : String(error),
      });

      return {
        success: false,
        iterations: this.currentIteration,
        errorsFixed: this.getTotalErrorsFixed(),
        errorsRemaining: 0,
        totalDuration: Date.now() - this.startTime.getTime(),
        reason: error instanceof Error ? error.message : String(error),
      };
    } finally {
      this.isRunning = false;
      this.monitor.stopMonitoring();
    }
  }

  /**
   * Pause the debug loop
   */
  pause(): void {
    this.isPaused = true;
    this.updateState('paused');
    this.log('info', 'Debug loop paused');
  }

  /**
   * Resume the debug loop
   */
  resume(): void {
    this.isPaused = false;
    this.log('info', 'Debug loop resumed');
  }

  /**
   * Stop the debug loop
   */
  stop(): void {
    this.isRunning = false;
    this.isPaused = false;
    this.monitor.stopMonitoring();
    this.log('info', 'Debug loop stopped');
  }

  /**
   * Get current state
   */
  getState(): {
    state: DebugLoopState;
    iteration: number;
    stats: DebugLoopStats;
  } {
    return {
      state: this.config.state,
      iteration: this.currentIteration,
      stats: this.getStats(),
    };
  }

  /**
   * Run a single iteration
   */
  private async runIteration(): Promise<{
    completed: boolean;
    failed: boolean;
    deploymentUrl?: string;
    errorsRemaining: number;
  }> {
    this.currentIteration++;
    const iterationStart = Date.now();

    this.log('info', `Starting iteration ${this.currentIteration}`);

    const iteration: DebugLoopIteration = {
      id: `iter-${Date.now()}`,
      loopId: this.config.id,
      iterationNumber: this.currentIteration,
      startedAt: new Date(),
      errorCount: 0,
      errors: [],
      fixesGenerated: [],
      fixesApplied: [],
      fixesRejected: [],
      outcome: 'running',
      logs: [],
      deploymentStatus: 'pending',
    };

    try {
      // Step 1: Deploy
      this.updateState('deploying');
      this.log('info', 'Deploying to remote...');

      const deployResult = await this.deployer.deploy({
        commitMessage: `Debug loop iteration ${this.currentIteration}`,
        createBranch: this.config.safety.createBackupBranch,
        branchName: this.config.safety.createBackupBranch
          ? `debug-loop-iter-${this.currentIteration}`
          : undefined,
      });

      if (!deployResult.success) {
        throw new Error(deployResult.error || 'Deployment failed');
      }

      iteration.deploymentCommit = deployResult.commitHash;
      iteration.deploymentUrl = deployResult.deploymentUrl;
      iteration.deploymentStatus = 'success';

      this.log('info', 'Deployment successful', {
        url: deployResult.deploymentUrl,
        commit: deployResult.commitHash,
      });

      // Step 2: Monitor for errors
      this.updateState('monitoring');
      this.log('info', 'Monitoring for errors...');

      await new Promise(resolve => setTimeout(resolve, 5000)); // Wait for deployment to propagate

      const monitorResult = await this.monitorForErrors(deployResult.deploymentUrl!);

      iteration.errors = monitorResult.errors;
      iteration.errorCount = monitorResult.errors.length;

      this.log('info', 'Monitoring complete', {
        errorsFound: monitorResult.errors.length,
        bySeverity: monitorResult.stats.bySeverity,
      });

      // Step 3: Check if complete (no errors)
      if (monitorResult.errors.length === 0) {
        iteration.outcome = 'completed';
        iteration.completedAt = new Date();
        iteration.duration = Date.now() - iterationStart;

        this.iterations.push(iteration);
        this.onIterationUpdate?.(iteration);

        return {
          completed: true,
          failed: false,
          deploymentUrl: deployResult.deploymentUrl,
          errorsRemaining: 0,
        };
      }

      // Step 4: Analyze and generate fixes
      this.updateState('analyzing');
      this.log('info', 'Generating fixes for detected errors...');

      const fixResult = await this.generateFixes(monitorResult.errors);

      iteration.fixesGenerated = fixResult.fixes;
      this.log('info', 'Fixes generated', {
        count: fixResult.fixes.length,
        reasoning: fixResult.reasoning,
      });

      // Step 5: Apply fixes
      this.updateState('fixing');
      this.log('info', 'Applying fixes...');

      const applyResult = await this.applyFixes(fixResult.fixes);

      iteration.fixesApplied = applyResult.applied;
      iteration.fixesRejected = applyResult.rejected;

      this.log('info', 'Fixes applied', {
        applied: applyResult.applied.length,
        rejected: applyResult.rejected.length,
      });

      // Update iteration
      iteration.outcome = 'running';
      iteration.completedAt = new Date();
      iteration.duration = Date.now() - iterationStart;

      this.iterations.push(iteration);
      this.onIterationUpdate?.(iteration);

      return {
        completed: false,
        failed: false,
        deploymentUrl: deployResult.deploymentUrl,
        errorsRemaining: monitorResult.errors.length,
      };
    } catch (error) {
      iteration.outcome = 'failed';
      iteration.completedAt = new Date();
      iteration.duration = Date.now() - iterationStart;

      this.iterations.push(iteration);
      this.onIterationUpdate?.(iteration);

      throw error;
    }
  }

  /**
   * Monitor deployment for errors
   */
  private async monitorForErrors(deploymentUrl: string): Promise<MonitoringResult> {
    await this.monitor.startMonitoring(deploymentUrl);

    // Wait for errors to accumulate
    const waitTime = 30000; // 30 seconds monitoring window
    await new Promise(resolve => setTimeout(resolve, waitTime));

    const errors = this.monitor.getCurrentErrors();
    this.monitor.stopMonitoring();

    // Calculate stats
    const stats = {
      total: errors.length,
      bySeverity: {} as Record<string, number>,
      byCategory: {} as Record<string, number>,
    };

    for (const error of errors) {
      stats.bySeverity[error.severity] = (stats.bySeverity[error.severity] || 0) + 1;
      stats.byCategory[error.category] = (stats.byCategory[error.category] || 0) + 1;
    }

    return {
      success: true,
      errors,
      stats,
    };
  }

  /**
   * Generate fixes for errors
   */
  private async generateFixes(errors: RemoteError[]): Promise<FixGenerationResult> {
    return await this.fixGenerator.generateFixes({
      errors,
      maxFixes: this.config.aiFix.maxIterations || 10,
      requireApproval: !this.config.aiFix.autoApply,
    });
  }

  /**
   * Apply fixes to codebase
   */
  private async applyFixes(fixes: FixSuggestion[]): Promise<{
    applied: FixSuggestion[];
    rejected: FixSuggestion[];
  }> {
    const applied: FixSuggestion[] = [];
    const rejected: FixSuggestion[] = [];

    for (const fix of fixes) {
      try {
        // In production, would call backend API to apply fix
        if (this.config.aiFix.autoApply) {
          // Auto-apply
          const result = await fetch('/api/debug-loop/apply-fix', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(fix),
          });

          if (result.ok) {
            fix.status = 'applied';
            fix.appliedAt = new Date();
            applied.push(fix);
          } else {
            fix.status = 'failed';
            rejected.push(fix);
          }
        } else {
          // Require approval - add to pending
          fix.status = 'pending';
          // Would wait for user approval
        }
      } catch (error) {
        fix.status = 'failed';
        rejected.push(fix);
      }
    }

    return { applied, rejected };
  }

  /**
   * Check if loop should continue
   */
  private shouldContinue(): boolean {
    // Check max iterations
    if (this.currentIteration >= this.config.safety.maxIterations) {
      this.log('warn', 'Max iterations reached', {
        max: this.config.safety.maxIterations,
      });
      return false;
    }

    // Check max duration
    const elapsedMinutes = (Date.now() - this.startTime.getTime()) / 60000;
    if (elapsedMinutes > this.config.safety.maxDuration) {
      this.log('warn', 'Max duration reached', {
        max: this.config.safety.maxDuration,
        elapsed: elapsedMinutes.toFixed(0),
      });
      return false;
    }

    return true;
  }

  /**
   * Wait for resume (when paused)
   */
  private async waitForResume(): Promise<void> {
    return new Promise(resolve => {
      const checkInterval = setInterval(() => {
        if (!this.isPaused) {
          clearInterval(checkInterval);
          resolve();
        }
      }, 500);
    });
  }

  /**
   * Update state and notify listeners
   */
  private updateState(state: DebugLoopState): void {
    this.config.state = state;
    this.onStateChange?.(state);
  }

  /**
   * Add log entry
   */
  private log(level: IterationLog['level'], message: string, details?: Record<string, unknown>): void {
    const log: IterationLog = {
      id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      level,
      message,
      details,
    };

    this.onLog?.(log);
  }

  /**
   * Calculate total errors fixed across all iterations
   */
  private getTotalErrorsFixed(): number {
    return this.iterations.reduce((sum, iter) => {
      return sum + iter.fixesApplied.length;
    }, 0);
  }

  /**
   * Get current statistics
   */
  private getStats(): DebugLoopStats {
    const totalErrorsFixed = this.getTotalErrorsFixed();
    const latestIteration = this.iterations[this.iterations.length - 1];
    const errorsRemaining = latestIteration?.errors.length || 0;

    const totalDuration = Date.now() - this.startTime.getTime();
    const avgDuration = this.iterations.length > 0
      ? totalDuration / this.iterations.length
      : 0;

    // Calculate by category
    const byCategory: Record<string, number> = {};
    for (const iter of this.iterations) {
      for (const error of iter.errors) {
        byCategory[error.category] = (byCategory[error.category] || 0) + 1;
      }
    }

    // Calculate by severity
    const bySeverity: Record<string, number> = {};
    for (const iter of this.iterations) {
      for (const error of iter.errors) {
        bySeverity[error.severity] = (bySeverity[error.severity] || 0) + 1;
      }
    }

    // Most common errors
    const errorCounts = new Map<string, number>();
    for (const iter of this.iterations) {
      for (const error of iter.errors) {
        const key = `${error.message}:${error.source.file}`;
        errorCounts.set(key, (errorCounts.get(key) || 0) + 1);
      }
    }

    const mostCommonErrors = Array.from(errorCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([message, count]) => {
        const [file] = message.split(':');
        return { message, count, file };
      });

    return {
      totalIterations: this.iterations.length,
      totalErrorsFixed,
      totalErrorsRemaining: errorsRemaining,
      averageIterationDuration: avgDuration,
      totalDuration,
      successRate: this.iterations.length > 0
        ? (1 / this.iterations.length) * 100
        : 0,
      byCategory,
      bySeverity,
      mostCommonErrors,
    };
  }
}

/**
 * Start debug loop via API (frontend version)
 */
export async function startDebugLoop(
  config: DebugLoopConfig
): Promise<{ success: boolean; loopId?: string; error?: string }> {
  try {
    const response = await fetch('/api/debug-loop/start', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(config),
    });

    if (!response.ok) {
      throw new Error(`Start debug loop failed: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Stop debug loop via API
 */
export async function stopDebugLoop(loopId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch(`/api/debug-loop/stop/${loopId}`, {
      method: 'POST',
    });

    if (!response.ok) {
      throw new Error(`Stop debug loop failed: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
