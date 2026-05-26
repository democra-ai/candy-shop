// ============================================================
// RunSkillPanel — the fast invocation panel on a skill's detail page.
// ============================================================
// Calls POST /api/skill/:id/run (Worker fast path). No agentic sandbox,
// no 14s warm-up — direct LLM call. Shows tier badge, streaming output,
// and a tier-1 BYOK form when the skill requires it.
// ============================================================

import { useEffect, useState } from 'react';
import { Play, Lock, ShieldCheck, Globe, Loader2, Key } from 'lucide-react';
import { Card, CardContent } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { toast } from 'sonner';
import {
  runSkill, listBYOKKeys, saveBYOKKey,
  type SkillRunTier, type BYOKProvider,
} from '../../lib/skillRunClient';

interface Props {
  skillId: string;
  skillName: string;
  executionModel?: 'open' | 'managed' | 'tee';
  pricingHint?: string;
}

const TIER_META: Record<SkillRunTier, { label: string; Icon: typeof Globe; tone: string; blurb: string }> = {
  open:    { label: 'Open · Tier 0',    Icon: Globe,       tone: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
             blurb: 'Source visible; platform runs the prompt on Workers AI.' },
  managed: { label: 'Managed · Tier 1', Icon: Lock,        tone: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
             blurb: 'Prompt sealed in platform DB. Uses your BYOK API key — your provider sees the prompt; other users do not.' },
  tee:     { label: 'TEE · Tier 2',     Icon: ShieldCheck, tone: 'bg-violet-500/10 text-violet-600 border-violet-500/20',
             blurb: 'Prompt sealed in TEE. Nobody outside the CVM sees it. Response includes attestation.' },
};

export function RunSkillPanel({ skillId, skillName, executionModel = 'open' }: Props) {
  const tier = executionModel === 'tee' ? 'tee' : executionModel === 'managed' ? 'managed' : 'open';
  const meta = TIER_META[tier];

  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [busy, setBusy] = useState(false);
  const [tookMs, setTookMs] = useState<number | null>(null);
  const [attestation, setAttestation] = useState<{ codeHash: string; provider: string } | null>(null);
  const [byokProvider, setByokProvider] = useState<BYOKProvider>('workers-ai');
  const [hasByok, setHasByok] = useState<Record<BYOKProvider, boolean>>({} as any);
  const [showKeyInput, setShowKeyInput] = useState(false);
  const [pendingKey, setPendingKey] = useState('');

  useEffect(() => {
    if (tier !== 'managed') return;
    listBYOKKeys().then(keys => {
      const map: Record<string, boolean> = {};
      for (const k of keys) map[k.provider] = true;
      setHasByok(map as any);
    });
  }, [tier]);

  const onRun = async () => {
    if (!input.trim()) { toast.error('Type some input first'); return; }
    // workers-ai uses CF free daily quota — no BYOK key required.
    if (tier === 'managed' && byokProvider !== 'workers-ai' && !hasByok[byokProvider]) {
      setShowKeyInput(true);
      toast.error(`Add your ${byokProvider} API key first`);
      return;
    }
    setBusy(true);
    setOutput('');
    setAttestation(null);
    setTookMs(null);

    await runSkill(skillId, { input, byokProvider: tier === 'managed' ? byokProvider : undefined }, {
      onDelta: (t) => setOutput(prev => prev + t),
      onAttestation: (a) => setAttestation({ codeHash: a.codeHash, provider: a.provider }),
      onDone: (s) => { setTookMs(s.durationMs); setBusy(false); },
      onPaymentRequired: (info) => {
        toast.error(`Payment required (${info.pricingModel}, ${(info.priceAmount / 100).toFixed(2)} USD)`);
        setBusy(false);
      },
      onError: (e) => { toast.error(e.message); setBusy(false); },
    });
  };

  const onSaveKey = async () => {
    if (!pendingKey.trim()) return;
    try {
      await saveBYOKKey(byokProvider, pendingKey.trim());
      toast.success(`${byokProvider} key saved (encrypted)`);
      setHasByok(prev => ({ ...prev, [byokProvider]: true }));
      setShowKeyInput(false);
      setPendingKey('');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Save failed');
    }
  };

  return (
    <Card>
      <CardContent className="pt-6 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Play className="w-5 h-5" /> Run {skillName}
          </h2>
          <Badge variant="outline" className={`flex items-center gap-1.5 ${meta.tone}`}>
            <meta.Icon className="w-3.5 h-3.5" />
            {meta.label}
          </Badge>
        </div>
        <p className="text-xs text-foreground-secondary">{meta.blurb}</p>

        {tier === 'managed' && (
          <div className="space-y-2">
            <label className="text-xs font-medium text-foreground-secondary flex items-center gap-1.5">
              <Key className="w-3.5 h-3.5" /> BYOK provider
            </label>
            <div className="flex items-center gap-2">
              <select
                value={byokProvider}
                onChange={(e) => setByokProvider(e.target.value as BYOKProvider)}
                className="text-sm bg-backgroundSecondary border border-border rounded px-2 py-1.5"
              >
                <option value="workers-ai">Cloudflare Workers AI (free daily quota)</option>
                <option value="anthropic">Anthropic{hasByok.anthropic ? ' ✓' : ''}</option>
                <option value="openai">OpenAI{hasByok.openai ? ' ✓' : ''}</option>
                <option value="groq">Groq{hasByok.groq ? ' ✓' : ''}</option>
                <option value="cerebras">Cerebras{hasByok.cerebras ? ' ✓' : ''}</option>
                <option value="deepseek">DeepSeek{hasByok.deepseek ? ' ✓' : ''}</option>
                <option value="zhipu">Zhipu{hasByok.zhipu ? ' ✓' : ''}</option>
              </select>
              {byokProvider !== 'workers-ai' && !hasByok[byokProvider] && (
                <button
                  onClick={() => setShowKeyInput(v => !v)}
                  className="text-xs text-primary hover:underline"
                >
                  Add key
                </button>
              )}
            </div>
            {showKeyInput && (
              <div className="flex items-center gap-2">
                <input
                  type="password"
                  placeholder={`${byokProvider} API key (sk-…)`}
                  value={pendingKey}
                  onChange={(e) => setPendingKey(e.target.value)}
                  className="flex-1 text-sm bg-backgroundSecondary border border-border rounded px-2 py-1.5 font-mono"
                />
                <Button size="sm" onClick={onSaveKey}>Save</Button>
              </div>
            )}
          </div>
        )}

        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type your input here…"
          rows={4}
          className="w-full text-sm bg-backgroundSecondary border border-border rounded p-3 resize-y"
          disabled={busy}
        />

        <div className="flex items-center justify-between gap-3">
          <Button onClick={onRun} disabled={busy} className="flex items-center gap-2">
            {busy ? <><Loader2 className="w-4 h-4 animate-spin" />Running…</> : <><Play className="w-4 h-4" />Run</>}
          </Button>
          {tookMs !== null && (
            <span className="text-xs text-foreground-tertiary">
              {tookMs}ms · {tier}
            </span>
          )}
        </div>

        {output && (
          <div className="bg-backgroundSecondary rounded-lg p-4 max-h-96 overflow-y-auto">
            <pre className="text-sm whitespace-pre-wrap font-mono">{output}</pre>
          </div>
        )}

        {attestation && (
          <div className="text-xs space-y-1 p-3 rounded border border-violet-500/20 bg-violet-500/5">
            <div className="flex items-center gap-2 font-medium text-violet-600">
              <ShieldCheck className="w-4 h-4" /> TEE attestation verified
            </div>
            <div className="font-mono text-foreground-tertiary">
              provider: {attestation.provider}
            </div>
            <div className="font-mono text-foreground-tertiary truncate">
              codeHash: {attestation.codeHash}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
