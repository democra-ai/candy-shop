import { useState } from 'react';
import {
  GitBranch,
  Globe,
  Settings,
  Shield,
  Bell,
  ChevronRight,
  CheckCircle,
} from 'lucide-react';
import type { DebugLoopConfig } from '../../types/auto-debug';

interface DebugLoopConfigPageProps {
  initialConfig?: Partial<DebugLoopConfig>;
  onSave: (config: DebugLoopConfig) => void;
  onCancel: () => void;
}

export function DebugLoopConfigPage({ initialConfig, onSave, onCancel }: DebugLoopConfigPageProps) {
  const [config, setConfig] = useState<Partial<DebugLoopConfig>>(() => ({
    id: initialConfig?.id || `loop-${Date.now()}`,
    name: initialConfig?.name || 'My Debug Loop',
    description: initialConfig?.description || '',
    deployment: initialConfig?.deployment || {
      target: 'github-pages',
      gitRemote: '',
      gitBranch: 'main',
      environment: 'production',
    },
    monitoring: initialConfig?.monitoring || {
      sources: ['browser-console', 'api-endpoint'],
      pollInterval: 10000,
      enableRealtime: true,
      severityThreshold: 'medium',
    },
    aiFix: initialConfig?.aiFix || {
      enabled: true,
      provider: 'openai',
      autoApply: false,
      requireApproval: true,
      maxIterations: 10,
    },
    safety: initialConfig?.safety || {
      maxIterations: 10,
      maxDuration: 60,
      rollbackOnFailure: true,
      createBackupBranch: true,
    },
    notifications: initialConfig?.notifications || {
      enabled: true,
      onIteration: true,
      onError: true,
      onComplete: true,
    },
    state: 'idle',
    currentIteration: 0,
  }));

  const [activeSection, setActiveSection] = useState<'deployment' | 'monitoring' | 'ai-fix' | 'safety' | 'notifications'>('deployment');

  const handleSave = () => {
    // Validate config
    if (!config.name || config.name.trim() === '') {
      alert('Please enter a name for the debug loop');
      return;
    }

    onSave(config as DebugLoopConfig);
  };

  return (
    <div className="max-w-4xl mx-auto p-8">
      {/* Header */}
      <div className="mb-8">
        <button
          onClick={onCancel}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors mb-4"
        >
          <ChevronRight className="w-4 h-4 rotate-180" />
          Back
        </button>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Configure Debug Loop</h1>
        <p className="text-gray-600">Set up automated deployment, monitoring, and fixing</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left Sidebar - Navigation */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Settings</h2>
            </div>

            <nav className="p-2">
              <button
                onClick={() => setActiveSection('deployment')}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                  activeSection === 'deployment'
                    ? 'bg-primary text-white'
                    : 'hover:bg-gray-100 text-gray-700'
                }`}
              >
                <GitBranch className="w-4 h-4" />
                <span className="text-sm font-medium">Deployment</span>
              </button>

              <button
                onClick={() => setActiveSection('monitoring')}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                  activeSection === 'monitoring'
                    ? 'bg-primary text-white'
                    : 'hover:bg-gray-100 text-gray-700'
                }`}
              >
                <Globe className="w-4 h-4" />
                <span className="text-sm font-medium">Monitoring</span>
              </button>

              <button
                onClick={() => setActiveSection('ai-fix')}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                  activeSection === 'ai-fix'
                    ? 'bg-primary text-white'
                    : 'hover:bg-gray-100 text-gray-700'
                }`}
              >
                <Settings className="w-4 h-4" />
                <span className="text-sm font-medium">AI Fix</span>
              </button>

              <button
                onClick={() => setActiveSection('safety')}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                  activeSection === 'safety'
                    ? 'bg-primary text-white'
                    : 'hover:bg-gray-100 text-gray-700'
                }`}
              >
                <Shield className="w-4 h-4" />
                <span className="text-sm font-medium">Safety</span>
              </button>

              <button
                onClick={() => setActiveSection('notifications')}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                  activeSection === 'notifications'
                    ? 'bg-primary text-white'
                    : 'hover:bg-gray-100 text-gray-700'
                }`}
              >
                <Bell className="w-4 h-4" />
                <span className="text-sm font-medium">Notifications</span>
              </button>
            </nav>
          </div>
        </div>

        {/* Right Content - Configuration Forms */}
        <div className="lg:col-span-3">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            {/* Deployment Section */}
            {activeSection === 'deployment' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-4">Deployment Configuration</h3>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Deployment Target</label>
                      <select
                        value={config.deployment?.target}
                        onChange={(e) => setConfig(prev => ({
                          ...prev,
                          deployment: { ...prev.deployment!, target: e.target.value as any }
                        }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                      >
                        <option value="github-pages">GitHub Pages</option>
                        <option value="vercel">Vercel</option>
                        <option value="netlify">Netlify</option>
                        <option value="custom">Custom</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Git Remote URL</label>
                      <input
                        type="text"
                        value={config.deployment?.gitRemote || ''}
                        onChange={(e) => setConfig(prev => ({
                          ...prev,
                          deployment: { ...prev.deployment!, gitRemote: e.target.value }
                        }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                        placeholder="https://github.com/user/repo"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Branch</label>
                      <input
                        type="text"
                        value={config.deployment?.gitBranch || ''}
                        onChange={(e) => setConfig(prev => ({
                          ...prev,
                          deployment: { ...prev.deployment!, gitBranch: e.target.value }
                        }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                        placeholder="main"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Environment</label>
                      <select
                        value={config.deployment?.environment}
                        onChange={(e) => setConfig(prev => ({
                          ...prev,
                          deployment: { ...prev.deployment!, environment: e.target.value as any }
                        }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                      >
                        <option value="production">Production</option>
                        <option value="staging">Staging</option>
                        <option value="development">Development</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Monitoring Section */}
            {activeSection === 'monitoring' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-4">Error Monitoring</h3>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Error Sources</label>
                      <div className="space-y-2">
                        {[
                          { id: 'browser-console', label: 'Browser Console' },
                          { id: 'api-endpoint', label: 'API Endpoint' },
                          { id: 'sentry', label: 'Sentry' },
                          { id: 'logrocket', label: 'LogRocket' },
                          { id: 'github-actions', label: 'GitHub Actions' },
                        ].map(source => (
                          <label key={source.id} className="flex items-center gap-3">
                            <input
                              type="checkbox"
                              checked={config.monitoring?.sources?.includes(source.id as any)}
                              onChange={(e) => {
                                const sources = e.target.checked
                                  ? [...(config.monitoring?.sources || []), source.id as any]
                                  : (config.monitoring?.sources || []).filter(s => s !== source.id);
                                setConfig(prev => ({
                                  ...prev,
                                  monitoring: { ...prev.monitoring!, sources }
                                }));
                              }}
                              className="rounded border-gray-300 text-primary focus:ring-primary"
                            />
                            <span className="text-sm text-gray-700">{source.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Polling Interval</label>
                      <div className="flex items-center gap-3">
                        <input
                          type="range"
                          min="5000"
                          max="60000"
                          step="5000"
                          value={config.monitoring?.pollInterval || 10000}
                          onChange={(e) => setConfig(prev => ({
                            ...prev,
                            monitoring: { ...prev.monitoring!, pollInterval: parseInt(e.target.value) }
                          }))}
                          className="flex-1"
                        />
                        <span className="text-sm text-gray-600 w-16">
                          {Math.round((config.monitoring?.pollInterval || 10000) / 1000)}s
                        </span>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Severity Threshold</label>
                      <select
                        value={config.monitoring?.severityThreshold}
                        onChange={(e) => setConfig(prev => ({
                          ...prev,
                          monitoring: { ...prev.monitoring!, severityThreshold: e.target.value as any }
                        }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                      >
                        <option value="low">Low and above</option>
                        <option value="medium">Medium and above</option>
                        <option value="high">High and above</option>
                        <option value="critical">Critical only</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* AI Fix Section */}
            {activeSection === 'ai-fix' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-4">AI Fix Configuration</h3>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Provider</label>
                      <select
                        value={config.aiFix?.provider}
                        onChange={(e) => setConfig(prev => ({
                          ...prev,
                          aiFix: { ...prev.aiFix!, provider: e.target.value as any }
                        }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                      >
                        <option value="openai">OpenAI</option>
                        <option value="anthropic">Anthropic</option>
                        <option value="local">Local</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Max Iterations per Loop</label>
                      <input
                        type="number"
                        min="1"
                        max="50"
                        value={config.aiFix?.maxIterations || 10}
                        onChange={(e) => setConfig(prev => ({
                          ...prev,
                          aiFix: { ...prev.aiFix!, maxIterations: parseInt(e.target.value) }
                        }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                    </div>

                    <div>
                      <label className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={config.aiFix?.autoApply}
                          onChange={(e) => setConfig(prev => ({
                            ...prev,
                            aiFix: { ...prev.aiFix!, autoApply: e.target.checked }
                          }))}
                          className="rounded border-gray-300 text-primary focus:ring-primary"
                        />
                        <span className="text-sm text-gray-700">Auto-apply fixes (dangerous)</span>
                      </label>
                      <p className="text-xs text-gray-500 mt-1 ml-6">
                        When enabled, fixes will be applied automatically without approval
                      </p>
                    </div>

                    <div>
                      <label className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={config.aiFix?.requireApproval}
                          onChange={(e) => setConfig(prev => ({
                            ...prev,
                            aiFix: { ...prev.aiFix!, requireApproval: e.target.checked }
                          }))}
                          className="rounded border-gray-300 text-primary focus:ring-primary"
                        />
                        <span className="text-sm text-gray-700">Require approval for fixes</span>
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Safety Section */}
            {activeSection === 'safety' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-4">Safety Limits</h3>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Max Iterations</label>
                      <input
                        type="number"
                        min="1"
                        max="100"
                        value={config.safety?.maxIterations || 10}
                        onChange={(e) => setConfig(prev => ({
                          ...prev,
                          safety: { ...prev.safety!, maxIterations: parseInt(e.target.value) }
                        }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                      <p className="text-xs text-gray-500 mt-1">Maximum number of iterations before stopping</p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Max Duration (minutes)</label>
                      <input
                        type="number"
                        min="5"
                        max="180"
                        value={config.safety?.maxDuration || 60}
                        onChange={(e) => setConfig(prev => ({
                          ...prev,
                          safety: { ...prev.safety!, maxDuration: parseInt(e.target.value) }
                        }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                      <p className="text-xs text-gray-500 mt-1">Maximum runtime before stopping</p>
                    </div>

                    <div>
                      <label className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={config.safety?.rollbackOnFailure}
                          onChange={(e) => setConfig(prev => ({
                            ...prev,
                            safety: { ...prev.safety!, rollbackOnFailure: e.target.checked }
                          }))}
                          className="rounded border-gray-300 text-primary focus:ring-primary"
                        />
                        <span className="text-sm text-gray-700">Rollback on failure</span>
                      </label>
                    </div>

                    <div>
                      <label className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={config.safety?.createBackupBranch}
                          onChange={(e) => setConfig(prev => ({
                            ...prev,
                            safety: { ...prev.safety!, createBackupBranch: e.target.checked }
                          }))}
                          className="rounded border-gray-300 text-primary focus:ring-primary"
                        />
                        <span className="text-sm text-gray-700">Create backup branch</span>
                      </label>
                      <p className="text-xs text-gray-500 mt-1 ml-6">
                        Creates a backup branch before each iteration
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Notifications Section */}
            {activeSection === 'notifications' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-4">Notifications</h3>

                  <div className="space-y-4">
                    <div>
                      <label className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={config.notifications?.enabled}
                          onChange={(e) => setConfig(prev => ({
                            ...prev,
                            notifications: { ...prev.notifications!, enabled: e.target.checked }
                          }))}
                          className="rounded border-gray-300 text-primary focus:ring-primary"
                        />
                        <span className="text-sm text-gray-700">Enable notifications</span>
                      </label>
                    </div>

                    <div>
                      <label className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={config.notifications?.onIteration}
                          onChange={(e) => setConfig(prev => ({
                            ...prev,
                            notifications: { ...prev.notifications!, onIteration: e.target.checked }
                          }))}
                          className="rounded border-gray-300 text-primary focus:ring-primary"
                        />
                        <span className="text-sm text-gray-700">Notify on each iteration</span>
                      </label>
                    </div>

                    <div>
                      <label className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={config.notifications?.onError}
                          onChange={(e) => setConfig(prev => ({
                            ...prev,
                            notifications: { ...prev.notifications!, onError: e.target.checked }
                          }))}
                          className="rounded border-gray-300 text-primary focus:ring-primary"
                        />
                        <span className="text-sm text-gray-700">Notify on errors</span>
                      </label>
                    </div>

                    <div>
                      <label className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={config.notifications?.onComplete}
                          onChange={(e) => setConfig(prev => ({
                            ...prev,
                            notifications: { ...prev.notifications!, onComplete: e.target.checked }
                          }))}
                          className="rounded border-gray-300 text-primary focus:ring-primary"
                        />
                        <span className="text-sm text-gray-700">Notify on completion</span>
                      </label>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Webhook URL</label>
                      <input
                        type="url"
                        value={config.notifications?.webhookUrl || ''}
                        onChange={(e) => setConfig(prev => ({
                          ...prev,
                          notifications: { ...prev.notifications!, webhookUrl: e.target.value }
                        }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                        placeholder="https://hooks.slack.com/services/..."
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Save Button */}
          <div className="mt-6 flex justify-end gap-3">
            <button
              onClick={onCancel}
              className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="flex items-center gap-2 px-6 py-2 bg-primary text-white font-medium rounded-lg hover:bg-primary/90 transition-colors"
            >
              <CheckCircle className="w-4 h-4" />
              Save Configuration
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
