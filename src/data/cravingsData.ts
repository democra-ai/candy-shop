
export type CravingCategory =
  | 'Development'
  | 'Design'
  | 'Marketing'
  | 'Productivity'
  | 'Tools'
  | 'Research'
  | 'Mobile'
  | 'Writing';

export type CravingUrgency = 'low' | 'medium' | 'high';
export type CravingStatus = 'open' | 'in-progress' | 'fulfilled';

export interface Craving {
  id: string;
  title: string;
  description: string;
  category: CravingCategory;
  tags: string[];
  budget: string;
  urgency: CravingUrgency;
  postedBy: string;
  postedAt: string;   // ISO date string
  matchCount: number; // How many candies could fulfill this
  status: CravingStatus;
  emoji: string;
}

export const CRAVINGS_DATA: Craving[] = [
  {
    id: 'craving-code-review',
    title: 'Automated code review for my React monorepo',
    description:
      'I need an AI agent that can review PRs across a 30-repo monorepo, flag security issues, check TypeScript types, and leave structured comments on GitHub. Bonus if it can suggest refactors.',
    category: 'Development',
    tags: ['React', 'TypeScript', 'GitHub', 'Security'],
    budget: '$100–300',
    urgency: 'high',
    postedBy: 'devloper_x',
    postedAt: '2026-03-01T10:30:00Z',
    matchCount: 7,
    status: 'open',
    emoji: '🔍',
  },
  {
    id: 'craving-social-content',
    title: 'Generate a week of social media posts from blog articles',
    description:
      'Give me a tool that reads my blog RSS feed and outputs 5 platform-specific posts (Twitter/X, LinkedIn, Instagram caption, Threads, BlueSky) per article, adapted for each platform tone.',
    category: 'Marketing',
    tags: ['Social Media', 'Content', 'Automation'],
    budget: '$50–150',
    urgency: 'medium',
    postedBy: 'marketingmaven',
    postedAt: '2026-03-02T08:00:00Z',
    matchCount: 4,
    status: 'open',
    emoji: '📱',
  },
  {
    id: 'craving-ui-component',
    title: 'Design system documentation generator',
    description:
      'Parse a Figma file or a React component library and auto-generate a living documentation site with usage examples, prop tables, and design tokens. Must support Storybook export.',
    category: 'Design',
    tags: ['Figma', 'React', 'Design System', 'Documentation'],
    budget: '$200–500',
    urgency: 'low',
    postedBy: 'pixel_pusher',
    postedAt: '2026-02-28T14:20:00Z',
    matchCount: 3,
    status: 'open',
    emoji: '🎨',
  },
  {
    id: 'craving-email-automation',
    title: 'Smart email triage and draft reply agent',
    description:
      'Read my inbox, categorize emails by priority, draft context-aware replies in my writing style, and flag anything that needs immediate human attention. Gmail or Outlook integration.',
    category: 'Productivity',
    tags: ['Email', 'Automation', 'Gmail'],
    budget: '$80–200',
    urgency: 'high',
    postedBy: 'inbox_zero_fan',
    postedAt: '2026-03-03T09:15:00Z',
    matchCount: 5,
    status: 'open',
    emoji: '📬',
  },
  {
    id: 'craving-competitor-analysis',
    title: 'Weekly competitor landscape report',
    description:
      'Monitor 10 competitor websites, their Twitter/X activity, and product changelogs. Summarize key moves, pricing changes, and new features into a weekly Slack digest.',
    category: 'Research',
    tags: ['Research', 'Competitive Analysis', 'Slack'],
    budget: '$100–250',
    urgency: 'medium',
    postedBy: 'strategy_nerd',
    postedAt: '2026-02-27T11:00:00Z',
    matchCount: 6,
    status: 'open',
    emoji: '🔭',
  },
  {
    id: 'craving-product-descriptions',
    title: 'E-commerce product description writer',
    description:
      'Generate SEO-optimized product descriptions for 500+ SKUs from a CSV of specs. Each description should be unique, conversion-focused, and under 200 words. Support for 3 languages.',
    category: 'Writing',
    tags: ['SEO', 'E-commerce', 'Content', 'Multilingual'],
    budget: '$150–400',
    urgency: 'medium',
    postedBy: 'shopify_seller_99',
    postedAt: '2026-03-01T16:45:00Z',
    matchCount: 8,
    status: 'open',
    emoji: '🛍️',
  },
  {
    id: 'craving-app-testing',
    title: 'Mobile app regression test generator',
    description:
      'Given a mobile app codebase (React Native), auto-generate Detox or Maestro test cases for critical user flows. Should cover login, checkout, and push notification flows.',
    category: 'Mobile',
    tags: ['React Native', 'Testing', 'Automation', 'Mobile'],
    budget: '$200–600',
    urgency: 'low',
    postedBy: 'native_dev_101',
    postedAt: '2026-02-25T13:30:00Z',
    matchCount: 2,
    status: 'open',
    emoji: '📲',
  },
  {
    id: 'craving-data-viz',
    title: 'Dashboard generation from SQL queries',
    description:
      'Point at a PostgreSQL database, let me describe what I want to see in plain English, and generate an interactive Recharts/D3 dashboard component with auto-refreshing data.',
    category: 'Tools',
    tags: ['SQL', 'Data Visualization', 'React', 'Dashboard'],
    budget: '$300–700',
    urgency: 'high',
    postedBy: 'data_is_life',
    postedAt: '2026-03-04T07:00:00Z',
    matchCount: 4,
    status: 'open',
    emoji: '📊',
  },
  {
    id: 'craving-tech-docs',
    title: 'API documentation writer from codebase',
    description:
      'Scan a Node.js/Express codebase, extract all API endpoints, types, and business logic, then produce OpenAPI 3.1 spec + beautiful Markdown docs automatically. Must stay in sync on each commit.',
    category: 'Writing',
    tags: ['Documentation', 'API', 'Node.js', 'OpenAPI'],
    budget: '$100–300',
    urgency: 'high',
    postedBy: 'api_architect',
    postedAt: '2026-03-03T12:00:00Z',
    matchCount: 5,
    status: 'in-progress',
    emoji: '📝',
  },
  {
    id: 'craving-seo-optimization',
    title: 'Technical SEO audit and fix agent',
    description:
      'Crawl my Next.js site, identify technical SEO issues (Core Web Vitals, meta tags, structured data, broken links), and open GitHub issues with suggested fixes. Monthly recurring run.',
    category: 'Marketing',
    tags: ['SEO', 'Next.js', 'Performance', 'GitHub'],
    budget: '$80–200',
    urgency: 'medium',
    postedBy: 'seo_growth_hacker',
    postedAt: '2026-02-29T10:00:00Z',
    matchCount: 3,
    status: 'open',
    emoji: '🚀',
  },
  {
    id: 'craving-code-refactor',
    title: 'Legacy JavaScript to TypeScript migration agent',
    description:
      'Migrate a 50k LOC JavaScript codebase to strict TypeScript incrementally. Should infer types, add JSDoc where inference fails, and ensure zero regressions by running tests after each file.',
    category: 'Development',
    tags: ['TypeScript', 'Refactoring', 'JavaScript', 'Migration'],
    budget: '$500–1500',
    urgency: 'low',
    postedBy: 'type_safety_enjoyer',
    postedAt: '2026-02-26T15:00:00Z',
    matchCount: 6,
    status: 'open',
    emoji: '🔧',
  },
  {
    id: 'craving-customer-support',
    title: 'Tier-1 customer support chatbot with escalation',
    description:
      'Build a support bot trained on our Notion knowledge base and Zendesk ticket history. Handle 80% of L1 tickets autonomously, escalate complex issues to humans with full context.',
    category: 'Tools',
    tags: ['Customer Support', 'Chatbot', 'Zendesk', 'Notion'],
    budget: '$400–1000',
    urgency: 'high',
    postedBy: 'cx_team_lead',
    postedAt: '2026-03-04T09:30:00Z',
    matchCount: 9,
    status: 'open',
    emoji: '🎧',
  },
];
