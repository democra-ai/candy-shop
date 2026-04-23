-- Seed: 3 paid skills mirrored from src/data/skillsData.ts (Premium tier).
-- Frontend IDs are strings like 'enterprise-code-review' — preserve them
-- so existing static skill cards continue to work.

INSERT OR IGNORE INTO skills (id, name, description, icon, category, pricing_model, price_amount, price_currency)
VALUES
  (
    'enterprise-code-review',
    'Enterprise Code Review',
    'AI-powered code review with security analysis, OWASP compliance checks, and architectural suggestions. Manifest visible; runtime execution requires entitlement.',
    '🛡️',
    'Development',
    'per_call',
    999,
    'usd'
  ),
  (
    'gpt-researcher-pro',
    'Deep Research Pro',
    'Advanced multi-source research agent — deep web analysis, citation generation, and structured reporting. Licensed derivative of GPT Researcher.',
    '🔍',
    'Research',
    'per_call',
    1499,
    'usd'
  ),
  (
    'compliance-scanner',
    'Compliance Scanner',
    'SOC2, HIPAA, GDPR compliance scanner for codebases and infrastructure configs.',
    '📋',
    'Tools',
    'per_call',
    2499,
    'usd'
  );
