import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

type Language = 'en' | 'zh';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

// Simple translations
const translations: Record<Language, Record<string, string>> = {
  en: {
    // Sidebar
    'nav.find': 'find --sweet',
    'nav.cd': 'cd /chocolates',
    'nav.man': 'man recipes',
    'nav.create': 'create skills',
    'nav.library': 'my skills',
    'nav.candy': 'find --candy',
    'nav.craving': 'find --craving',
    'nav.postCraving': 'post --craving',
    'nav.postCandy': 'post --candy',
    'theme': 'Theme',
    'chooseTheme': 'Choose Theme',
    'cart': 'Cart',
    'login': 'Login',
    'logout': 'Sign Out',
    'collapse': 'Collapse',
    'expand': 'Expand',
    'lightMode': 'Light Mode',
    'darkMode': 'Dark Mode',
    'language': 'Language',

    // Theme names
    'theme.indigo': 'Indigo',
    'theme.blue': 'Ocean',
    'theme.emerald': 'Emerald',
    'theme.amber': 'Sunset',
    'theme.rose': 'Rose',
    'theme.violet': 'Purple',

    // Theme descriptions
    'theme.indigo.desc': 'Professional & Modern',
    'theme.blue.desc': 'Calm & Trustworthy',
    'theme.emerald.desc': 'Fresh & Natural',
    'theme.amber.desc': 'Warm & Energetic',
    'theme.rose.desc': 'Bold & Vibrant',
    'theme.violet.desc': 'Creative & Elegant',

    // Hero
    'hero.tagline': 'AI is simple like candy',
    'hero.subtitle': 'Powerful AI skills at your fingertips. Simple, accessible, and ready to use. No complexity, just results.',
    'hero.cli': '> npm install intelligence',
    'hero.browseSkills': 'Browse Skills',
    'hero.docs': 'Documentation',
    'hero.activeSkills': 'Active Skills',
    'hero.ready': 'Ready',
    'hero.comment': '// simple as candy',
    'hero.skillsAvailable': 'skills',
    'hero.categoriesCount': 'categories',

    // Hero Normal Mode
    'hero.badge': 'Trusted by 5,000+ happy users',
    'hero.title': 'Discover Amazing',
    'hero.title2': 'AI Skills',
    'hero.subtitleNormal': 'Enhance your productivity and creativity with our curated collection of AI-powered skills.',
    'hero.exploreBtn': 'Explore Skills',
    'hero.learnMoreBtn': 'Learn More',
    'hero.feature1.title': 'Smart AI Skills',
    'hero.feature1.description': 'Discover intelligent AI capabilities tailored for you',
    'hero.feature2.title': 'Lightning Fast',
    'hero.feature2.description': 'Instant deployment and execution of your skills',
    'hero.feature3.title': 'User Friendly',
    'hero.feature3.description': 'Simple and intuitive interface for everyone',

    // Categories
    'categories.title': 'Skill Directories',
    'categories.subtitle': 'Explore our curated collections of AI agent skills specialized for your workflow.',
    'categories.allSkills': 'All Skills',

    // Skills Grid
    'skills.noSkillsTitle': 'No skills found',
    'skills.noResultsSearch': 'No results match "{query}". Try a different search term or browse all categories.',
    'skills.noResultsFilter': 'No skills match the selected filter.',
    'skills.clearSearch': 'Clear search',
    'skills.showAll': 'Show all skills',
    'skills.freshlyBaked': 'Freshly Baked Skills',
    'skills.categoryModules': '{category} Modules',
    'skills.search': 'Search skills... (⌘K)',
    'skills.loadingMore': 'Loading more skills...',
    'skills.noResults': 'No skills found matching "{query}" :(',
    'skills.inBag': 'In Bag',
    'skills.add': 'Add',
    'skills.addToBag': 'Add {name} to bag',
    'skills.removeFromBag': 'Remove {name} from bag',
    'skills.runSkill': 'Run skill',
    'skills.likeSkill': 'Like skill',
    'skills.unlikeSkill': 'Unlike skill',
    'skills.updatedToday': 'Updated today',
    'skills.trySearching': 'Try searching for:',

    // Sidebar User Mode labels
    'nav.find.user': 'Browse',
    'nav.cd.user': 'Categories',
    'nav.man.user': 'Docs',
    'nav.create.user': 'Create Candy',
    'nav.library.user': 'Library',
    'nav.candy.user': 'Find Candy',
    'nav.craving.user': 'Find Craving',
    'nav.postCraving.user': 'Post Craving',
    'nav.postCandy.user': 'Post Candy',

    // External Resources
    'external.title': 'Community Skills (External)',
    'external.anthropic': 'Anthropic Skills',
    'external.anthropicDesc': 'Official Agent Skills from Anthropic. The gold standard for extending Claude.',
    'external.obra': 'Obra Superpowers',
    'external.obraDesc': 'Core skills library to make Claude Code smarter, focused on TDD and planning.',
    'external.awesome': 'Awesome Claude Skills',
    'external.awesomeDesc': 'Curated list of best community-driven skills and prompts.',

    // FAQ
    'faq.title': '# Frequently Asked Questions',
    'faq.q1': 'What is an AI skill?',
    'faq.a1': 'An AI skill is a reusable prompt instruction (defined in a `SKILL.md` file) that gives your AI agent specialized capabilities — like code review, writing, or design — without any custom code.',
    'faq.q2': 'How do I use a skill from the marketplace?',
    'faq.a2': 'Browse or search for a skill, click **Run** to execute it directly in the built-in agent, or copy the install command to add it to your own Claude Code / AI workflow.',
    'faq.q3': 'Can I create and publish my own skills?',
    'faq.a3': 'Yes! Go to the **Create** page to build a skill with a name, description, and system prompt. Community contributions are welcome — just submit a PR on GitHub.',
    'faq.q4': 'Is Candy Shop free and open source?',
    'faq.a4': 'Absolutely. Candy Shop is 100% open source under MIT license. You can self-host it, contribute skills, or fork it for your own team.',

    // Footer
    'footer.tagline': 'AI is simple like candy',
    'footer.backToTop': 'Back to top',
    'footer.description': 'Discover amazing AI skills to enhance your productivity and creativity.',

    // Navigation Normal Mode
    'nav.features': 'Features',
    'nav.skills': 'Skills',
    'nav.faq': 'FAQ',
  },
  zh: {
    // Sidebar
    'nav.find': '搜索糖果',
    'nav.cd': '浏览分类',
    'nav.man': '使用指南',
    'nav.create': '创建技能',
    'nav.library': '我的技能',
    'nav.candy': '找糖果',
    'nav.craving': '找渴望',
    'nav.postCraving': '发布需求',
    'nav.postCandy': '发布技能',
    'theme': '主题',
    'chooseTheme': '选择主题',
    'cart': '购物车',
    'login': '登录',
    'logout': '退出',
    'collapse': '收起',
    'expand': '展开',
    'lightMode': '浅色模式',
    'darkMode': '深色模式',
    'language': '语言',

    // Theme names
    'theme.indigo': '靛蓝',
    'theme.blue': '海洋',
    'theme.emerald': '翠绿',
    'theme.amber': '日落',
    'theme.rose': '玫瑰',
    'theme.violet': '紫色',

    // Theme descriptions
    'theme.indigo.desc': '专业现代',
    'theme.blue.desc': '冷静可信',
    'theme.emerald.desc': '清新自然',
    'theme.amber.desc': '温暖活力',
    'theme.rose.desc': '大胆鲜艳',
    'theme.violet.desc': '创意优雅',

    // Hero
    'hero.tagline': 'AI 简单如糖果',
    'hero.subtitle': '强大的 AI 技能触手可及。简单、易用、随时可用。没有复杂，只有结果。',
    'hero.cli': '> npm 安装 智能',
    'hero.browseSkills': '浏览技能',
    'hero.docs': '使用文档',
    'hero.activeSkills': '活跃技能',
    'hero.ready': '就绪',
    'hero.comment': '// 简单如糖果',
    'hero.skillsAvailable': '个技能',
    'hero.categoriesCount': '个分类',

    // Hero Normal Mode
    'hero.badge': '被5,000+用户信赖',
    'hero.title': '发现',
    'hero.title2': '精彩的AI技能',
    'hero.subtitleNormal': '通过我们精心策划的AI技能集合，提升您的生产力和创造力。',
    'hero.exploreBtn': '探索技能',
    'hero.learnMoreBtn': '了解更多',
    'hero.feature1.title': '智能AI技能',
    'hero.feature1.description': '发现为您量身定制的智能AI功能',
    'hero.feature2.title': '闪电般快速',
    'hero.feature2.description': '即时部署和执行您的技能',
    'hero.feature3.title': '用户友好',
    'hero.feature3.description': '简单直观的界面，适合每个人',

    // Categories
    'categories.title': '技能目录',
    'categories.subtitle': '探索我们精心策划的 AI 代理技能集合，专为您的工作流程而设。',
    'categories.allSkills': '全部技能',

    // Skills Grid
    'skills.noSkillsTitle': '未找到技能',
    'skills.noResultsSearch': '没有匹配 "{query}" 的结果。请尝试不同的搜索词或浏览所有分类。',
    'skills.noResultsFilter': '没有技能匹配所选筛选条件。',
    'skills.clearSearch': '清除搜索',
    'skills.showAll': '显示全部技能',
    'skills.freshlyBaked': '新鲜出炉的技能',
    'skills.categoryModules': '{category} 模块',
    'skills.search': '搜索技能... (⌘K)',
    'skills.loadingMore': '正在加载更多技能...',
    'skills.noResults': '没有找到匹配 "{query}" 的技能 :(',
    'skills.inBag': '已添加',
    'skills.add': '添加',
    'skills.addToBag': '将 {name} 加入购物车',
    'skills.removeFromBag': '将 {name} 移出购物车',
    'skills.runSkill': '运行技能',
    'skills.likeSkill': '喜欢技能',
    'skills.unlikeSkill': '取消喜欢',
    'skills.updatedToday': '今日更新',
    'skills.trySearching': '试试搜索：',

    // Sidebar User Mode labels
    'nav.find.user': '浏览',
    'nav.cd.user': '分类',
    'nav.man.user': '文档',
    'nav.create.user': '创建糖果',
    'nav.library.user': '技能库',
    'nav.candy.user': '找糖果',
    'nav.craving.user': '找渴望',
    'nav.postCraving.user': '发布需求',
    'nav.postCandy.user': '发布糖果',

    // External Resources
    'external.title': '社区技能 (外部资源)',
    'external.anthropic': 'Anthropic 技能',
    'external.anthropicDesc': '来自 Anthropic 的官方代理技能。扩展 Claude 的黄金标准。',
    'external.obra': 'Obra 超能力',
    'external.obraDesc': '让 Claude Code 更智能的核心技能库，专注于 TDD 和规划。',
    'external.awesome': '精选 Claude 技能',
    'external.awesomeDesc': '最佳社区驱动技能和提示的精选列表。',

    // FAQ
    'faq.title': '# 常见问题',
    'faq.q1': '什么是 AI 技能？',
    'faq.a1': 'AI 技能是一个可复用的提示指令（定义在 `SKILL.md` 文件中），能赋予 AI 代理专业能力——如代码审查、写作或设计——无需编写任何代码。',
    'faq.q2': '如何使用市场中的技能？',
    'faq.a2': '浏览或搜索技能，点击 **运行** 即可在内置代理中直接执行，也可以复制安装命令将其添加到你自己的 Claude Code / AI 工作流中。',
    'faq.q3': '可以创建和发布自己的技能吗？',
    'faq.a3': '当然可以！前往 **创建** 页面，填写名称、描述和系统提示词即可构建技能。欢迎社区贡献——在 GitHub 上提交 PR 即可。',
    'faq.q4': 'Candy Shop 是免费开源的吗？',
    'faq.a4': '是的。Candy Shop 基于 MIT 许可证 100% 开源。你可以自行部署、贡献技能或 Fork 用于自己的团队。',

    // Footer
    'footer.tagline': 'AI 简单如糖果',
    'footer.backToTop': '返回顶部',
    'footer.description': '发现令人惊叹的AI技能，提升您的生产力和创造力。',

    // Navigation Normal Mode
    'nav.features': '功能',
    'nav.skills': '技能',
    'nav.faq': '常见问题',
  },
};

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => {
    const saved = localStorage.getItem('language');
    return (saved === 'en' || saved === 'zh') ? saved : 'en';
  });

  useEffect(() => {
    localStorage.setItem('language', language);
  }, [language]);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
  };

  const t = (key: string, params?: Record<string, string | number>): string => {
    let text = translations[language][key] || key;
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        text = text.replace(`{${k}}`, String(v));
      });
    }
    return text;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within LanguageProvider');
  }
  return context;
}
