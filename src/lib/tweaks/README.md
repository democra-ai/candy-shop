# Candy Shop Tweaks

A codex-plusplus-style community modification system, adapted for the web.

A **tweak** is a tiny ESM module published in a GitHub repo. Candy Shop
loads enabled tweaks at runtime from the jsDelivr CDN, runs their
`start(api)` lifecycle, and lets users enable/disable/configure them in
the in-app **Tweaks** manager (`/tweaks`).

There is no app patching (we're a web app, not Electron) — the runtime
just `import()`s each tweak's entry module from:

```
https://cdn.jsdelivr.net/gh/{owner}/{repo}@{ref}/{entry}
```

## Publishing a tweak

A tweak repo needs two files at its root:

```
my-tweak/
├── candy-tweak.json     # manifest
└── index.js             # ESM, default-exports { start, stop }
```

### `candy-tweak.json`

```json
{
  "id": "com.you.my-tweak",
  "name": "My Tweak",
  "version": "0.1.0",
  "githubRepo": "you/my-tweak",
  "author": "you",
  "description": "Adds a confetti button to the header.",
  "entry": "index.js",
  "minRuntime": "0.1.0",
  "icon": "🎉",
  "category": "fun"
}
```

### `index.js`

```js
export default {
  async start(api) {
    api.log.info('starting, runtime', api.runtimeVersion);

    // Inject CSS (auto-removed on stop/disable)
    api.ui.injectStyle(`.candy-confetti{position:fixed;inset:0;pointer-events:none}`);

    // React to SPA route changes
    api.ui.onRoute((path) => api.log.info('route →', path));

    // Wait for a DOM element then mutate it
    const header = await api.dom.waitFor('header');
    if (header) {
      const btn = document.createElement('button');
      btn.textContent = '🎉';
      btn.onclick = () => api.ui.toast('Confetti!', 'success');
      header.appendChild(btn);
    }

    // Register a settings panel (shows in the Tweak Manager)
    api.settings.register({
      id: 'main',
      title: 'Confetti settings',
      render: (root, { config, setConfig }) => {
        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.checked = Boolean(config.loud);
        cb.onchange = () => setConfig({ loud: cb.checked });
        const label = document.createElement('label');
        label.append(cb, ' Loud mode');
        root.appendChild(label);
      },
    });
  },
  stop() {
    // Optional. Injected styles / route hooks / observers created via
    // `api.*` are torn down automatically; clean up your own DOM here.
  },
};
```

Then add the GitHub **topic** `candy-tweak` to the repo so it shows up
in the Browse tab automatically. (Or users can install by `owner/repo`.)

## Updates

Tag a GitHub Release (e.g. `v0.2.0`). The manager checks
`releases/latest` ≤ once/day and shows **Update Available** when the
release tag's semver exceeds the installed `version`. Updates are
**manual** — the user reviews the repo, then clicks update. (Same
security stance as codex-plusplus: no silent auto-update of code that
runs in your browser.)

## API surface (`api`)

| Member | Purpose |
|---|---|
| `api.id` | tweak id from manifest |
| `api.runtimeVersion` | runtime semver |
| `api.config` / `api.setConfig(obj)` | persisted config blob |
| `api.log.{info,warn,error}` | namespaced console |
| `api.storage.{get,set,remove}` | per-tweak localStorage KV |
| `api.ui.injectStyle(css)` | scoped `<style>`, auto-removed |
| `api.ui.onRoute(cb)` | SPA route-change hook → disposer |
| `api.ui.toast(msg, kind)` | host toast |
| `api.dom.waitFor(sel, ms)` | resolve when element appears |
| `api.dom.observe(cb)` | MutationObserver → disposer |
| `api.settings.register(panel)` | add a panel to the manager |

## Security

Tweaks run with full page privileges (it's `import()` of third-party
code). Treat installing a tweak like running an npm package: only
install from repos you trust. The manager surfaces the GitHub repo
link prominently and never auto-updates code.
