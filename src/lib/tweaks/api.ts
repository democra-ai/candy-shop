// ============================================================
// Candy Shop Tweaks — TweakAPI factory.
// ============================================================
// Builds the sandboxed-ish API object handed to every tweak's
// start(). Tracks injected styles + observers so stop()/disable
// cleanly removes everything the tweak added.
// ============================================================

import { toast as sonnerToast } from 'sonner';
import type { TweakAPI, TweakSettingsPanel } from './types';

interface MakeArgs {
  id: string;
  runtimeVersion: string;
  getConfig: () => Record<string, unknown>;
  setConfig: (next: Record<string, unknown>) => void;
  registerPanel: (p: TweakSettingsPanel) => void;
}

export function makeTweakAPI(args: MakeArgs): { api: TweakAPI; dispose: () => void } {
  const injectedStyles: HTMLStyleElement[] = [];
  const routeDisposers: Array<() => void> = [];
  const observers: MutationObserver[] = [];

  const storageNs = `candy:tweak:${args.id}:`;

  const api: TweakAPI = {
    id: args.id,
    runtimeVersion: args.runtimeVersion,
    get config() {
      return args.getConfig();
    },
    setConfig: (next) => args.setConfig(next),

    log: {
      info: (...a) => console.info(`[tweak:${args.id}]`, ...a),
      warn: (...a) => console.warn(`[tweak:${args.id}]`, ...a),
      error: (...a) => console.error(`[tweak:${args.id}]`, ...a),
    },

    storage: {
      get: <T = unknown>(key: string, fallback?: T): T => {
        try {
          const raw = localStorage.getItem(storageNs + key);
          return raw === null ? (fallback as T) : (JSON.parse(raw) as T);
        } catch {
          return fallback as T;
        }
      },
      set: (key, value) => {
        try {
          localStorage.setItem(storageNs + key, JSON.stringify(value));
        } catch {
          /* ignore */
        }
      },
      remove: (key) => {
        try {
          localStorage.removeItem(storageNs + key);
        } catch {
          /* ignore */
        }
      },
    },

    ui: {
      injectStyle: (css: string) => {
        const el = document.createElement('style');
        el.setAttribute('data-candy-tweak', args.id);
        el.textContent = css;
        document.head.appendChild(el);
        injectedStyles.push(el);
      },
      onRoute: (cb: (path: string) => void) => {
        let last = location.pathname;
        const tick = () => {
          if (location.pathname !== last) {
            last = location.pathname;
            try {
              cb(last);
            } catch {
              /* ignore */
            }
          }
        };
        const id = window.setInterval(tick, 400);
        // Also hook history API for instant SPA navigation feedback.
        const origPush = history.pushState;
        history.pushState = function (this: History, ...rest: Parameters<History['pushState']>) {
          const ret = origPush.apply(this, rest);
          setTimeout(tick, 0);
          return ret;
        };
        const dispose = () => {
          window.clearInterval(id);
          history.pushState = origPush;
        };
        routeDisposers.push(dispose);
        // initial call
        try {
          cb(last);
        } catch {
          /* ignore */
        }
        return dispose;
      },
      toast: (msg, kind = 'info') => {
        if (kind === 'success') sonnerToast.success(msg);
        else if (kind === 'error') sonnerToast.error(msg);
        else sonnerToast(msg);
      },
    },

    dom: {
      waitFor: (selector: string, timeoutMs = 8000) =>
        new Promise<Element | null>((resolve) => {
          const found = document.querySelector(selector);
          if (found) return resolve(found);
          const obs = new MutationObserver(() => {
            const el = document.querySelector(selector);
            if (el) {
              obs.disconnect();
              resolve(el);
            }
          });
          obs.observe(document.documentElement, { childList: true, subtree: true });
          observers.push(obs);
          window.setTimeout(() => {
            obs.disconnect();
            resolve(document.querySelector(selector));
          }, timeoutMs);
        }),
      observe: (cb) => {
        const obs = new MutationObserver(cb);
        obs.observe(document.documentElement, { childList: true, subtree: true });
        observers.push(obs);
        return () => obs.disconnect();
      },
    },

    settings: {
      register: (panel) => args.registerPanel(panel),
    },
  };

  const dispose = () => {
    for (const s of injectedStyles) s.remove();
    for (const d of routeDisposers) {
      try {
        d();
      } catch {
        /* ignore */
      }
    }
    for (const o of observers) o.disconnect();
  };

  return { api, dispose };
}
