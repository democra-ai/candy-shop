import { useLanguage } from '../../contexts/LanguageContext';

export function Footer() {
  const { t } = useLanguage();

  return (
    <footer className="relative mt-20">
      <div className="h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent" />
      <div className="glass-strong">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {/* Brand */}
            <div className="lg:col-span-1">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-2xl">🍬</span>
                <span className="font-bold text-lg font-candy candy-gradient-text">Candy Shop</span>
              </div>
              <p className="text-sm text-foreground-secondary leading-relaxed">
                {t('footer.tagline')}
              </p>
            </div>

            {/* Product */}
            <div>
              <h4 className="text-sm font-semibold text-foreground mb-3">Product</h4>
              <ul className="space-y-2">
                <li>
                  <a href="/discover" className="text-sm text-foreground-secondary hover:text-primary transition-colors">
                    Discover Skills
                  </a>
                </li>
                <li>
                  <a href="/discover?tab=craving" className="text-sm text-foreground-secondary hover:text-primary transition-colors">
                    Browse Cravings
                  </a>
                </li>
                <li>
                  <a href="/skills/create" className="text-sm text-foreground-secondary hover:text-primary transition-colors">
                    Create a Skill
                  </a>
                </li>
              </ul>
            </div>

            {/* Community */}
            <div>
              <h4 className="text-sm font-semibold text-foreground mb-3">Community</h4>
              <ul className="space-y-2">
                <li>
                  <a
                    href="https://github.com/anthropics/claude-skills"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-foreground-secondary hover:text-primary transition-colors"
                  >
                    GitHub
                  </a>
                </li>
                <li>
                  <a
                    href="https://github.com/ClaudioHQ/awesome-claude-skills"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-foreground-secondary hover:text-primary transition-colors"
                  >
                    Awesome Skills
                  </a>
                </li>
                <li>
                  <a
                    href="https://docs.anthropic.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-foreground-secondary hover:text-primary transition-colors"
                  >
                    Documentation
                  </a>
                </li>
              </ul>
            </div>

            {/* Legal */}
            <div>
              <h4 className="text-sm font-semibold text-foreground mb-3">Legal</h4>
              <ul className="space-y-2">
                <li>
                  <a href="#" className="text-sm text-foreground-secondary hover:text-primary transition-colors">
                    Privacy Policy
                  </a>
                </li>
                <li>
                  <a href="#" className="text-sm text-foreground-secondary hover:text-primary transition-colors">
                    Terms of Service
                  </a>
                </li>
              </ul>
            </div>
          </div>

          {/* Bottom */}
          <div className="mt-10 pt-6 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-sm text-foreground-tertiary">
              <span className="animate-candy-float">🍭</span>
              <span>&copy; {new Date().getFullYear()} Candy Shop. All rights reserved.</span>
            </div>
            <button
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
              className="text-sm text-foreground-tertiary hover:text-primary transition-colors"
            >
              {t('footer.backToTop')} &uarr;
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
}
