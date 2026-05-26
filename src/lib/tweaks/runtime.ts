// ============================================================
// Candy Shop Tweaks — runtime.
// ============================================================
// Singleton that owns the tweak lifecycle:
//   - persists the installed-tweak list to localStorage
//   - loads each enabled tweak's ESM from jsDelivr (GitHub CDN)
//   - calls start(api) / stop()
//   - checks GitHub Releases for updates (≤ once/day per tweak,
//     manual update only — mirrors codex-plusplus's security stance)
//
// Everything is client-side; no server needed.
// ============================================================

import {
  RUNTIME_VERSION,
  type InstalledTweak,
  type Tweak,
  type TweakManifest,
  type TweakSettingsPanel,
} from './types';
import { makeTweakAPI } from './api';

const LS_KEY = 'candy:tweaks:installed:v1';

type Listener = () => void;

interface LoadedTweak {
  record: InstalledTweak;
  mod: Tweak;
  dispose: () => void; // tears down injected styles / observers
  settingsPanels: TweakSettingsPanel[];
}

class TweakRuntime {
  private installed: InstalledTweak[] = [];
  private loaded = new Map<string, LoadedTweak>(); // key = repo
  private listeners = new Set<Listener>();
  private started = false;

  // ── persistence ─────────────────────────────────────────────────
  private load(): void {
    try {
      const raw = localStorage.getItem(LS_KEY);
      this.installed = raw ? (JSON.parse(raw) as InstalledTweak[]) : [];
    } catch {
      this.installed = [];
    }
  }

  private persist(): void {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(this.installed));
    } catch {
      /* quota / private mode — non-fatal */
    }
    this.emit();
  }

  // ── observable ──────────────────────────────────────────────────
  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
  private emit(): void {
    for (const l of this.listeners) {
      try {
        l();
      } catch {
        /* ignore listener errors */
      }
    }
  }

  // ── public read API ─────────────────────────────────────────────
  list(): InstalledTweak[] {
    return [...this.installed];
  }
  isLoaded(repo: string): boolean {
    return this.loaded.has(repo);
  }
  getSettingsPanels(repo: string): TweakSettingsPanel[] {
    return this.loaded.get(repo)?.settingsPanels ?? [];
  }

  // ── boot ────────────────────────────────────────────────────────
  async boot(): Promise<void> {
    if (this.started) return;
    this.started = true;
    this.load();
    // Start every enabled tweak. Failures are isolated per-tweak.
    await Promise.all(
      this.installed.filter((t) => t.enabled).map((t) => this.startTweak(t).catch(() => {}))
    );
  }

  // ── CDN URL builder ─────────────────────────────────────────────
  private cdnUrl(record: InstalledTweak): string {
    const entry = record.manifest.entry || 'index.js';
    // jsDelivr serves GitHub repos: /gh/{owner}/{repo}@{ref}/{path}
    return `https://cdn.jsdelivr.net/gh/${record.repo}@${record.ref}/${entry.replace(/^\/+/, '')}`;
  }

  // ── lifecycle ───────────────────────────────────────────────────
  private async startTweak(record: InstalledTweak): Promise<void> {
    if (this.loaded.has(record.repo)) return;
    const url = this.cdnUrl(record);
    // Vite would try to bundle a static import; force a true dynamic
    // runtime import via an indirection that the bundler can't analyze.
    const dynamicImport = new Function('u', 'return import(u)') as (u: string) => Promise<{ default?: Tweak }>;
    const mod = await dynamicImport(url);
    const tweak = (mod.default ?? (mod as unknown as Tweak)) as Tweak;
    if (!tweak || typeof tweak.start !== 'function') {
      throw new Error(`Tweak ${record.repo} has no start()`);
    }

    const settingsPanels: TweakSettingsPanel[] = [];
    const { api, dispose } = makeTweakAPI({
      id: record.manifest.id,
      runtimeVersion: RUNTIME_VERSION,
      getConfig: () => this.getConfig(record.repo),
      setConfig: (next) => this.setConfig(record.repo, next),
      registerPanel: (p) => settingsPanels.push(p),
    });

    await tweak.start(api);
    this.loaded.set(record.repo, { record, mod: tweak, dispose, settingsPanels });
    this.emit();
  }

  private async stopTweak(repo: string): Promise<void> {
    const l = this.loaded.get(repo);
    if (!l) return;
    try {
      await l.mod.stop?.();
    } catch {
      /* ignore */
    }
    try {
      l.dispose();
    } catch {
      /* ignore */
    }
    this.loaded.delete(repo);
    this.emit();
  }

  // ── install / enable / config ───────────────────────────────────
  /** Install (or re-install) a tweak by fetching its manifest. */
  async install(repo: string, ref = 'main'): Promise<InstalledTweak> {
    const manifest = await fetchManifest(repo, ref);
    const existing = this.installed.find((t) => t.repo === repo);
    const record: InstalledTweak = existing
      ? {
          ...existing,
          ref,
          manifest,
          installedVersion: manifest.version,
          updateAvailable: null,
          lastUpdateCheck: Date.now(),
        }
      : {
          repo,
          ref,
          manifest,
          enabled: true,
          config: {},
          installedVersion: manifest.version,
          installedAt: Date.now(),
          lastUpdateCheck: Date.now(),
          updateAvailable: null,
        };
    if (existing) {
      this.installed = this.installed.map((t) => (t.repo === repo ? record : t));
      await this.stopTweak(repo);
    } else {
      this.installed = [...this.installed, record];
    }
    this.persist();
    if (record.enabled) await this.startTweak(record).catch(() => {});
    return record;
  }

  async uninstall(repo: string): Promise<void> {
    await this.stopTweak(repo);
    this.installed = this.installed.filter((t) => t.repo !== repo);
    this.persist();
  }

  async setEnabled(repo: string, enabled: boolean): Promise<void> {
    const rec = this.installed.find((t) => t.repo === repo);
    if (!rec) return;
    rec.enabled = enabled;
    this.persist();
    if (enabled) await this.startTweak(rec).catch(() => {});
    else await this.stopTweak(repo);
  }

  getConfig(repo: string): Record<string, unknown> {
    return this.installed.find((t) => t.repo === repo)?.config ?? {};
  }

  setConfig(repo: string, next: Record<string, unknown>): void {
    const rec = this.installed.find((t) => t.repo === repo);
    if (!rec) return;
    rec.config = { ...rec.config, ...next };
    this.persist();
  }

  // ── update detection (manual apply only) ────────────────────────
  /** Check GitHub Releases for newer semver. Throttled to 1/day. */
  async checkUpdate(repo: string, force = false): Promise<string | null> {
    const rec = this.installed.find((t) => t.repo === repo);
    if (!rec) return null;
    const DAY = 86_400_000;
    if (!force && rec.lastUpdateCheck && Date.now() - rec.lastUpdateCheck < DAY) {
      return rec.updateAvailable ?? null;
    }
    rec.lastUpdateCheck = Date.now();
    try {
      const r = await fetch(`https://api.github.com/repos/${repo}/releases/latest`, {
        headers: { Accept: 'application/vnd.github+json' },
      });
      if (r.ok) {
        const j = (await r.json()) as { tag_name?: string };
        const latest = (j.tag_name ?? '').replace(/^v/, '');
        if (latest && semverGt(latest, rec.installedVersion)) {
          rec.updateAvailable = latest;
          this.persist();
          return latest;
        }
      }
    } catch {
      /* offline / rate-limited — non-fatal */
    }
    rec.updateAvailable = null;
    this.persist();
    return null;
  }

  async checkAllUpdates(): Promise<void> {
    await Promise.all(this.installed.map((t) => this.checkUpdate(t.repo).catch(() => null)));
  }
}

// ── helpers ───────────────────────────────────────────────────────

export async function fetchManifest(repo: string, ref = 'main'): Promise<TweakManifest> {
  // Try jsDelivr first (CDN-cached), fall back to raw.githubusercontent.
  const urls = [
    `https://cdn.jsdelivr.net/gh/${repo}@${ref}/candy-tweak.json`,
    `https://raw.githubusercontent.com/${repo}/${ref}/candy-tweak.json`,
  ];
  for (const u of urls) {
    try {
      const r = await fetch(u);
      if (r.ok) {
        const m = (await r.json()) as TweakManifest;
        if (m && m.id && m.name && m.version && m.githubRepo) return m;
      }
    } catch {
      /* try next */
    }
  }
  throw new Error(`No valid candy-tweak.json in ${repo}@${ref}`);
}

/** Minimal semver greater-than (major.minor.patch, ignores prerelease). */
export function semverGt(a: string, b: string): boolean {
  const pa = a.split('.').map((n) => parseInt(n, 10) || 0);
  const pb = b.split('.').map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < 3; i++) {
    const x = pa[i] ?? 0;
    const y = pb[i] ?? 0;
    if (x !== y) return x > y;
  }
  return false;
}

export const tweakRuntime = new TweakRuntime();
