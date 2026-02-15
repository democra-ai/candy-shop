// Remote Error Monitoring System
// Monitors deployed application for errors in real-time

import type { RemoteError, MonitoringConfig, ErrorSource } from '../types/auto-debug';

export interface MonitoringResult {
  success: boolean;
  errors: RemoteError[];
  stats: {
    total: number;
    bySeverity: Record<string, number>;
    byCategory: Record<string, number>;
  };
  error?: string;
}

export interface MonitoringSession {
  id: string;
  startedAt: Date;
  config: MonitoringConfig;
  isActive: boolean;
  errorsFound: RemoteError[];
}

export class RemoteMonitor {
  private config: MonitoringConfig;
  private session: MonitoringSession | null = null;
  private pollInterval: ReturnType<typeof setInterval> | null = null;
  private eventSources: EventSource[] = [];

  constructor(config: MonitoringConfig) {
    this.config = config;
  }

  /**
   * Start monitoring remote deployment
   */
  async startMonitoring(deploymentUrl: string): Promise<MonitoringSession> {
    // Initialize session
    this.session = {
      id: `monitor-${Date.now()}`,
      startedAt: new Date(),
      config: this.config,
      isActive: true,
      errorsFound: [],
    };

    // Enable different monitoring sources
    for (const source of this.config.sources) {
      await this.enableSource(source, deploymentUrl);
    }

    // Start polling if enabled
    if (this.config.pollInterval && this.config.pollInterval > 0) {
      this.startPolling(deploymentUrl);
    }

    return this.session;
  }

  /**
   * Stop monitoring
   */
  stopMonitoring(): void {
    if (!this.session) return;

    this.session.isActive = false;

    // Stop polling
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }

    // Close event sources
    for (const eventSource of this.eventSources) {
      eventSource.close();
    }
    this.eventSources = [];
  }

  /**
   * Get current errors
   */
  getCurrentErrors(): RemoteError[] {
    return this.session?.errorsFound || [];
  }

  /**
   * Clear errors
   */
  clearErrors(): void {
    if (this.session) {
      this.session.errorsFound = [];
    }
  }

  /**
   * Enable a monitoring source
   */
  private async enableSource(source: ErrorSource, deploymentUrl: string): Promise<void> {
    switch (source) {
      case 'browser-console':
        await this.enableBrowserConsoleMonitoring(deploymentUrl);
        break;

      case 'sentry':
        await this.enableSentryMonitoring(deploymentUrl);
        break;

      case 'logrocket':
        await this.enableLogrocketMonitoring(deploymentUrl);
        break;

      case 'api-endpoint':
        await this.enableApiEndpointMonitoring(deploymentUrl);
        break;

      case 'github-actions':
        await this.enableGitHubActionsMonitoring(deploymentUrl);
        break;

      case 'server-logs':
        await this.enableServerLogsMonitoring(deploymentUrl);
        break;
    }
  }

  /**
   * Monitor via browser console (requires instrumentation)
   */
  private async enableBrowserConsoleMonitoring(deploymentUrl: string): Promise<void> {
    // In production, would connect to deployed app's error reporting endpoint
    // For now, simulate connection

    const eventSource = new EventSource(`${deploymentUrl}/api/monitor/errors`);

    eventSource.addEventListener('error', (event: MessageEvent) => {
      const error = JSON.parse(event.data);
      this.addError(error);
    });

    eventSource.addEventListener('console-error', (event: MessageEvent) => {
      const error = JSON.parse(event.data);
      this.addError(error);
    });

    this.eventSources.push(eventSource);
  }

  /**
   * Monitor via Sentry API
   */
  private async enableSentryMonitoring(_deploymentUrl: string): Promise<void> {
    // In production, would:
    // 1. Connect to Sentry API
    // 2. Fetch recent errors
    // 3. Stream new errors via webhook

    try {
      // Mock: Fetch recent Sentry errors
      const response = await fetch('/api/monitor/sentry/errors');
      if (response.ok) {
        const data = await response.json();
        for (const error of data.errors || []) {
          this.addError(this.sentryToRemoteError(error));
        }
      }
    } catch (error) {
      console.error('Sentry monitoring failed:', error);
    }
  }

  /**
   * Monitor via LogRocket
   */
  private async enableLogrocketMonitoring(_deploymentUrl: string): Promise<void> {
    // Similar to Sentry, would connect to LogRocket API
    try {
      const response = await fetch('/api/monitor/logrocket/errors');
      if (response.ok) {
        const data = await response.json();
        for (const error of data.errors || []) {
          this.addError(this.logrocketToRemoteError(error));
        }
      }
    } catch (error) {
      console.error('LogRocket monitoring failed:', error);
    }
  }

  /**
   * Monitor via custom API endpoint
   */
  private async enableApiEndpointMonitoring(deploymentUrl: string): Promise<void> {
    const eventSource = new EventSource(`${deploymentUrl}/api/errors/stream`);

    eventSource.addEventListener('error', (event: MessageEvent) => {
      const error = JSON.parse(event.data);
      this.addError(error);
    });

    this.eventSources.push(eventSource);
  }

  /**
   * Monitor GitHub Actions for build/deployment errors
   */
  private async enableGitHubActionsMonitoring(_deploymentUrl: string): Promise<void> {
    try {
      const response = await fetch('/api/monitor/github-actions/status');
      if (response.ok) {
        const data = await response.json();

        // Check for failed workflows
        if (data.status === 'failed') {
          this.addError({
            id: `gh-action-${Date.now()}`,
            timestamp: new Date(),
            severity: 'high',
            category: 'deployment',
            message: 'GitHub Actions workflow failed',
            source: {
              file: '.github/workflows',
              line: 0,
            },
            context: {
              additionalData: {
                workflowName: data.workflow,
                runId: data.runId,
                logUrl: data.logUrl,
              },
            },
            occurrenceCount: 1,
            firstSeenAt: new Date(),
            lastSeenAt: new Date(),
            resolved: false,
          });
        }
      }
    } catch (error) {
      console.error('GitHub Actions monitoring failed:', error);
    }
  }

  /**
   * Monitor server logs
   */
  private async enableServerLogsMonitoring(_deploymentUrl: string): Promise<void> {
    try {
      const response = await fetch('/api/monitor/server-logs/errors');
      if (response.ok) {
        const data = await response.json();
        for (const logEntry of data.logs || []) {
          if (logEntry.level === 'error') {
            this.addError(this.logToRemoteError(logEntry));
          }
        }
      }
    } catch (error) {
      console.error('Server logs monitoring failed:', error);
    }
  }

  /**
   * Start polling for errors
   */
  private startPolling(deploymentUrl: string): void {
    this.pollInterval = setInterval(async () => {
      if (!this.session?.isActive) return;

      try {
        const response = await fetch(`${deploymentUrl}/api/monitor/poll`);
        if (response.ok) {
          const data = await response.json();
          for (const error of data.errors || []) {
            this.addError(error);
          }
        }
      } catch (error) {
        console.error('Polling failed:', error);
      }
    }, this.config.pollInterval || 10000);
  }

  /**
   * Add error to session (deduplication)
   */
  private addError(error: RemoteError): void {
    if (!this.session) return;

    // Check if error already exists
    const existing = this.session.errorsFound.find(
      e => e.message === error.message &&
           e.source.file === error.source.file &&
           e.source.line === error.source.line
    );

    if (existing) {
      existing.occurrenceCount++;
      existing.lastSeenAt = new Date();
    } else {
      this.session.errorsFound.push(error);
    }

    // Filter by severity
    if (this.config.severityThreshold) {
      const thresholdOrder = ['low', 'medium', 'high', 'critical'];
      const errorLevel = thresholdOrder.indexOf(error.severity);
      const thresholdLevel = thresholdOrder.indexOf(this.config.severityThreshold);

      if (errorLevel < thresholdLevel) {
        // Remove error that doesn't meet threshold
        const index = this.session.errorsFound.indexOf(error);
        if (index > -1) {
          this.session.errorsFound.splice(index, 1);
        }
      }
    }

    // Filter by patterns
    if (this.config.ignorePatterns && this.config.ignorePatterns.length > 0) {
      for (const pattern of this.config.ignorePatterns) {
        const regex = new RegExp(pattern);
        if (regex.test(error.message) || regex.test(error.stack || '')) {
          const index = this.session.errorsFound.indexOf(error);
          if (index > -1) {
            this.session.errorsFound.splice(index, 1);
          }
        }
      }
    }
  }

  /**
   * Convert Sentry error to RemoteError
   */
  private sentryToRemoteError(sentryError: any): RemoteError {
    return {
      id: sentryError.eventId || `sentry-${Date.now()}`,
      timestamp: new Date(sentryError.timestamp || Date.now()),
      severity: this.mapSentryLevel(sentryError.level),
      category: 'runtime',
      message: sentryError.message || 'Unknown error',
      stack: sentryError.stacktrace?.map((s: any) => s).join('\n'),
      source: {
        file: sentryError.culprit?.filename || 'unknown',
        line: sentryError.culprit?.line || 0,
        column: sentryError.culprit?.col,
      },
      context: {
        userId: sentryError.user?.id,
        sessionId: sentryError.session_id,
        additionalData: sentryError.extra,
      },
      occurrenceCount: 1,
      firstSeenAt: new Date(sentryError.firstSeen || Date.now()),
      lastSeenAt: new Date(sentryError.lastSeen || Date.now()),
      resolved: false,
    };
  }

  /**
   * Convert LogRocket error to RemoteError
   */
  private logrocketToRemoteError(lrError: any): RemoteError {
    return {
      id: lrError.id || `lr-${Date.now()}`,
      timestamp: new Date(lrError.timestamp || Date.now()),
      severity: 'medium',
      category: 'runtime',
      message: lrError.message || 'Unknown error',
      stack: lrError.stack,
      source: {
        file: lrError.file || 'unknown',
        line: lrError.line || 0,
      },
      occurrenceCount: lrError.count || 1,
      firstSeenAt: new Date(lrError.firstSeen || Date.now()),
      lastSeenAt: new Date(lrError.lastSeen || Date.now()),
      resolved: false,
    };
  }

  /**
   * Convert log entry to RemoteError
   */
  private logToRemoteError(log: any): RemoteError {
    return {
      id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(log.timestamp || Date.now()),
      severity: 'high',
      category: 'runtime',
      message: log.message || 'Server error',
      stack: log.stack,
      source: {
        file: log.file || 'unknown',
        line: log.line || 0,
      },
      occurrenceCount: 1,
      firstSeenAt: new Date(),
      lastSeenAt: new Date(),
      resolved: false,
    };
  }

  /**
   * Map Sentry level to severity
   */
  private mapSentryLevel(level: string): RemoteError['severity'] {
    const levelMap: Record<string, RemoteError['severity']> = {
      'fatal': 'critical',
      'error': 'high',
      'warning': 'medium',
      'info': 'low',
      'debug': 'low',
    };

    return levelMap[level] || 'medium';
  }
}

/**
 * Fetch errors from monitoring endpoint (one-time fetch)
 */
export async function fetchMonitoringErrors(
  deploymentUrl: string,
  config: MonitoringConfig
): Promise<MonitoringResult> {
  try {
    const response = await fetch(`${deploymentUrl}/api/monitor/errors`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(config),
    });

    if (!response.ok) {
      throw new Error(`Monitoring fetch failed: ${response.status}`);
    }

    const data = await response.json();

    // Process errors
    const errors: RemoteError[] = (data.errors || []).map((e: any) => ({
      id: e.id,
      timestamp: new Date(e.timestamp),
      severity: e.severity,
      category: e.category,
      message: e.message,
      stack: e.stack,
      source: e.source,
      context: e.context,
      occurrenceCount: e.occurrenceCount || 1,
      firstSeenAt: new Date(e.firstSeenAt),
      lastSeenAt: new Date(e.lastSeenAt),
      resolved: e.resolved || false,
    }));

    // Filter by severity
    let filtered = errors;
    if (config.severityThreshold) {
      const thresholdOrder = ['low', 'medium', 'high', 'critical'];
      const thresholdLevel = thresholdOrder.indexOf(config.severityThreshold);
      filtered = filtered.filter(e => {
        const level = thresholdOrder.indexOf(e.severity);
        return level >= thresholdLevel;
      });
    }

    // Filter by patterns
    if (config.ignorePatterns && config.ignorePatterns.length > 0) {
      for (const pattern of config.ignorePatterns) {
        const regex = new RegExp(pattern);
        filtered = filtered.filter(e => {
          return !regex.test(e.message) && !regex.test(e.stack || '');
        });
      }
    }

    // Calculate stats
    const stats = {
      total: filtered.length,
      bySeverity: {} as Record<string, number>,
      byCategory: {} as Record<string, number>,
    };

    for (const error of filtered) {
      stats.bySeverity[error.severity] = (stats.bySeverity[error.severity] || 0) + 1;
      stats.byCategory[error.category] = (stats.byCategory[error.category] || 0) + 1;
    }

    return {
      success: true,
      errors: filtered,
      stats,
    };
  } catch (error) {
    return {
      success: false,
      errors: [],
      stats: {
        total: 0,
        bySeverity: {},
        byCategory: {},
      },
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
