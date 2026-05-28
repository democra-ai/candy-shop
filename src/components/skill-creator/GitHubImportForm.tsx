import { useState } from 'react';
import { Github, Loader2 } from 'lucide-react';
import type { Skill } from '../../types/skill-creator';
import { CreatorHeader } from './CreatorHeader';
import { getCandyIcon } from '../illustrations';
import { getFlavor } from '../../utils/candyShells';
import { useIsDark } from '../../hooks/useIsDark';

interface GitHubImportFormProps {
  onImport: (skill: Partial<Skill>) => void;
  onCancel: () => void;
}

interface SkillMarkdown {
  name: string;
  description: string;
  category: string;
  icon: string;
  systemPrompt: string;
  capabilities: string[];
}

export function GitHubImportForm({ onImport, onCancel }: GitHubImportFormProps) {
  const isDark = useIsDark();
  const [githubUrl, setGithubUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<SkillMarkdown | null>(null);

  const parseSkillMarkdown = (content: string): SkillMarkdown => {
    const lines = content.split('\n');
    const result: SkillMarkdown = {
      name: '',
      description: '',
      category: 'Custom',
      icon: '✨',
      systemPrompt: '',
      capabilities: [],
    };

    let currentSection = '';
    let currentContent = '';

    for (const line of lines) {
      if (line.startsWith('# ')) {
        result.name = line.replace('# ', '').trim();
      } else if (line.startsWith('## ')) {
        if (currentSection === 'description') {
          result.description = currentContent.trim();
        } else if (currentSection === 'systemPrompt') {
          result.systemPrompt = currentContent.trim();
        } else if (currentSection === 'capabilities') {
          result.capabilities = currentContent
            .split('\n')
            .filter((l) => l.trim().startsWith('-'))
            .map((l) => l.replace('-', '').trim())
            .filter((l) => l.length > 0);
        }

        currentSection = line.replace('## ', '').toLowerCase().trim();
        currentContent = '';
      } else if (line.includes('category:')) {
        result.category = line.split(':')[1].trim();
      } else if (line.includes('icon:')) {
        result.icon = line.split(':')[1].trim();
      } else {
        currentContent += line + '\n';
      }
    }

    // Handle last section
    if (currentSection === 'systemPrompt') {
      result.systemPrompt = currentContent.trim();
    } else if (currentSection === 'capabilities') {
      result.capabilities = currentContent
        .split('\n')
        .filter((l) => l.trim().startsWith('-'))
        .map((l) => l.replace('-', '').trim())
        .filter((l) => l.length > 0);
    }

    return result;
  };

  const handleImport = async () => {
    setError(null);
    setIsLoading(true);

    try {
      // Parse GitHub URL
      const urlPattern = /github\.com\/([^/]+)\/([^/]+)(?:\/tree\/([^/]+))?/;
      const match = githubUrl.match(urlPattern);

      if (!match) {
        throw new Error(
          'Invalid GitHub URL. Please use format: https://github.com/owner/repo or https://github.com/owner/repo/tree/branch'
        );
      }

      const [, owner, repo, branch = 'main'] = match;

      // Fetch skill.md from GitHub
      const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/skill.md`;

      const response = await fetch(rawUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch skill.md. Make sure the file exists at ${rawUrl}`);
      }

      const content = await response.text();
      const skillData = parseSkillMarkdown(content);

      if (!skillData.name) {
        throw new Error('Invalid skill.md format. Please ensure it has a title (# Skill Name)');
      }

      setPreview(skillData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to import skill');
      setPreview(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmImport = () => {
    if (!preview) return;

    const skill: Partial<Skill> = {
      id: `skill-${Date.now()}`,
      name: preview.name,
      description: preview.description,
      category: preview.category as any,
      icon: preview.icon,
      color: 'bg-primary/10 border-primary/20 text-primary',
      tags: [preview.category as any],
      config: {
        capabilities: preview.capabilities,
        systemPrompt: preview.systemPrompt,
        parameters: {},
      },
      sourceFiles: [githubUrl],
      analysisContext: {
        workDomain: [],
        technicalSkills: [],
        experiencePatterns: [],
        keyTopics: [],
        suggestedName: preview.name,
        suggestedDescription: preview.description,
        suggestedCategory: preview.category as any,
        suggestedCapabilities: preview.capabilities,
        filesSummary: [],
        confidence: 100,
        systemPrompt: preview.systemPrompt,
      },
      installCommand: `skill install ${preview.name.toLowerCase().replace(/\s+/g, '-')}`,
      popularity: 0,
      status: 'draft',
      isPublic: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    onImport(skill);
  };

  return (
    <div className="space-y-6">
      <CreatorHeader
        eyebrow="import"
        title="Import from GitHub"
        subtitle="Pull a skill from a repo that ships a skill.md file."
        onBack={onCancel}
      />

      {/* Import Form */}
      {!preview && (
        <div className="bg-card rounded-3xl shadow-candy-1 border border-border p-6 md:p-8 space-y-6">
          {/* URL Input */}
          <div>
            <label className="block text-sm font-medium text-foreground-secondary mb-2">
              GitHub repository URL
            </label>
            <input
              type="text"
              value={githubUrl}
              onChange={(e) => setGithubUrl(e.target.value)}
              placeholder="https://github.com/owner/repo or .../tree/branch"
              className="w-full h-10 px-3 bg-input border border-input-border rounded-xl text-sm text-foreground placeholder:text-foreground-tertiary focus:outline-none focus:ring-2 focus:ring-ring transition-colors"
            />
            <p className="text-xs text-foreground-tertiary mt-2">
              The repo must contain a skill.md file in the root or specified branch.
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-4 bg-error/10 border border-error/30 rounded-xl">
              <p className="text-sm text-error">{error}</p>
            </div>
          )}

          {/* Example */}
          <div className="p-4 bg-secondary rounded-xl border border-border">
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-foreground-tertiary mb-2">
              example skill.md
            </p>
            <pre className="text-xs text-foreground-secondary font-mono overflow-x-auto">
              {`# Code Reviewer
category: Development
icon: 👀

## Description
Reviews code for quality and best practices

## System Prompt
You are an expert code reviewer...

## Capabilities
- Code analysis
- Performance review
- Security audit`}
            </pre>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              onClick={onCancel}
              className="flex-1 h-10 px-5 rounded-2xl border border-border bg-card text-foreground font-semibold hover:border-border-hover hover:shadow-candy-1 transition-all"
            >
              Cancel
            </button>
            <button
              onClick={handleImport}
              disabled={!githubUrl.trim() || isLoading}
              className="candy-btn btn-press flex-1 h-10 px-5 rounded-2xl font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Importing…
                </>
              ) : (
                <>
                  <Github className="w-4 h-4" />
                  Import skill
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Preview */}
      {preview && (
        <div className="bg-card rounded-3xl shadow-candy-1 border border-border p-6 md:p-8 space-y-6">
          <div className="flex items-start gap-4">
            {(() => {
              const f = getFlavor(preview.category, isDark);
              const Candy = getCandyIcon(preview.category, isDark);
              return (
                <div className="flex items-center justify-center w-14 h-14 rounded-2xl shrink-0" style={{ background: f.tint }} aria-hidden="true">
                  <Candy size={36} color={f.base} />
                </div>
              );
            })()}
            <div className="flex-1 min-w-0">
              <h2 className="font-candy text-2xl font-bold text-foreground">{preview.name}</h2>
              <span className="inline-flex items-center mt-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-mono uppercase tracking-wider bg-secondary text-foreground-secondary">
                {preview.category}
              </span>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-medium text-foreground-secondary mb-2">Description</h3>
            <p className="text-sm text-foreground-secondary leading-relaxed">{preview.description}</p>
          </div>

          <div>
            <h3 className="text-sm font-medium text-foreground-secondary mb-2">System prompt</h3>
            <p className="text-sm text-foreground-secondary bg-secondary p-3 rounded-xl border border-border whitespace-pre-wrap font-mono">
              {preview.systemPrompt}
            </p>
          </div>

          {preview.capabilities.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-foreground-secondary mb-2">Capabilities</h3>
              <div className="flex flex-wrap gap-2">
                {preview.capabilities.map((cap, index) => (
                  <span
                    key={index}
                    className="px-2.5 py-0.5 bg-primary/10 text-primary text-[13px] rounded-full font-mono"
                  >
                    {cap}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              onClick={() => {
                setPreview(null);
                setError(null);
              }}
              className="flex-1 h-10 px-5 rounded-2xl border border-border bg-card text-foreground font-semibold hover:border-border-hover hover:shadow-candy-1 transition-all"
            >
              Back
            </button>
            <button
              onClick={handleConfirmImport}
              className="candy-btn btn-press flex-1 h-10 px-5 rounded-2xl font-semibold"
            >
              Confirm import
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
