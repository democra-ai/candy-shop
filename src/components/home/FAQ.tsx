import { FileIcon, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { cn } from '../../utils/cn';

export function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);
  const { t } = useLanguage();

  const faqs = [
    { qKey: 'faq.q1', aKey: 'faq.a1' },
    { qKey: 'faq.q2', aKey: 'faq.a2' },
    { qKey: 'faq.q3', aKey: 'faq.a3' },
    { qKey: 'faq.q4', aKey: 'faq.a4' },
  ];

  return (
    <section className="py-20 bg-background below-fold">
      <div className="container max-w-4xl mx-auto px-4">
        <div className="bg-card rounded-3xl border border-border shadow-candy-2 dark:shadow-candy-2-dark overflow-hidden">
          <div className="h-11 bg-secondary/60 border-b border-border flex items-center px-4 gap-2">
            <span className="flex gap-1.5" aria-hidden="true">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-400/70" />
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400/70" />
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400/70" />
            </span>
            <span className="flex items-center gap-1.5 ml-2 text-sm font-mono text-foreground-secondary">
              <FileIcon className="w-3.5 h-3.5" />
              FAQ.md
            </span>
          </div>

          <div className="p-8">
            <h2 className="text-3xl font-candy font-bold mb-8 text-foreground border-b border-border pb-4">
              {t('faq.title')}
            </h2>

            <div className="space-y-4" role="list">
              {faqs.map((faq, i) => {
                const isOpen = openIndex === i;
                return (
                  <div
                    key={i}
                    className={cn(
                      'border rounded-2xl overflow-hidden transition-colors duration-200',
                      isOpen ? 'border-primary/30' : 'border-border'
                    )}
                    role="listitem"
                  >
                    <button
                      onClick={() => setOpenIndex(isOpen ? null : i)}
                      className="w-full flex items-center gap-3 p-4 text-left hover:bg-secondary/50 transition-colors duration-200 font-mono text-sm cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-inset"
                      aria-expanded={isOpen}
                      aria-label={`${t(faq.qKey)} — ${isOpen ? 'collapse' : 'expand'}`}
                    >
                      <ChevronRight
                        className={cn(
                          'w-4 h-4 shrink-0 transition-transform duration-300',
                          isOpen ? 'rotate-90 text-primary' : 'text-foreground-tertiary'
                        )}
                      />
                      <span className="text-foreground font-bold">
                        ## {i + 1}. {t(faq.qKey)}
                      </span>
                    </button>

                    <div
                      className={cn(
                        'grid transition-all duration-300 ease-in-out',
                        isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
                      )}
                    >
                      <div className="overflow-hidden">
                        <div className="px-4 pb-4 pl-11 text-foreground-secondary text-sm leading-relaxed border-t border-border bg-secondary/30 pt-4 font-body">
                          {t(faq.aKey)}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
