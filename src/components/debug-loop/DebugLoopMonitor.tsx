import { useState, useEffect } from 'react';
import {
  Play,
  Pause,
  Stop,
  RotateCcw,
  CheckCircle,
  XCircle,
  AlertCircle,
  Bug,
  Clock,
  FileText,
  GitBranch,
  ExternalLink,
  ChevronDown,
  ChevronRight,
  Zap,
  Activity,
} from 'lucide-react';
import type {
  DebugLoopConfig,
  DebugLoopState,
  DebugLoopIteration,
  DebugLoopStats,
  RemoteError,
  FixSuggestion,
  IterationLog,
} from '../../types/auto-debug';

interface DebugLoopMonitorProps {
  config: DebugLoopConfig;
  onStart?: () => void;
  onPause?: () => void;
  onResume?: () => void;
  onStop?: () => void;
}

export function DebugLoopMonitor({ config, onStart, onPause, onResume, onStop }: DebugLoopMonitorProps) {
  const [state, setState] = useState<DebugLoopState>(config.state);
  const [currentIteration, setCurrentIteration] = useState(0);
  const [iterations, setIterations] = useState<DebugLoopIteration[]>([]);
  const [logs, setLogs] = useState<IterationLog[]>([]);
  const [stats, setStats] = useState<DebugLoopStats | null>(null);
  const [showLogs, setShowLogs] = useState(false);
  const [showFixes, setShowFixes] = useState(false);

  // Simulate real-time updates (in production, would use WebSocket/SSE)
  useEffect(() => {
    const interval = setInterval(() => {
      // In production, would fetch actual state from backend
      if (state === 'running' || state === 'monitoring') {
        // Generate mock updates
        setLogs(prev => [
          ...prev,
          {
            id: `log-${Date.now()}`,
            timestamp: new Date(),
            level: 'info' as const,
            message: 'Monitoring deployment for errors...',
          },
        ].slice(-50));
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [state]);

  const latestIteration = iterations[iterations.length - 1];

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Left Sidebar - Controls */}
      <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900 mb-2">Auto Debug Loop</h2>
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${
              state === 'running' || state === 'monitoring' || state === 'fixing'
                ? 'bg-green-500 animate-pulse'
                : state === 'completed'
                  ? 'bg-green-500'
                  : state === 'failed'
                    ? 'bg-red-500'
                    : 'bg-gray-300'
            }`} />
            <span className="text-sm text-gray-600 capitalize">{state}</span>
          </div>
        </div>

        {/* Control Buttons */}
        <div className="p-6 space-y-3">
          {state === 'idle' && (
            <button
              onClick={onStart}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 transition-colors"
            >
              <Play className="w-4 h-4" />
              Start Loop
            </button>
          )}

          {(state === 'running' || state === 'monitoring' || state === 'fixing') && (
            <>
              <button
                onClick={onPause}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-amber-500 text-white font-medium rounded-lg hover:bg-amber-600 transition-colors"
              >
                <Pause className="w-4 h-4" />
                Pause
              </button>
              <button
                onClick={onStop}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 transition-colors"
              >
                <Stop className="w-4 h-4" />
                Stop Loop
              </button>
            </>
          )}

          {state === 'paused' && (
            <button
              onClick={onResume}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Play className="w-4 h-4" />
              Resume
            </button>
          )}

          {(state === 'completed' || state === 'failed') && (
            <button
              onClick={() => {
                setIterations([]);
                setLogs([]);
                setStats(null);
              }}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gray-600 text-white font-medium rounded-lg hover:bg-gray-700 transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              Reset
            </button>
          )}
        </div>

        {/* Stats */}
        {stats && (
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">Statistics</h3>

            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Iterations</span>
                <span className="text-sm font-medium text-gray-900">{stats.totalIterations}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Errors Fixed</span>
                <span className="text-sm font-medium text-green-600">{stats.totalErrorsFixed}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Errors Remaining</span>
                <span className="text-sm font-medium text-red-600">{stats.totalErrorsRemaining}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Avg Duration</span>
                <span className="text-sm font-medium text-gray-900">
                  {Math.round(stats.averageIterationDuration / 1000)}s
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Success Rate</span>
                <span className="text-sm font-medium text-gray-900">{stats.successRate.toFixed(0)}%</span>
              </div>
            </div>

            {stats.mostCommonErrors.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-gray-900 mb-2">Top Errors</h4>
                {stats.mostCommonErrors.map((error, i) => (
                  <div key={i} className="text-xs p-2 bg-gray-50 rounded-lg">
                    <div className="font-medium text-gray-900 truncate">{error.message}</div>
                    <div className="flex justify-between mt-1">
                      <span className="text-gray-500">{error.file}</span>
                      <span className="text-gray-600">{error.count}x</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{config.name}</h1>
            <p className="text-sm text-gray-500 mt-1">{config.description || 'Automated debug loop'}</p>
          </div>

          {latestIteration?.deploymentUrl && (
            <a
              href={latestIteration.deploymentUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
              <span className="text-sm font-medium">View Deployment</span>
            </a>
          )}
        </div>

        {/* Tabs */}
        <div className="h-12 bg-white border-b border-gray-200 flex items-center px-6">
          <button
            onClick={() => {
              setShowLogs(true);
              setShowFixes(false);
            }}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              showLogs
                ? 'border-primary text-primary'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            Activity
          </button>
          <button
            onClick={() => {
              setShowLogs(false);
              setShowFixes(true);
            }}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              showFixes
                ? 'border-primary text-primary'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            Fixes
          </button>
          <button
            onClick={() => {
              setShowLogs(false);
              setShowFixes(false);
            }}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              !showLogs && !showFixes
                ? 'border-primary text-primary'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            Overview
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          {/* Overview */}
          {!showLogs && !showFixes && (
            <div className="h-full overflow-y-auto p-6">
              {latestIteration ? (
                <div className="space-y-6">
                  {/* Current Iteration */}
                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold text-gray-900">Iteration {latestIteration.iterationNumber}</h3>
                      <div className={`px-3 py-1 rounded-full text-xs font-medium ${
                        latestIteration.outcome === 'completed'
                          ? 'bg-green-100 text-green-700'
                          : latestIteration.outcome === 'failed'
                            ? 'bg-red-100 text-red-700'
                            : 'bg-blue-100 text-blue-700'
                      }`}>
                        {latestIteration.outcome}
                      </div>
                    </div>

                    {latestIteration.errors.length > 0 && (
                      <div className="space-y-3">
                        <h4 className="text-sm font-medium text-gray-700 flex items-center gap-2">
                          <Bug className="w-4 h-4 text-red-500" />
                          Errors Found ({latestIteration.errors.length})
                        </h4>
                        {latestIteration.errors.slice(0, 5).map(error => (
                          <div key={error.id} className="bg-red-50 rounded-lg p-3">
                            <div className="flex items-start gap-3">
                              <AlertCircle className="w-5 h-5 text-red-500 mt-0.5" />
                              <div className="flex-1 min-w-0">
                                <div className="text-sm font-medium text-gray-900">{error.message}</div>
                                <div className="text-xs text-gray-500 mt-1">
                                  {error.source.file}:{error.source.line}
                                </div>
                              </div>
                              <div className={`px-2 py-1 rounded text-xs font-medium ${
                                error.severity === 'critical'
                                  ? 'bg-red-200 text-red-800'
                                  : error.severity === 'high'
                                    ? 'bg-orange-200 text-orange-800'
                                    : 'bg-yellow-200 text-yellow-800'
                              }`}>
                                {error.severity}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {latestIteration.fixesGenerated.length > 0 && (
                      <div className="space-y-3 mt-4">
                        <h4 className="text-sm font-medium text-gray-700 flex items-center gap-2">
                          <Zap className="w-4 h-4 text-amber-500" />
                          Fixes Generated ({latestIteration.fixesGenerated.length})
                        </h4>
                        {latestIteration.fixesGenerated.slice(0, 5).map(fix => (
                          <div key={fix.id} className="bg-amber-50 rounded-lg p-3">
                            <div className="flex items-start gap-3">
                              <FileText className="w-5 h-5 text-amber-600 mt-0.5" />
                              <div className="flex-1 min-w-0">
                                <div className="text-sm font-medium text-gray-900">{fix.explanation}</div>
                                <div className="flex items-center gap-2 mt-2">
                                  <span className={`text-xs px-2 py-1 rounded font-medium ${
                                    fix.priority === 'critical'
                                      ? 'bg-red-200 text-red-800'
                                      : 'bg-blue-200 text-blue-800'
                                  }`}>
                                    {fix.priority}
                                  </span>
                                  <span className="text-xs text-gray-500">
                                    {Math.round(fix.confidence * 100)}% confidence
                                  </span>
                                </div>
                              </div>
                              <div className={`px-2 py-1 rounded text-xs font-medium ${
                                fix.status === 'applied'
                                  ? 'bg-green-200 text-green-800'
                                  : fix.status === 'rejected'
                                    ? 'bg-red-200 text-red-800'
                                    : 'bg-gray-200 text-gray-700'
                              }`}>
                                {fix.status}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <Activity className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">Ready to Start</h3>
                    <p className="text-sm text-gray-500">
                      Configure your debug loop settings and click "Start Loop" to begin
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Activity Logs */}
          {showLogs && (
            <div className="h-full overflow-y-auto p-6">
              <div className="space-y-2">
                {logs.map(log => (
                  <div key={log.id} className="flex items-start gap-3 text-sm">
                    <span className="text-gray-400">{log.timestamp.toLocaleTimeString()}</span>
                    <span className={`font-medium ${
                      log.level === 'error' ? 'text-red-600' :
                      log.level === 'warn' ? 'text-amber-600' :
                      log.level === 'debug' ? 'text-gray-500' :
                      'text-gray-600'
                    }`}>
                      [{log.level.toUpperCase()}]
                    </span>
                    <span className="flex-1 text-gray-700">{log.message}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Fixes */}
          {showFixes && (
            <div className="h-full overflow-y-auto p-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {iterations.flatMap(iter => iter.fixesGenerated).map(fix => (
                  <div key={fix.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-gray-500" />
                        <span className="text-sm font-medium text-gray-900">{fix.file}</span>
                      </div>
                      <div className={`px-2 py-1 rounded text-xs font-medium ${
                        fix.status === 'applied'
                          ? 'bg-green-200 text-green-800'
                          : fix.status === 'rejected'
                            ? 'bg-red-200 text-red-800'
                            : 'bg-gray-200 text-gray-700'
                      }`}>
                        {fix.status}
                      </div>
                    </div>

                    <p className="text-sm text-gray-700 mb-3">{fix.explanation}</p>

                    {fix.fixedCode && (
                      <div className="bg-gray-50 rounded-lg p-3 mb-3">
                      <pre className="text-xs text-gray-800 overflow-x-auto">
                        <code>{fix.fixedCode}</code>
                      </pre>
                    </div>
                    )}

                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-1 rounded font-medium ${
                          fix.priority === 'critical'
                            ? 'bg-red-200 text-red-800'
                            : 'bg-blue-200 text-blue-800'
                        }`}>
                          {fix.priority}
                        </span>
                        <span className="text-gray-500">
                          {Math.round(fix.confidence * 100)}% confidence
                        </span>
                      </div>
                      <div className="flex gap-2">
                        {fix.status === 'pending' && (
                          <>
                            <button className="px-3 py-1 bg-green-600 text-white rounded font-medium hover:bg-green-700">
                              Apply
                            </button>
                            <button className="px-3 py-1 bg-gray-200 text-gray-700 rounded font-medium hover:bg-gray-300">
                              Reject
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
