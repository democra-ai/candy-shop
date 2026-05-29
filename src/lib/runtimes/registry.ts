/**
 * Runtime registry — the execution-dispatch abstraction for the multi-format
 * marketplace (Phase 1).
 *
 * Each `ItemFormat` maps to a `RuntimeDescriptor` that says how to label it,
 * which candy flavor accent carries its color, and — crucially — which runner
 * executes it:
 *
 *   runner: 'cc-sandbox'   → the existing Claude Code / Workers AI / OpenCode
 *                            flow (cf-cc / cf-ai / opencode). Unchanged.
 *   runner: 'coming-soon'  → execution engine not built yet. The run page shows
 *                            a clean "import / execution coming soon" panel with
 *                            the format identity, an `importHint`, and links to
 *                            the artifact + docs.
 *
 * Only the `accentFlavor` names must exist in `candyShells.ts` (`Flavor`).
 */

import type { ItemFormat, Skill } from '../../data/skillsData';
import { getFormat } from '../../data/skillsData';
import type { Flavor } from '../../utils/candyShells';

/** Where (and whether) an item of a given format actually executes.
 *
 *   runner: 'langgraph-sandbox' → the LangGraph/LangChain execution runtime
 *                                 (cf-langgraph worker + Python container +
 *                                 Workers-AI OpenAI shim). Streams graph output.
 *   runner: 'n8n-sandbox'       → the n8n workflow execution runtime (cf-n8n
 *                                 worker + n8n CLI container). Imports the
 *                                 workflow + runs it headless, streaming
 *                                 node-by-node execution + the run result.
 */
export type RuntimeRunner = 'cc-sandbox' | 'langgraph-sandbox' | 'n8n-sandbox' | 'coming-soon';

export interface RuntimeDescriptor {
  /** The format this descriptor describes. */
  format: ItemFormat;
  /** Full human label, e.g. "n8n Workflow". */
  label: string;
  /** Compact label for chips / segmented controls, e.g. "n8n". */
  shortLabel: string;
  /** Candy flavor that carries this format's accent color (see candyShells). */
  accentFlavor: Flavor;
  /** Execution runner: the live cc-sandbox flow, or a "coming soon" panel. */
  runner: RuntimeRunner;
  /** One-line guidance shown on the coming-soon panel (how to run it today). */
  importHint?: string;
  /** External docs / homepage for the format's tooling. */
  docsUrl?: string;
}

export const RUNTIME_REGISTRY: Record<ItemFormat, RuntimeDescriptor> = {
  'claude-skill': {
    format: 'claude-skill',
    label: 'Claude Skill',
    shortLabel: 'Skill',
    accentFlavor: 'Raspberry',
    runner: 'cc-sandbox',
  },
  n8n: {
    format: 'n8n',
    label: 'n8n Workflow',
    shortLabel: 'n8n',
    accentFlavor: 'Mint',
    // Phase 2b: real execution runtime. Imports the workflow JSON into a
    // headless n8n CLI running in a Cloudflare container sandbox and executes
    // it once (`import:workflow` + `execute --id --rawOutput`), streaming
    // node-by-node execution + the run result into the transcript.
    runner: 'n8n-sandbox',
    importHint: 'Run this workflow headless (n8n CLI)',
    docsUrl: 'https://n8n.io',
  },
  dify: {
    format: 'dify',
    label: 'Dify App',
    shortLabel: 'Dify',
    accentFlavor: 'Blueberry',
    runner: 'coming-soon',
    importHint: 'Import this DSL into Dify',
    docsUrl: 'https://dify.ai',
  },
  langgraph: {
    format: 'langgraph',
    label: 'LangGraph',
    shortLabel: 'LangGraph',
    accentFlavor: 'Grape',
    // Phase 2a: real execution runtime. Runs the graph in a Cloudflare
    // container sandbox; the graph's LLM calls go through a Workers-AI-backed
    // OpenAI shim, and streamed steps render in the transcript.
    runner: 'langgraph-sandbox',
    importHint: 'Run with LangGraph (Python)',
    docsUrl: 'https://langchain-ai.github.io/langgraph/',
  },
  workflow: {
    format: 'workflow',
    label: 'Workflow',
    shortLabel: 'Workflow',
    accentFlavor: 'Caramel',
    runner: 'coming-soon',
  },
};

/** Resolve a format to its runtime descriptor (always defined). */
export function getRuntime(format: ItemFormat): RuntimeDescriptor {
  return RUNTIME_REGISTRY[format] ?? RUNTIME_REGISTRY['claude-skill'];
}

// Re-export getFormat from the data layer so callers can do the common
// `getRuntime(getFormat(skill))` chain from a single import.
export { getFormat };

/** Convenience: resolve a skill (or anything with an optional `format`)
 *  straight to its runtime descriptor. */
export function getRuntimeForSkill(skill: Pick<Skill, 'format'>): RuntimeDescriptor {
  return getRuntime(getFormat(skill));
}
