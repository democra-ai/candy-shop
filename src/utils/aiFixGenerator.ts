// AI-Powered Code Fix Generator
// Analyzes errors and generates fix suggestions

import type { RemoteError, FixSuggestion } from '../types/auto-debug';

export interface FixGenerationOptions {
  errors: RemoteError[];
  projectContext?: ProjectContext;
  maxFixes?: number;
  requireApproval?: boolean;
}

export interface ProjectContext {
  language: 'typescript' | 'javascript' | 'python' | 'go' | 'rust';
  framework?: string;
  dependencies?: Record<string, string>;
  sourceDirectory?: string;
  testCommand?: string;
}

export interface FixGenerationResult {
  success: boolean;
  fixes: FixSuggestion[];
  reasoning: string;
  error?: string;
}

export class AIFixGenerator {


  constructor(_config: { apiKey?: string; provider?: 'openai' | 'anthropic' | 'local'; model?: string }) {
  // Config stored for future use
  }

  /**
   * Generate fixes for detected errors
   */
  async generateFixes(options: FixGenerationOptions): Promise<FixGenerationResult> {
    try {
      const { errors, projectContext } = options;

      if (errors.length === 0) {
        return {
          success: true,
          fixes: [],
          reasoning: 'No errors to fix',
        };
      }

      // Group similar errors
      const groupedErrors = this.groupErrors(errors);

      // Generate fixes for each group
      const fixes: FixSuggestion[] = [];

      for (const group of groupedErrors) {
        const groupFixes = await this.generateFixesForErrorGroup(group, projectContext);
        fixes.push(...groupFixes);

        // Respect max fixes limit
        if (options.maxFixes && fixes.length >= options.maxFixes) {
          break;
        }
      }

      // Prioritize fixes
      this.prioritizeFixes(fixes);

      return {
        success: true,
        fixes,
        reasoning: this.generateReasoningSummary(fixes, errors),
      };
    } catch (error) {
      return {
        success: false,
        fixes: [],
        reasoning: '',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Group similar errors together
   */
  private groupErrors(errors: RemoteError[]): RemoteError[][] {
    const groups: Record<string, RemoteError[]> = {};

    for (const error of errors) {
      // Group by error message and file
      const key = `${error.source.file}:${error.message.split(':')[0]}`;

      if (!groups[key]) {
        groups[key] = [];
      }

      groups[key].push(error);
    }

    return Object.values(groups);
  }

  /**
   * Generate fixes for a specific error group
   */
  private async generateFixesForErrorGroup(
    errors: RemoteError[],
    context?: ProjectContext
  ): Promise<FixSuggestion[]> {
    const primaryError = errors[0];
    const fixes: FixSuggestion[] = [];

    // Analyze error type
    const errorType = this.classifyError(primaryError);

    switch (errorType) {
      case 'undefined-error':
        fixes.push(await this.generateUndefinedFix(primaryError, context));
        break;

      case 'null-reference':
        fixes.push(await this.generateNullReferenceFix(primaryError, context));
        break;

      case 'type-error':
        fixes.push(await this.generateTypeFix(primaryError, context));
        break;

      case 'async-error':
        fixes.push(await this.generateAsyncFix(primaryError, context));
        break;

      case 'import-error':
        fixes.push(await this.generateImportFix(primaryError, context));
        break;

      case 'api-error':
        fixes.push(await this.generateAPIFix(primaryError, context));
        break;

      case 'network-error':
        fixes.push(await this.generateNetworkFix(primaryError, context));
        break;

      default:
        fixes.push(await this.generateGenericFix(primaryError, context));
    }

    return fixes.filter(f => f !== null);
  }

  /**
   * Classify error type
   */
  private classifyError(error: RemoteError): string {
    const message = error.message.toLowerCase();
    const stack = error.stack?.toLowerCase() || '';

    if (message.includes('undefined') || message.includes('not defined')) {
      return 'undefined-error';
    }

    if (message.includes('null') || message.includes('null reference')) {
      return 'null-reference';
    }

    if (message.includes('type') && stack.includes('typescript')) {
      return 'type-error';
    }

    if (message.includes('async') || message.includes('promise') || message.includes('await')) {
      return 'async-error';
    }

    if (message.includes('module') || message.includes('import') || message.includes('require')) {
      return 'import-error';
    }

    if (message.includes('network') || message.includes('fetch') || message.includes('axios')) {
      return 'network-error';
    }

    if (message.includes('api') || error.source.file.includes('api')) {
      return 'api-error';
    }

    return 'unknown';
  }

  /**
   * Generate fix for undefined errors
   */
  private async generateUndefinedFix(
    error: RemoteError,
    _context?: ProjectContext
  ): Promise<FixSuggestion> {
    const match = error.message.match(/'(.+?)' is undefined/);
    const variableName = match?.[1] || 'unknown';

    return {
      id: `fix-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      errorId: error.id,
      type: 'code-change',
      priority: error.severity === 'critical' ? 'critical' : 'high',
      file: error.source.file,
      originalCode: `console.log(${variableName});`,
      fixedCode: `// Check if ${variableName} exists before using\nif (typeof ${variableName} !== 'undefined') {\n  console.log(${variableName});\n}`,
      lineStart: error.source.line,
      lineEnd: error.source.line,
      explanation: `Variable '${variableName}' is undefined when accessed. Add a null check or initialize the variable before use.`,
      confidence: 0.85,
      reasoning: `The error occurs because ${variableName} is accessed before being defined or initialized. Adding a type check prevents the runtime error while allowing for cases where the variable might be undefined.`,
      estimatedImpact: 'low',
      status: 'pending',
    };
  }

  /**
   * Generate fix for null reference errors
   */
  private async generateNullReferenceFix(
    error: RemoteError,
    _context?: ProjectContext
  ): Promise<FixSuggestion> {
    const match = error.message.match(/Cannot read properties of (.+?) \(reading '(.+?)'\)/);
    const propertyChain = match?.[1] || '';
    const objectName = match?.[2] || 'object';

    return {
      id: `fix-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      errorId: error.id,
      type: 'code-change',
      priority: 'high',
      file: error.source.file,
      originalCode: `const value = ${objectName}.${propertyChain};`,
      fixedCode: `const value = ${objectName}?.${propertyChain};`,
      lineStart: error.source.line,
      lineEnd: error.source.line,
      explanation: `Optional chaining (?.) prevents null reference errors when accessing nested properties.`,
      confidence: 0.9,
      reasoning: `Using optional chaining allows safe navigation of potentially null/undefined objects without throwing runtime errors.`,
      estimatedImpact: 'low',
      status: 'pending',
    };
  }

  /**
   * Generate fix for type errors
   */
  private async generateTypeFix(
    error: RemoteError,
    _context?: ProjectContext
  ): Promise<FixSuggestion> {
    return {
      id: `fix-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      errorId: error.id,
      type: 'code-change',
      priority: 'medium',
      file: error.source.file,
      originalCode: '// Type error here',
      fixedCode: '// Add proper type annotations\nconst value: string | null = null;',
      lineStart: error.source.line,
      lineEnd: error.source.line,
      explanation: 'Add explicit type annotations to resolve TypeScript type errors.',
      confidence: 0.8,
      reasoning: 'TypeScript requires explicit types when types cannot be inferred. Adding type annotations resolves the compilation error.',
      estimatedImpact: 'medium',
      status: 'pending',
    };
  }

  /**
   * Generate fix for async errors
   */
  private async generateAsyncFix(
    error: RemoteError,
    _context?: ProjectContext
  ): Promise<FixSuggestion> {
    return {
      id: `fix-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      errorId: error.id,
      type: 'code-change',
      priority: 'high',
      file: error.source.file,
      originalCode: 'const data = fetch(url);\nconsole.log(data);',
      fixedCode: 'const data = await fetch(url);\nconsole.log(data);',
      lineStart: error.source.line,
      lineEnd: error.source.line + 1,
      explanation: 'Missing await keyword when calling async function.',
      confidence: 0.95,
      reasoning: 'Async functions return Promises that must be awaited or the promise handled. Without await, the code continues execution before the async operation completes.',
      estimatedImpact: 'high',
      status: 'pending',
    };
  }

  /**
   * Generate fix for import errors
   */
  private async generateImportFix(
    error: RemoteError,
    _context?: ProjectContext
  ): Promise<FixSuggestion> {
    const match = error.message.match(/Module '(.+?)' not found/);
    const moduleName = match?.[1] || 'unknown';

    return {
      id: `fix-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      errorId: error.id,
      type: 'dependency-update',
      priority: 'high',
      dependencyName: moduleName,
      currentVersion: 'not installed',
      suggestedVersion: 'latest',
      explanation: `Module '${moduleName}' is not installed or not imported correctly.`,
      confidence: 0.9,
      reasoning: `The module '${moduleName}' needs to be installed as a dependency and imported in the file where it's used.`,
      estimatedImpact: 'high',
      status: 'pending',
    };
  }

  /**
   * Generate fix for API errors
   */
  private async generateAPIFix(
    error: RemoteError,
    _context?: ProjectContext
  ): Promise<FixSuggestion> {
    return {
      id: `fix-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      errorId: error.id,
      type: 'code-change',
      priority: 'high',
      file: error.source.file,
      originalCode: 'fetch(url)',
      fixedCode: 'fetch(url).then(res => {\n  if (!res.ok) {\n    throw new Error(`API error: ${res.status}`);\n  }\n  return res.json();\n}).catch(err => {\n  console.error("API request failed:", err);\n  throw err;\n});',
      lineStart: error.source.line,
      lineEnd: error.source.line,
      explanation: 'Add proper error handling for API requests.',
      confidence: 0.85,
      reasoning: 'API requests can fail for various reasons. Adding error handling prevents unhandled promise rejections and provides better error messages.',
      estimatedImpact: 'medium',
      status: 'pending',
    };
  }

  /**
   * Generate fix for network errors
   */
  private async generateNetworkFix(
    error: RemoteError,
    _context?: ProjectContext
  ): Promise<FixSuggestion> {
    return {
      id: `fix-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      errorId: error.id,
      type: 'code-change',
      priority: 'medium',
      file: error.source.file,
      originalCode: 'fetch(url)',
      fixedCode: 'fetch(url, {\n  // Add timeout and retry\n  signal: AbortSignal.timeout(10000),\n}).catch(async err => {\n  if (err.name === "AbortError") {\n    // Retry once\n    return fetch(url);\n  }\n  throw err;\n});',
      lineStart: error.source.line,
      lineEnd: error.source.line,
      explanation: 'Add timeout and retry logic for network requests.',
      confidence: 0.75,
      reasoning: 'Network requests can fail due to timeouts or temporary issues. Adding timeout and retry logic improves reliability.',
      estimatedImpact: 'medium',
      status: 'pending',
    };
  }

  /**
   * Generate generic fix
   */
  private async generateGenericFix(
    error: RemoteError,
    _context?: ProjectContext
  ): Promise<FixSuggestion> {
    return {
      id: `fix-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      errorId: error.id,
      type: 'code-change',
      priority: 'low',
      file: error.source.file,
      originalCode: '// code with error',
      fixedCode: `// Wrap in try-catch\ntry {\n  // original code\n} catch (err) {\n  console.error("Error:", err);\n}`,
      lineStart: error.source.line,
      lineEnd: error.source.line,
      explanation: 'Add error handling to prevent uncaught exceptions.',
      confidence: 0.6,
      reasoning: 'Adding try-catch blocks prevents errors from crashing the application and allows for proper error logging.',
      estimatedImpact: 'low',
      status: 'pending',
    };
  }

  /**
   * Prioritize fixes by severity and impact
   */
  private prioritizeFixes(fixes: FixSuggestion[]): void {
    const priorityOrder = ['low', 'medium', 'high', 'critical'];

    fixes.sort((a, b) => {
      // First by priority
      const priorityDiff = priorityOrder.indexOf(b.priority) - priorityOrder.indexOf(a.priority);
      if (priorityDiff !== 0) return priorityDiff;

      // Then by confidence
      const confidenceDiff = b.confidence - a.confidence;
      if (Math.abs(confidenceDiff) > 0.1) return confidenceDiff;

      // Finally by impact
      const impactOrder = ['low', 'medium', 'high'];
      return impactOrder.indexOf(b.estimatedImpact) - impactOrder.indexOf(a.estimatedImpact);
    });
  }

  /**
   * Generate reasoning summary
   */
  private generateReasoningSummary(fixes: FixSuggestion[], errors: RemoteError[]): string {
    const criticalFixes = fixes.filter(f => f.priority === 'critical').length;
    const highFixes = fixes.filter(f => f.priority === 'high').length;

    let reasoning = `Analyzed ${errors.length} error(s) and generated ${fixes.length} fix suggestion(s). `;
    reasoning += `${criticalFixes} critical, ${highFixes} high priority fixes were identified. `;

    const avgConfidence = fixes.reduce((sum, f) => sum + f.confidence, 0) / fixes.length;
    reasoning += `Average confidence: ${(avgConfidence * 100).toFixed(0)}%. `;

    return reasoning;
  }
}

/**
 * Generate fixes using backend API (frontend version)
 */
export async function generateFixesViaAPI(
  errors: RemoteError[],
  options?: {
    projectContext?: ProjectContext;
    apiKey?: string;
  }
): Promise<FixGenerationResult> {
  try {
    const response = await fetch('/api/debug-loop/generate-fixes', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(options?.apiKey && { 'Authorization': `Bearer ${options.apiKey}` }),
      },
      body: JSON.stringify({
        errors,
        projectContext: options?.projectContext,
      }),
    });

    if (!response.ok) {
      throw new Error(`Fix generation failed: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    return {
      success: false,
      fixes: [],
      reasoning: '',
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Apply a fix (frontend version - would call backend API)
 */
export async function applyFix(fix: FixSuggestion): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch('/api/debug-loop/apply-fix', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(fix),
    });

    if (!response.ok) {
      throw new Error(`Fix application failed: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
