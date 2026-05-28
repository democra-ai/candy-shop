import { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { EmptyJar, Pip } from '../components/illustrations';
import { SkillCreationMethodSelector } from '../components/skill-creator/SkillCreationMethodSelector';
import { SkillCreatorPage } from './SkillCreatorPage';
import { ManualSkillForm } from '../components/skill-creator/ManualSkillForm';
import { GitHubImportForm } from '../components/skill-creator/GitHubImportForm';
import { SkillPreviewEditor } from '../components/skill-creator/SkillPreviewEditor';
import { storageUtils } from '../utils/storage';
import type { Skill } from '../types/skill-creator';

interface SkillCreationPageProps {
  onComplete: () => void;
  onCancel: () => void;
}

type CreationMethod = 'select' | 'upload' | 'manual' | 'github' | 'workflow' | 'preview' | 'complete';

export function SkillCreationPage({ onComplete, onCancel }: SkillCreationPageProps) {
  const [method, setMethod] = useState<CreationMethod>('select');
  const [skillToPreview, setSkillToPreview] = useState<Partial<Skill> | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const handleMethodSelect = (selectedMethod: 'upload' | 'manual' | 'github' | 'workflow') => {
    setMethod(selectedMethod);
    setFeedback(null);
  };

  const handleSkillCreated = (skill: Partial<Skill>) => {
    setSkillToPreview(skill);
    setMethod('preview');
    setFeedback({ type: 'success', message: 'Skill created! Review and save it.' });
  };

  const handleSaveSkill = async (updatedSkill: Partial<Skill>) => {
    try {
      storageUtils.saveSkill(updatedSkill);
      setMethod('complete');
      setFeedback({ type: 'success', message: 'Skill saved successfully!' });

      setTimeout(() => {
        onComplete();
      }, 2000);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Save failed';
      setFeedback({ type: 'error', message: errorMsg });
      console.error('Save error:', err);
    }
  };

  const handleBack = () => {
    if (method === 'preview') {
      setSkillToPreview(null);
      setMethod('select');
    } else if (method === 'complete') {
      onCancel();
    } else {
      setMethod('select');
    }
    setFeedback(null);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 md:py-12 space-y-6">
      {/* Feedback Messages */}
      {feedback && (
        <div
          className={`p-4 rounded-xl border text-sm ${
            feedback.type === 'success'
              ? 'bg-success/10 border-success/30 text-success'
              : 'bg-error/10 border-error/30 text-error'
          }`}
        >
          {feedback.message}
        </div>
      )}

      {/* Method Selection */}
      {method === 'select' && (
        <div className="space-y-6">
          <button
            onClick={onCancel}
            className="inline-flex items-center gap-1.5 text-sm text-foreground-secondary hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to shop
          </button>
          <SkillCreationMethodSelector onSelectMethod={handleMethodSelect} />
        </div>
      )}

      {/* Upload Method */}
      {method === 'upload' && (
        <SkillCreatorPage
          onComplete={onComplete}
          onCancel={handleBack}
          onSkillCreated={handleSkillCreated}
        />
      )}

      {/* Manual Creation */}
      {method === 'manual' && (
        <ManualSkillForm
          onSave={handleSkillCreated}
          onCancel={handleBack}
        />
      )}

      {/* GitHub Import */}
      {method === 'github' && (
        <GitHubImportForm
          onImport={handleSkillCreated}
          onCancel={handleBack}
        />
      )}

      {/* Workflow Builder */}
      {method === 'workflow' && (
        <div className="space-y-6">
          <button
            onClick={handleBack}
            className="inline-flex items-center gap-1.5 text-sm text-foreground-secondary hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
          <div className="h-[calc(100vh-16rem)] bg-card rounded-3xl shadow-candy-1 border border-border overflow-hidden">
            <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-6">
              <EmptyJar size={96} />
              <p className="font-candy text-lg font-bold text-foreground">Workflow Builder</p>
              <p className="text-sm text-foreground-secondary">A fresh batch is baking — coming soon.</p>
            </div>
          </div>
        </div>
      )}

      {/* Preview */}
      {method === 'preview' && skillToPreview && (
        <div className="space-y-6">
          <button
            onClick={handleBack}
            className="inline-flex items-center gap-1.5 text-sm text-foreground-secondary hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
          <div className="bg-card rounded-3xl shadow-candy-1 border border-border p-6 md:p-8">
            <SkillPreviewEditor
              skill={skillToPreview}
              analysisContext={skillToPreview.analysisContext || {
                workDomain: [],
                technicalSkills: [],
                experiencePatterns: [],
                keyTopics: [],
                suggestedName: skillToPreview.name || '',
                suggestedDescription: skillToPreview.description || '',
                suggestedCategory: skillToPreview.category || 'Custom',
                suggestedCapabilities: [],
                filesSummary: [],
                confidence: 0,
                systemPrompt: '',
              }}
              onSave={handleSaveSkill}
              onCancel={handleBack}
            />
          </div>
        </div>
      )}

      {/* Complete */}
      {method === 'complete' && (
        <div className="bg-card rounded-3xl shadow-candy-1 border border-border p-6 md:p-8">
          <div className="text-center py-12">
            <div className="flex items-center justify-center mx-auto mb-6">
              <Pip size={104} />
            </div>
            <h2 className="font-candy text-2xl font-bold text-foreground mb-2">
              Fresh batch is ready!
            </h2>
            <p className="text-foreground-secondary">
              Wrapping it up and taking you to your library…
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
