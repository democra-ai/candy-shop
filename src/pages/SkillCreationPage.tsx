import { useState } from 'react';
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
    <div className="space-y-6">
      {/* Feedback Messages */}
      {feedback && (
        <div className={`p-4 rounded-lg ${feedback.type === 'success' ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
          <p className={`text-sm ${feedback.type === 'success' ? 'text-green-800' : 'text-red-800'}`}>
            {feedback.message}
          </p>
        </div>
      )}

      {/* Method Selection */}
      {method === 'select' && (
        <div>
          <button
            onClick={onCancel}
            className="flex items-center gap-2 text-foreground-secondary hover:text-foreground transition-colors mb-6"
          >
            ← Back
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
        <div className="h-[calc(100vh-12rem)] bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="flex items-center justify-center h-full text-gray-500">
            Workflow Builder Coming Soon
          </div>
        </div>
      )}

      {/* Preview */}
      {method === 'preview' && skillToPreview && (
        <div className="space-y-6">
          <button
            onClick={handleBack}
            className="flex items-center gap-2 text-foreground-secondary hover:text-foreground transition-colors"
          >
            ← Back
          </button>
          <div className="bg-card rounded-2xl shadow-xl border border-border p-8">
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
        <div className="bg-card rounded-2xl shadow-xl border border-border p-8">
          <div className="text-center py-12">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <span className="text-4xl">✨</span>
            </div>
            <h2 className="text-2xl font-bold text-foreground mb-2">
              Skill Created Successfully!
            </h2>
            <p className="text-foreground-secondary">
              Redirecting to skills library...
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
