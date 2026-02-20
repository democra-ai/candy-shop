import { Terminal } from 'lucide-react';

export function SocialProof() {
  const logs = [
    { time: '10:42:01', user: 'anthropic', cmd: 'claude code --import skillsmp' },
    { time: '10:42:05', user: 'langchain', cmd: 'pip install langchain-skills' },
    { time: '10:42:12', user: 'autogen', cmd: 'agent.load_skills(manifest)' },
    { time: '10:42:18', user: 'openai', cmd: 'import { plugin } from "@skillsmp/gpt"' },
  ];

  return (
    <section className="py-14 relative overflow-hidden below-fold">
      {/* Frosted glass background band */}
      <div className="absolute inset-0 glass" aria-hidden="true" />
      <div className="absolute inset-0 sprinkle-pattern" aria-hidden="true" />

      <div className="relative container max-w-7xl mx-auto px-4">
        <div className="flex flex-col md:flex-row items-start md:items-center gap-8">
          <div className="md:w-1/4">
            <h3 className="text-sm font-body font-bold uppercase tracking-wider text-foreground-secondary mb-2">Trusted By Agents</h3>
            <p className="text-xs text-foreground-tertiary font-body">
              Used by leading autonomous systems and frameworks.
            </p>
          </div>

          <div className="flex-1 w-full overflow-hidden">
             <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
               {logs.map((log, i) => (
                 <div
                   key={i}
                   className="glass rounded-xl p-4 shadow-warm border border-caramel/10 font-mono text-xs truncate hover:shadow-warm-lg hover:border-caramel/20 transition-all duration-300"
                 >
                    <div className="flex items-center gap-2 text-foreground-tertiary mb-1.5 opacity-60">
                      <Terminal className="w-3 h-3" />
                      <span>{log.time}</span>
                    </div>
                    <div className="text-primary truncate">
                      <span className="text-caramel">{log.user}</span> $ {log.cmd}
                    </div>
                 </div>
               ))}
             </div>
          </div>
        </div>
      </div>
    </section>
  );
}
