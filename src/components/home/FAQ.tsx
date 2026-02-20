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
    <section className="py-20 bg-background">
      <div className="container max-w-4xl mx-auto px-4">
        <div className="bg-card rounded-xl border border-primary/20 shadow-lg overflow-hidden">
          <div className="h-10 bg-primary/10 border-b border-primary/20 flex items-center px-4 gap-2">
            <FileIcon className="w-4 h-4 text-primary" />
            <span className="text-sm font-mono text-foreground">FAQ.md</span>
          </div>

          <div className="p-8">
            <h2 className="text-3xl font-candy font-bold mb-8 text-primary border-b border-primary/10 pb-4">
              {t('faq.title')}
            </h2>

            <div className="space-y-4" role="list">
              {faqs.map((faq, i) => {
                const isOpen = openIndex === i;
                return (
                  <div key={i} className="border border-primary/10 rounded-lg overflow-hidden" role="listitem">
                    <button
                      onClick={() => setOpenIndex(isOpen ? null : i)}
                      className="w-full flex items-center gap-3 p-4 text-left hover:bg-primary/10 transition-colors duration-200 font-mono text-sm cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/30 focus:ring-inset"
                      aria-expanded={isOpen}
                      aria-label={`${t(faq.qKey)} — ${isOpen ? 'collapse' : 'expand'}`}
                    >
                      <ChevronRight
                        className={cn(
                          'w-4 h-4 shrink-0 transition-transform duration-300',
                          isOpen ? 'rotate-90 text-primary' : 'text-foreground-secondary'
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
                        <div className="px-4 pb-4 pl-11 text-foreground-secondary text-sm leading-relaxed border-t border-primary/10 bg-primary/5 pt-4 font-body">
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
