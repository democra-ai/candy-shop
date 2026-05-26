// ============================================================
// Tweak Manager — the in-app UI for installing / toggling /
// configuring / updating Candy Shop tweaks.
// ============================================================
// Mirrors codex-plusplus's "Tweaks" settings tab: an Installed list
// with enable toggles + Update-Available badges + per-tweak settings
// panels, plus a Browse tab fed by the GitHub topic registry, plus
// a manual "install by owner/repo" box.
// ============================================================

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Puzzle, Power, Trash2, RefreshCw, Download, ExternalLink, Plus,
  ShieldCheck, AlertTriangle, X, Settings as SettingsIcon,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '../../utils/cn';
import { tweakRuntime } from '../../lib/tweaks/runtime';
import { loadRegistry } from '../../lib/tweaks/registry';
import type { InstalledTweak, RegistryTweak, TweakSettingsPanel } from '../../lib/tweaks/types';

type Tab = 'installed' | 'browse';

export function TweakManager({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<Tab>('installed');
  const [installed, setInstalled] = useState<InstalledTweak[]>(() => tweakRuntime.list());
  const [registry, setRegistry] = useState<RegistryTweak[] | null>(null);
  const [registryLoading, setRegistryLoading] = useState(false);
  const [manualRepo, setManualRepo] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [configFor, setConfigFor] = useState<string | null>(null);

  // live-subscribe to runtime changes
  useEffect(() => tweakRuntime.subscribe(() => setInstalled(tweakRuntime.list())), []);

  // background update check on open
  useEffect(() => {
    void tweakRuntime.checkAllUpdates();
  }, []);

  const refreshRegistry = useCallback(async () => {
    setRegistryLoading(true);
    try {
      setRegistry(await loadRegistry());
    } catch {
      toast.error('Failed to load tweak registry');
    } finally {
      setRegistryLoading(false);
    }
  }, []);

  useEffect(() => {
    if (tab === 'browse' && registry === null) void refreshRegistry();
  }, [tab, registry, refreshRegistry]);

  const doInstall = async (repo: string, ref = 'main') => {
    setBusy(repo);
    try {
      await tweakRuntime.install(repo, ref);
      toast.success(`Installed ${repo}`);
      setTab('installed');
    } catch (e) {
      toast.error(`Install failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(null);
    }
  };

  const installedRepos = new Set(installed.map((t) => t.repo));

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-3xl max-h-[85vh] flex flex-col glass rounded-2xl border border-border/60 shadow-warm-lg overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 flex items-center justify-center border border-violet-500/20">
              <Puzzle className="w-5 h-5 text-violet-400" />
            </div>
            <div>
              <h2 className="text-lg font-candy font-bold text-foreground">Tweaks</h2>
              <p className="text-xs font-mono text-foreground-tertiary">
                Community modifications · loaded at runtime from GitHub
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-secondary/60 text-foreground-tertiary"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 px-6 pt-3">
          {(['installed', 'browse'] as Tab[]).map((tb) => (
            <button
              key={tb}
              onClick={() => setTab(tb)}
              className={cn(
                'px-4 py-2 text-sm font-mono rounded-lg transition-all',
                tab === tb
                  ? 'bg-violet-500/15 text-violet-300 border border-violet-500/30'
                  : 'text-foreground-tertiary hover:bg-secondary/40'
              )}
            >
              {tb === 'installed' ? `Installed (${installed.length})` : 'Browse'}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
          {tab === 'installed' && (
            <InstalledList
              installed={installed}
              busy={busy}
              setBusy={setBusy}
              configFor={configFor}
              setConfigFor={setConfigFor}
            />
          )}

          {tab === 'browse' && (
            <>
              {/* Manual install */}
              <div className="flex items-center gap-2 p-3 glass rounded-xl border border-border/40">
                <Plus className="w-4 h-4 text-foreground-tertiary shrink-0" />
                <input
                  value={manualRepo}
                  onChange={(e) => setManualRepo(e.target.value)}
                  placeholder="owner/repo  (must contain candy-tweak.json)"
                  className="flex-1 bg-transparent text-sm font-mono text-foreground placeholder-foreground-tertiary focus:outline-none"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && manualRepo.trim()) doInstall(manualRepo.trim());
                  }}
                />
                <button
                  disabled={!manualRepo.trim() || busy === manualRepo.trim()}
                  onClick={() => doInstall(manualRepo.trim())}
                  className="px-3 py-1.5 text-xs font-mono rounded-lg bg-violet-500/15 text-violet-300 border border-violet-500/30 hover:bg-violet-500/25 disabled:opacity-40 transition-all"
                >
                  Install
                </button>
              </div>

              {registryLoading && (
                <div className="flex items-center justify-center py-12 gap-2 text-foreground-tertiary text-sm font-mono">
                  <RefreshCw className="w-4 h-4 animate-spin" /> Discovering tweaks…
                </div>
              )}

              {registry?.map((rt) => (
                <BrowseRow
                  key={rt.repo}
                  rt={rt}
                  installed={installedRepos.has(rt.repo)}
                  busy={busy === rt.repo}
                  onInstall={() => doInstall(rt.repo)}
                />
              ))}

              {registry && registry.length === 0 && !registryLoading && (
                <p className="text-center py-12 text-sm font-mono text-foreground-tertiary">
                  No community tweaks found yet. Publish one with a{' '}
                  <code className="text-violet-300">candy-tweak.json</code> + GitHub topic{' '}
                  <code className="text-violet-300">candy-tweak</code>.
                </p>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-border/40 flex items-center justify-between text-[11px] font-mono text-foreground-tertiary">
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            Tweaks run in your browser. Updates are manual — review the repo before installing.
          </span>
        </div>
      </div>
    </div>
  );
}

// ── Installed list ────────────────────────────────────────────────

function InstalledList({
  installed,
  busy,
  setBusy,
  configFor,
  setConfigFor,
}: {
  installed: InstalledTweak[];
  busy: string | null;
  setBusy: (v: string | null) => void;
  configFor: string | null;
  setConfigFor: (v: string | null) => void;
}) {
  if (installed.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
        <Puzzle className="w-10 h-10 text-foreground-tertiary opacity-40" />
        <p className="text-sm font-mono text-foreground-tertiary">
          No tweaks installed. Switch to <span className="text-violet-300">Browse</span> to add one.
        </p>
      </div>
    );
  }

  return (
    <>
      {installed.map((t) => (
        <div key={t.repo} className="glass rounded-xl border border-border/40 overflow-hidden">
          <div className="flex items-center gap-3 p-3">
            <span className="text-2xl shrink-0">{t.manifest.icon || '🧩'}</span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-foreground truncate">{t.manifest.name}</h3>
                <span className="text-[10px] font-mono text-foreground-tertiary">
                  v{t.installedVersion}
                </span>
                {t.updateAvailable && (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-mono rounded bg-amber-500/15 text-amber-300 border border-amber-500/30">
                    <Download className="w-3 h-3" /> Update {t.updateAvailable}
                  </span>
                )}
                {tweakRuntime.isLoaded(t.repo) && (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-mono rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                    running
                  </span>
                )}
              </div>
              <p className="text-xs text-foreground-tertiary truncate">{t.manifest.description}</p>
              <p className="text-[10px] font-mono text-foreground-muted truncate">
                {t.repo} · by {t.manifest.author}
              </p>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              {t.updateAvailable && (
                <button
                  title="Update to latest"
                  disabled={busy === t.repo}
                  onClick={async () => {
                    setBusy(t.repo);
                    try {
                      await tweakRuntime.install(t.repo, t.ref);
                      toast.success(`Updated ${t.manifest.name}`);
                    } catch {
                      toast.error('Update failed');
                    } finally {
                      setBusy(null);
                    }
                  }}
                  className="p-2 rounded-lg bg-amber-500/15 text-amber-300 border border-amber-500/30 hover:bg-amber-500/25 disabled:opacity-40"
                >
                  <Download className="w-4 h-4" />
                </button>
              )}
              {tweakRuntime.getSettingsPanels(t.repo).length > 0 && (
                <button
                  title="Settings"
                  onClick={() => setConfigFor(configFor === t.repo ? null : t.repo)}
                  className={cn(
                    'p-2 rounded-lg border',
                    configFor === t.repo
                      ? 'bg-violet-500/20 text-violet-300 border-violet-500/40'
                      : 'bg-secondary/40 text-foreground-tertiary border-border/40 hover:text-foreground'
                  )}
                >
                  <SettingsIcon className="w-4 h-4" />
                </button>
              )}
              <a
                title="View on GitHub"
                href={`https://github.com/${t.repo}`}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 rounded-lg bg-secondary/40 text-foreground-tertiary border border-border/40 hover:text-foreground"
              >
                <ExternalLink className="w-4 h-4" />
              </a>
              <button
                title={t.enabled ? 'Disable' : 'Enable'}
                onClick={() => tweakRuntime.setEnabled(t.repo, !t.enabled)}
                className={cn(
                  'p-2 rounded-lg border',
                  t.enabled
                    ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                    : 'bg-secondary/40 text-foreground-tertiary border-border/40'
                )}
              >
                <Power className="w-4 h-4" />
              </button>
              <button
                title="Uninstall"
                onClick={() => {
                  void tweakRuntime.uninstall(t.repo);
                  toast.success(`Removed ${t.manifest.name}`);
                }}
                className="p-2 rounded-lg bg-secondary/40 text-foreground-tertiary border border-border/40 hover:text-red-300 hover:border-red-500/30"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {configFor === t.repo && <ConfigPanel repo={t.repo} />}
        </div>
      ))}
    </>
  );
}

// ── per-tweak settings panel host ─────────────────────────────────

function ConfigPanel({ repo }: { repo: string }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [panels] = useState<TweakSettingsPanel[]>(() => tweakRuntime.getSettingsPanels(repo));

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    host.innerHTML = '';
    for (const p of panels) {
      const wrap = document.createElement('div');
      wrap.className = 'mb-3';
      const h = document.createElement('div');
      h.className = 'text-[11px] font-mono uppercase tracking-wider text-foreground-tertiary mb-2';
      h.textContent = p.title;
      const body = document.createElement('div');
      wrap.appendChild(h);
      wrap.appendChild(body);
      host.appendChild(wrap);
      try {
        p.render(body, {
          config: tweakRuntime.getConfig(repo),
          setConfig: (next) => tweakRuntime.setConfig(repo, next),
        });
      } catch {
        body.textContent = '(panel render error)';
      }
    }
  }, [panels, repo]);

  return (
    <div className="border-t border-border/40 bg-secondary/20 px-4 py-3">
      {panels.length === 0 ? (
        <p className="text-xs font-mono text-foreground-tertiary">This tweak has no settings.</p>
      ) : (
        <div ref={hostRef} />
      )}
    </div>
  );
}

// ── browse row ────────────────────────────────────────────────────

function BrowseRow({
  rt,
  installed,
  busy,
  onInstall,
}: {
  rt: RegistryTweak;
  installed: boolean;
  busy: boolean;
  onInstall: () => void;
}) {
  return (
    <div className="flex items-center gap-3 p-3 glass rounded-xl border border-border/40">
      <span className="text-2xl shrink-0">{rt.manifest.icon || '🧩'}</span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-foreground truncate">{rt.manifest.name}</h3>
          <span className="text-[10px] font-mono text-foreground-tertiary">v{rt.manifest.version}</span>
          {rt.source === 'official' ? (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-mono rounded bg-violet-500/15 text-violet-300 border border-violet-500/30">
              <ShieldCheck className="w-3 h-3" /> Official
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-mono rounded bg-secondary/50 text-foreground-tertiary border border-border/40">
              <AlertTriangle className="w-3 h-3" /> Community
            </span>
          )}
          {typeof rt.stars === 'number' && rt.stars > 0 && (
            <span className="text-[10px] font-mono text-foreground-tertiary">★ {rt.stars}</span>
          )}
        </div>
        <p className="text-xs text-foreground-tertiary truncate">{rt.manifest.description}</p>
        <p className="text-[10px] font-mono text-foreground-muted truncate">
          {rt.repo} · by {rt.manifest.author}
        </p>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <a
          href={`https://github.com/${rt.repo}`}
          target="_blank"
          rel="noopener noreferrer"
          className="p-2 rounded-lg bg-secondary/40 text-foreground-tertiary border border-border/40 hover:text-foreground"
        >
          <ExternalLink className="w-4 h-4" />
        </a>
        {installed ? (
          <span className="px-3 py-1.5 text-xs font-mono rounded-lg bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
            Installed
          </span>
        ) : (
          <button
            disabled={busy}
            onClick={onInstall}
            className="px-3 py-1.5 text-xs font-mono rounded-lg bg-violet-500/15 text-violet-300 border border-violet-500/30 hover:bg-violet-500/25 disabled:opacity-40"
          >
            {busy ? 'Installing…' : 'Install'}
          </button>
        )}
      </div>
    </div>
  );
}
