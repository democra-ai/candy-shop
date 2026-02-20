import { ExternalLink, Github, Zap, Rocket } from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';

const EXTERNAL_LINKS = [
  {
    nameKey: 'external.anthropic',
    descriptionKey: 'external.anthropicDesc',
    url: 'https://github.com/anthropics/claude-skills',
    icon: <Github className="w-5 h-5 text-foreground-secondary" />,
    color: 'border-border hover:border-primary',
  },
  {
    nameKey: 'external.obra',
    descriptionKey: 'external.obraDesc',
    url: 'https://github.com/obra/superpowers',
    icon: <Zap className="w-5 h-5 text-warning" />,
    color: 'border-border hover:border-warning',
  },
  {
    nameKey: 'external.awesome',
    descriptionKey: 'external.awesomeDesc',
    url: 'https://github.com/ClaudioHQ/awesome-claude-skills',
    icon: <Rocket className="w-5 h-5 text-primary" />,
    color: 'border-border hover:border-primary',
  },
];

export function ExternalResources() {
  const { t } = useLanguage();

  return (
    <section className="py-20 bg-secondary/30 border-t border-border below-fold">
      <div className="container max-w-7xl mx-auto px-4">
        <h2 className="text-2xl font-bold mb-8 font-candy flex items-center gap-3 text-foreground">
          <ExternalLink className="w-6 h-6 text-primary" />
          <span>{t('external.title')}</span>
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {EXTERNAL_LINKS.map((link, i) => (
            <a
              key={i}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className={`group bg-card p-6 rounded-xl border shadow-sm transition-all duration-200 hover:shadow-md flex items-start gap-4 cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/30 ${link.color}`}
              aria-label={`${t(link.nameKey)} - opens in new tab`}
            >
              <div className="mt-1 shrink-0">{link.icon}</div>
              <div>
                <h3 className="font-bold text-foreground group-hover:text-primary transition-colors duration-200 flex items-center gap-2">
                  {t(link.nameKey)}
                  <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
                </h3>
                <p className="text-sm text-foreground-secondary mt-2 leading-relaxed">{t(link.descriptionKey)}</p>
              </div>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
