import { useState, useEffect } from 'react';
import { ArrowLeft, CheckCircle } from 'lucide-react';
import { SkillCreationMethodSelector } from '../components/skill-creator/SkillCreationMethodSelector';
import { FileUploadZone } from '../components/skill-creator/FileUploadZone';
import { AnalysisProgress } from '../components/skill-creator/AnalysisProgress';
import { SkillPreviewEditor } from '../components/skill-creator/SkillPreviewEditor';
import { WorkflowBuilder } from '../components/skill-creator/WorkflowBuilder';
import { useSkillAnalysis } from '../hooks/useSkillAnalysis';
import { storageUtils } from '../utils/storage';
import { workflowToSkill, validateWorkflow } from '../utils/workflowConverter';
import type { CreationStep, Skill, AnalysisResult } from '../types/skill-creator';
import type { Workflow } from '../types/workflow';

interface SkillCreatorPageProps {
  onComplete: () => void;
  onCancel: () => void;
  onSkillCreated?: (skill: Partial<Skill>) => void;
}

type CreationMethod = 'upload' | 'manual' | 'github' | 'workflow';

export function SkillCreatorPage({ onComplete, onCancel }: SkillCreatorPageProps) {
  const [creationMethod, setCreationMethod] = useState<CreationMethod | null>(null);
  const [step, setStep] = useState<CreationStep>('upload');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [generatedSkill, setGeneratedSkill] = useState<Partial<Skill> | null>(null);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(
    null
  );
  const [isUploading, setIsUploading] = useState(false);

  const { startAnalysis, status, result, error } = useSkillAnalysis();

  const handleFilesSelected = (files: File[]) => {
    setSelectedFiles(files);
    setFeedback(null);
  };

  const handleStartAnalysis = async () => {
    if (selectedFiles.length === 0) return;

    setStep('analyzing');
    setFeedback(null);
    setIsUploading(true);

    try {
      // For GitHub Pages, simulate file upload
      setFeedback({ type: 'success', message: 'Files prepared for analysis...' });

      // Create mock file IDs
      const mockFileIds = selectedFiles.map((_, i) => `file-${i}-${Date.now()}`);

      // Start analysis
      await startAnalysis(mockFileIds);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Analysis failed';
      setFeedback({ type: 'error', message: errorMsg });
      console.error('Analysis start error:', err);
      setIsUploading(false);
    }
  };

  // Watch for analysis completion
  useEffect(() => {
    if (result && step === 'analyzing') {
      handleAnalysisComplete(result);
    }
  }, [result, step]);

  const handleAnalysisComplete = async (analysisResult: AnalysisResult) => {
    setAnalysisResult(analysisResult);

    // Generate skill locally
    try {
      const skill: Partial<Skill> = {
        id: `skill-${Date.now()}`,
        name: analysisResult.suggestedName,
        description: analysisResult.suggestedDescription,
        category: analysisResult.suggestedCategory,
        icon: '✨',
        color: 'bg-primary/10 border-primary/20 text-primary',
        tags: [analysisResult.suggestedCategory],
        config: {
          capabilities: analysisResult.suggestedCapabilities,
          systemPrompt: analysisResult.systemPrompt,
          parameters: {},
        },
        sourceFiles: selectedFiles.map((f) => f.name),
        analysisContext: analysisResult,
        installCommand: `skill install ${analysisResult.suggestedName.toLowerCase().replace(/\s+/g, '-')}`,
        popularity: 0,
        status: 'draft',
        isPublic: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      setGeneratedSkill(skill);
      setStep('preview');
      setFeedback({ type: 'success', message: 'Skill generated successfully!' });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Skill generation failed';
      setFeedback({ type: 'error', message: errorMsg });
      console.error('Skill generation error:', err);
    }
  };

  const handleSaveSkill = async (updatedSkill: Partial<Skill>) => {
    try {
      storageUtils.saveSkill(updatedSkill);

      setStep('complete');
      setFeedback({ type: 'success', message: 'Skill saved successfully!' });
      setIsUploading(false);

      setTimeout(() => {
        onComplete();
      }, 2000);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Save failed';
      setFeedback({ type: 'error', message: errorMsg });
      console.error('Save error:', err);
      setIsUploading(false);
      throw err;
    }
  };

  const handleCancelEdit = () => {
    setStep('upload');
    setSelectedFiles([]);
    setGeneratedSkill(null);
    setAnalysisResult(null);
    setFeedback(null);
  };

  // Handle workflow save
  const handleWorkflowSave = (workflow: Workflow) => {
    try {
      const validation = validateWorkflow(workflow);
      if (!validation.valid) {
        setFeedback({ type: 'error', message: validation.errors.join(', ') });
        return;
      }

      const skill = workflowToSkill(workflow);
      storageUtils.saveSkill(skill as Skill);

      setFeedback({ type: 'success', message: 'Workflow skill saved successfully!' });
      setTimeout(() => {
        onComplete();
      }, 1500);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Save failed';
      setFeedback({ type: 'error', message: errorMsg });
      console.error('Workflow save error:', err);
    }
  };

  // Handle workflow execution
  const handleWorkflowExecute = (workflow: Workflow) => {
    const validation = validateWorkflow(workflow);
    if (!validation.valid) {
      setFeedback({ type: 'error', message: validation.errors.join(', ') });
      return;
    }

    // Convert workflow to skill and navigate to executor
    workflowToSkill(workflow);
    onComplete(); // Will trigger navigation back to skills list
  };

  // If no creation method selected, show selector
  if (!creationMethod) {
    return (
      <div className="space-y-6">
        <button
          onClick={onCancel}
          className="inline-flex items-center gap-1.5 text-sm text-foreground-secondary hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>

        <SkillCreationMethodSelector
          onSelectMethod={(method) => setCreationMethod(method as CreationMethod)}
        />
      </div>
    );
  }

  // If workflow selected, show WorkflowBuilder
  if (creationMethod === 'workflow') {
    return (
      <WorkflowBuilder
        onSave={handleWorkflowSave}
        onExecute={handleWorkflowExecute}
        onBack={() => setCreationMethod(null)}
      />
    );
  }

  // Original file upload flow
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <button
          onClick={() => {
            if (step === 'upload') {
              setCreationMethod(null);
            } else {
              onCancel();
            }
          }}
          className="inline-flex items-center gap-1.5 text-sm text-foreground-secondary hover:text-foreground transition-colors mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          {step === 'upload' ? 'Back to methods' : 'Back'}
        </button>
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-foreground-tertiary mb-1.5">
          from files
        </p>
        <h1 className="font-candy font-bold tracking-tight leading-[1.1] text-2xl md:text-3xl text-foreground mb-1.5">
          Create from your files
        </h1>
        <p className="text-sm text-foreground-secondary">
          Upload files and let AI analyse them into a custom skill.
        </p>
      </div>

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

      {/* Progress Steps */}
      <div className="mb-10">
        <div className="flex items-center justify-center gap-3 md:gap-4">
          {[
            { key: 'upload', label: 'Upload' },
            { key: 'analyzing', label: 'Analyzing' },
            { key: 'preview', label: 'Preview' },
            { key: 'complete', label: 'Complete' },
          ].map((s, index) => {
            const isActive = s.key === step;
            const isComplete = ['upload', 'analyzing', 'preview', 'complete'].indexOf(step) > index;

            return (
              <div key={s.key} className="flex items-center gap-3 md:gap-4">
                <div className="flex flex-col items-center">
                  <div
                    className={`
                      w-9 h-9 md:w-10 md:h-10 rounded-full flex items-center justify-center font-mono text-sm font-bold transition-all
                      ${isActive ? 'bg-primary text-primary-foreground scale-110' : ''}
                      ${isComplete ? 'bg-accent text-card' : ''}
                      ${!isActive && !isComplete ? 'bg-secondary text-foreground-tertiary' : ''}
                    `}
                  >
                    {isComplete ? <CheckCircle className="w-5 h-5" /> : index + 1}
                  </div>
                  <span className="text-[11px] mt-2 text-foreground-secondary">{s.label}</span>
                </div>
                {index < 3 && (
                  <div
                    className={`w-10 md:w-16 h-1 rounded-full transition-colors ${isComplete ? 'bg-accent' : 'bg-secondary'}`}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <div className="bg-card rounded-3xl shadow-candy-1 border border-border p-6 md:p-8">
        {step === 'upload' && (
          <div className="space-y-6">
            <FileUploadZone onFilesSelected={handleFilesSelected} />

            {selectedFiles.length > 0 && (
              <div className="flex justify-end">
                <button
                  onClick={handleStartAnalysis}
                  disabled={isUploading}
                  className="candy-btn btn-press h-10 px-6 font-semibold rounded-2xl disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isUploading ? 'Uploading…' : 'Start analysis'}
                </button>
              </div>
            )}
          </div>
        )}

        {step === 'analyzing' && (
          <div className="py-12">
            <AnalysisProgress
              status={status.status}
              progress={status.progress}
              currentFile={status.currentFile}
              message={status.message}
            />
            {error && (
              <div className="mt-6 p-4 bg-error/10 border border-error/30 rounded-xl">
                <p className="text-sm text-error">{error}</p>
              </div>
            )}
          </div>
        )}

        {step === 'preview' && generatedSkill && analysisResult && (
          <SkillPreviewEditor
            skill={generatedSkill}
            analysisContext={analysisResult}
            onSave={handleSaveSkill}
            onCancel={handleCancelEdit}
          />
        )}

        {step === 'complete' && (
          <div className="text-center py-12">
            <div className="flex items-center justify-center mx-auto mb-6 text-7xl leading-none" aria-hidden="true">
              🍭
            </div>
            <h2 className="font-candy text-2xl font-bold text-foreground mb-2">Fresh batch is ready!</h2>
            <p className="text-foreground-secondary">Taking you to your library…</p>
          </div>
        )}
      </div>
    </div>
  );
}
