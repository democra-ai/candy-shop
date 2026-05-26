// ============================================================
// Candy Shop Tweaks — type definitions.
// ============================================================
// Web-native analogue of codex-plusplus. A "tweak" is a small ESM
// module published in a GitHub repo, loaded at runtime from the
// jsDelivr CDN, with a manifest + start/stop lifecycle. Tweaks can
// inject UI, register a settings panel, add CSS, react to routes.
//
// codex-plusplus patches Electron's app.asar; we can't (we're a web
// app), so instead the runtime dynamically import()s each enabled
// tweak's entry module from:
//   https://cdn.jsdelivr.net/gh/{owner}/{repo}@{ref}/{entry}
// ============================================================

/** The `candy-tweak.json` manifest at a tweak repo root. */
export interface TweakManifest {
  /** Reverse-DNS unique id, e.g. "com.you.dark-mode". */
  id: string;
  /** Human-readable name. */
  name: string;
  /** Semver, e.g. "0.1.0". */
  version: string;
  /** "owner/repo" — required, used for update checks + CDN URL. */
  githubRepo: string;
  /** Author handle/name. */
  author: string;
  /** One-line description. */
  description: string;
  /** Path to the ESM entry within the repo (default "index.js"). */
  entry?: string;
  /** Minimum runtime version this tweak needs. */
  minRuntime?: string;
  /** Optional homepage / docs link. */
  homepage?: string;
  /** Optional category for the manager UI. */
  category?: string;
  /** Optional icon (emoji or URL). */
  icon?: string;
}

/** Per-tweak persisted install record (localStorage). */
export interface InstalledTweak {
  /** "owner/repo" */
  repo: string;
  /** git ref / tag to pin (default "main" → latest). */
  ref: string;
  /** Manifest snapshot from last load. */
  manifest: TweakManifest;
  /** Whether the runtime should load + start this tweak. */
  enabled: boolean;
  /** Per-tweak config blob the tweak owns. */
  config: Record<string, unknown>;
  /** Installed version (manifest.version at install/update time). */
  installedVersion: string;
  /** When the install record was created (unix ms). */
  installedAt: number;
  /** Last time we checked GitHub for an update (unix ms). */
  lastUpdateCheck?: number;
  /** Latest version seen on GitHub releases (if newer than installed). */
  updateAvailable?: string | null;
}

/** Logging surface handed to a tweak. */
export interface TweakLog {
  info: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
}

/** A settings panel a tweak can register into the Tweak Manager. */
export interface TweakSettingsPanel {
  id: string;
  title: string;
  /** Render the panel body into the supplied root element. */
  render: (root: HTMLElement, ctx: { config: Record<string, unknown>; setConfig: (next: Record<string, unknown>) => void }) => void;
}

/** Per-tweak persistent KV (namespaced in localStorage). */
export interface TweakStorage {
  get<T = unknown>(key: string, fallback?: T): T;
  set(key: string, value: unknown): void;
  remove(key: string): void;
}

/** UI helpers. */
export interface TweakUI {
  /** Inject a <style> tag scoped to this tweak; auto-removed on stop(). */
  injectStyle: (css: string) => void;
  /** Register a click/render hook on SPA route changes. Returns disposer. */
  onRoute: (cb: (path: string) => void) => () => void;
  /** Toast (uses the host's sonner instance if present). */
  toast: (msg: string, kind?: 'success' | 'error' | 'info') => void;
}

/** DOM helpers — UI tweaks frequently need to wait for elements. */
export interface TweakDom {
  /** Resolve when a selector appears (or null after timeout ms). */
  waitFor: (selector: string, timeoutMs?: number) => Promise<Element | null>;
  /** MutationObserver wrapper; returns disposer. */
  observe: (cb: (muts: MutationRecord[]) => void) => () => void;
}

/** The full API object passed to a tweak's start(). */
export interface TweakAPI {
  /** Tweak id (from manifest). */
  readonly id: string;
  /** Runtime semver. */
  readonly runtimeVersion: string;
  /** This tweak's persisted config blob (live snapshot). */
  readonly config: Record<string, unknown>;
  /** Persist a new config blob (merged shallow). */
  setConfig: (next: Record<string, unknown>) => void;
  log: TweakLog;
  storage: TweakStorage;
  ui: TweakUI;
  dom: TweakDom;
  settings: {
    register: (panel: TweakSettingsPanel) => void;
  };
}

/** The shape a tweak module must default-export. */
export interface Tweak {
  start: (api: TweakAPI) => void | Promise<void>;
  stop?: () => void | Promise<void>;
}

/** A discovered-but-not-installed tweak (from the registry). */
export interface RegistryTweak {
  repo: string;            // owner/repo
  manifest: TweakManifest;
  stars?: number;
  /** "official" | "community" */
  source: 'official' | 'community';
}

export const RUNTIME_VERSION = '0.1.0';
