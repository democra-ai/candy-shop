import { useState } from 'react';
import { ArrowLeft, Plus, X, Shield, Cloud, Globe } from 'lucide-react';
import type { Skill, SkillCategory } from '../../types/skill-creator';

type ExecutionTier = 'open' | 'managed' | 'tee';
type TeeProvider = 'phala' | 'aws-nitro' | 'gcp-cs' | 'azure-cc' | 'oasis';

const TIER_OPTIONS: Array<{ value: ExecutionTier; label: string; subtitle: string; icon: React.ReactNode; ring: string }> = [
  { value: 'open',    label: 'Open',    subtitle: 'Source public — user runs locally. Free.',                          icon: <Globe className="w-4 h-4" />,  ring: 'ring-emerald-500' },
  { value: 'managed', label: 'Managed', subtitle: 'We run it. Prompt hidden from users.',                               icon: <Cloud className="w-4 h-4" />,  ring: 'ring-blue-500' },
  { value: 'tee',     label: 'TEE',     subtitle: 'Runs in a confidential enclave. Prompt hidden from everyone.',      icon: <Shield className="w-4 h-4" />, ring: 'ring-fuchsia-500' },
];

const TEE_PROVIDERS: Array<{ value: TeeProvider; label: string }> = [
  { value: 'phala',     label: 'Phala Cloud (recommended)' },
  { value: 'aws-nitro', label: 'AWS Nitro Enclaves' },
  { value: 'gcp-cs',    label: 'GCP Confidential Space' },
  { value: 'azure-cc',  label: 'Azure Confidential Computing' },
  { value: 'oasis',     label: 'Oasis Network' },
];

interface ManualSkillFormProps {
  onSave: (skill: Partial<Skill>) => void;
  onCancel: () => void;
}

const CATEGORIES: SkillCategory[] = [
  'Knowledge',
  'Tools',
  'Productivity',
  'Development',
  'Analysis',
  'Custom',
];
const ICONS = ['✨', '🚀', '🎯', '💡', '🔧', '📚', '🎨', '⚡', '🌟', '🎭'];

export function ManualSkillForm({ onSave, onCancel }: ManualSkillFormProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<SkillCategory>('Custom');
  const [icon, setIcon] = useState('✨');
  const [systemPrompt, setSystemPrompt] = useState('');
  const [capabilities, setCapabilities] = useState<string[]>([]);
  const [newCapability, setNewCapability] = useState('');
  const [executionTier, setExecutionTier] = useState<ExecutionTier>('open');
  const [teeProvider, setTeeProvider] = useState<TeeProvider>('phala');
  const [teeEndpoint, setTeeEndpoint] = useState('');
  const [teeCodeHash, setTeeCodeHash] = useState('');
  const [teeAttestationUrl, setTeeAttestationUrl] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!name.trim()) {
      newErrors.name = 'Skill name is required';
    }
    if (!description.trim()) {
      newErrors.description = 'Description is required';
    }
    if (!systemPrompt.trim()) {
      newErrors.systemPrompt = 'System prompt is required';
    }
    if (capabilities.length === 0) {
      newErrors.capabilities = 'At least one capability is required';
    }

    if (executionTier === 'tee') {
      // Endpoint & codeHash can be filled in after deploy, so only require provider.
      // But if an endpoint is present, require a valid URL.
      if (teeEndpoint.trim() && !/^https?:\/\//.test(teeEndpoint.trim())) {
        newErrors.teeEndpoint = 'Endpoint must start with http:// or https://';
      }
      if (teeCodeHash.trim() && !/^[0-9a-f]{64}$/i.test(teeCodeHash.trim())) {
        newErrors.teeCodeHash = 'Code hash must be a 64-char sha256 hex string';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleAddCapability = () => {
    if (newCapability.trim() && !capabilities.includes(newCapability.trim())) {
      setCapabilities([...capabilities, newCapability.trim()]);
      setNewCapability('');
    }
  };

  const handleRemoveCapability = (index: number) => {
    setCapabilities(capabilities.filter((_, i) => i !== index));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    const skill: Partial<Skill> = {
      id: `skill-${Date.now()}`,
      name,
      description,
      category,
      icon,
      color: 'bg-primary/10 border-primary/20 text-primary',
      tags: [category],
      executionModel: executionTier,
      ...(executionTier === 'tee' && {
        teeConfig: {
          provider: teeProvider,
          endpoint: teeEndpoint.trim() || undefined,
          codeHash: teeCodeHash.trim() || undefined,
          attestationUrl: teeAttestationUrl.trim() || undefined,
        },
      }),
      config: {
        capabilities,
        systemPrompt,
        parameters: {},
      },
      sourceFiles: [],
      analysisContext: {
        workDomain: [],
        technicalSkills: [],
        experiencePatterns: [],
        keyTopics: [],
        suggestedName: name,
        suggestedDescription: description,
        suggestedCategory: category,
        suggestedCapabilities: capabilities,
        filesSummary: [],
        confidence: 100,
        systemPrompt,
      },
      installCommand: `skill install ${name.toLowerCase().replace(/\s+/g, '-')}`,
      popularity: 0,
      status: 'draft',
      isPublic: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    onSave(skill);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <button
          onClick={onCancel}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors mb-4"
        >
          <ArrowLeft className="w-5 h-5" />
          Back
        </button>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Create Skill Manually</h1>
        <p className="text-gray-600">Enter all the details for your new skill</p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-xl p-8 space-y-6">
        {/* Name */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Skill Name *</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Code Reviewer, Data Analyzer"
            className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring ${
              errors.name ? 'border-red-500' : 'border-gray-300'
            }`}
          />
          {errors.name && <p className="text-sm text-red-600 mt-1">{errors.name}</p>}
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Description *</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe what this skill does..."
            rows={3}
            className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring resize-none ${
              errors.description ? 'border-red-500' : 'border-gray-300'
            }`}
          />
          {errors.description && <p className="text-sm text-red-600 mt-1">{errors.description}</p>}
        </div>

        {/* Category and Icon */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as SkillCategory)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Icon</label>
            <select
              value={icon}
              onChange={(e) => setIcon(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {ICONS.map((ico) => (
                <option key={ico} value={ico}>
                  {ico}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* System Prompt */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">System Prompt *</label>
          <textarea
            value={systemPrompt}
            onChange={(e) => setSystemPrompt(e.target.value)}
            placeholder="Define how this skill should behave and respond..."
            rows={4}
            className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring resize-none ${
              errors.systemPrompt ? 'border-red-500' : 'border-gray-300'
            }`}
          />
          {errors.systemPrompt && (
            <p className="text-sm text-red-600 mt-1">{errors.systemPrompt}</p>
          )}
        </div>

        {/* Capabilities */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Capabilities *{' '}
            {capabilities.length > 0 && (
              <span className="text-gray-500">({capabilities.length})</span>
            )}
          </label>

          {/* Add capability input */}
          <div className="flex gap-2 mb-3">
            <input
              type="text"
              value={newCapability}
              onChange={(e) => setNewCapability(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddCapability();
                }
              }}
              placeholder="Enter a capability and press Enter"
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <button
              type="button"
              onClick={handleAddCapability}
              className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Add
            </button>
          </div>

          {/* Capabilities list */}
          {capabilities.length > 0 && (
            <div className="space-y-2">
              {capabilities.map((cap, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between bg-gray-50 p-3 rounded-lg border border-gray-200"
                >
                  <span className="text-sm text-gray-700">{cap}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveCapability(index)}
                    className="text-gray-400 hover:text-red-600 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {errors.capabilities && (
            <p className="text-sm text-red-600 mt-1">{errors.capabilities}</p>
          )}
        </div>

        {/* Privacy Tier */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Privacy Tier</label>
          <p className="text-xs text-gray-500 mb-3">
            Controls who can see your skill's system prompt after publishing.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            {TIER_OPTIONS.map((opt) => {
              const selected = executionTier === opt.value;
              return (
                <button
                  type="button"
                  key={opt.value}
                  onClick={() => setExecutionTier(opt.value)}
                  className={`text-left p-3 border rounded-lg transition-all ${
                    selected
                      ? `border-transparent ring-2 ${opt.ring} bg-gray-50`
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1 font-medium text-gray-900">
                    {opt.icon}
                    <span>{opt.label}</span>
                  </div>
                  <p className="text-xs text-gray-500 leading-snug">{opt.subtitle}</p>
                </button>
              );
            })}
          </div>

          {executionTier === 'tee' && (
            <div className="mt-4 p-4 rounded-lg border border-fuchsia-200 bg-fuchsia-50/50 space-y-4">
              <div className="flex items-start gap-2 text-xs text-fuchsia-900">
                <Shield className="w-4 h-4 mt-0.5 shrink-0" />
                <p>
                  Your prompt will be baked into a sealed Docker image and deployed to a TEE.
                  Use <code className="px-1 py-0.5 bg-white rounded border">tee-template/</code> to
                  build & deploy, then paste the deployment details below.
                  Endpoint and code hash can be left blank now and filled in after deploy.
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">TEE Provider</label>
                <select
                  value={teeProvider}
                  onChange={(e) => setTeeProvider(e.target.value as TeeProvider)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  {TEE_PROVIDERS.map((p) => (
                    <option key={p.value} value={p.value}>{p.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Endpoint URL <span className="text-gray-400">(optional — set after deploy)</span>
                </label>
                <input
                  type="text"
                  value={teeEndpoint}
                  onChange={(e) => setTeeEndpoint(e.target.value)}
                  placeholder="https://<your-cvm>.phala.network"
                  className={`w-full px-3 py-2 text-sm font-mono border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring ${
                    errors.teeEndpoint ? 'border-red-500' : 'border-gray-300'
                  }`}
                />
                {errors.teeEndpoint && <p className="text-xs text-red-600 mt-1">{errors.teeEndpoint}</p>}
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Code hash <span className="text-gray-400">(sha256 from <code>docker run ... cat /app/code_hash.txt</code>)</span>
                </label>
                <input
                  type="text"
                  value={teeCodeHash}
                  onChange={(e) => setTeeCodeHash(e.target.value)}
                  placeholder="e.g. 3a7b…"
                  className={`w-full px-3 py-2 text-sm font-mono border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring ${
                    errors.teeCodeHash ? 'border-red-500' : 'border-gray-300'
                  }`}
                />
                {errors.teeCodeHash && <p className="text-xs text-red-600 mt-1">{errors.teeCodeHash}</p>}
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Attestation URL <span className="text-gray-400">(optional — for public verification)</span>
                </label>
                <input
                  type="text"
                  value={teeAttestationUrl}
                  onChange={(e) => setTeeAttestationUrl(e.target.value)}
                  placeholder="https://<your-cvm>.phala.network/attestation"
                  className="w-full px-3 py-2 text-sm font-mono border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-4">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="flex-1 px-6 py-3 bg-gradient-to-r from-primary to-primary-active text-white font-medium rounded-lg hover:from-primary-hover hover:to-primary-active transition-all"
          >
            Create Skill
          </button>
        </div>
      </form>
    </div>
  );
}
