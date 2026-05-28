import { BookOpen } from 'lucide-react';
import { ModalShell } from '../ui/ModalShell';
import { Button } from '../ui/Button';

interface DocsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function DocsModal({ isOpen, onClose }: DocsModalProps) {
  return (
    <ModalShell
      open={isOpen}
      onClose={onClose}
      label="Documentation"
      maxWidth="3xl"
      padded={false}
      className="max-h-[85vh]"
    >
      {/* Header band */}
      <div className="h-12 bg-secondary/50 border-b border-border flex items-center px-5 shrink-0">
        <div className="flex items-center gap-2 text-foreground-secondary font-mono text-sm">
          <BookOpen className="w-4 h-4" />
          <span>Menu.md</span>
        </div>
      </div>

      {/* Content */}
      <div className="p-6 sm:p-8 overflow-y-auto prose prose-zinc dark:prose-invert max-w-none prose-headings:font-candy prose-headings:text-foreground prose-p:text-foreground-secondary prose-strong:text-foreground prose-li:text-foreground-secondary prose-code:font-mono">
        <h1 className="font-candy text-3xl sm:text-4xl mb-4 text-foreground">The Menu</h1>
        <p className="lead font-body text-foreground-secondary">
          Welcome to the Candy Shop! Here you can find the sweetest skills for your Claude AI.
        </p>

        <h3 className="flex items-center gap-2 text-foreground">
          <span className="text-xl leading-none" aria-hidden="true">🍭</span>
          What is this?
        </h3>
        <p>
          This is a curated collection of <strong>Model Context Protocol (MCP)</strong> servers.
          Think of them as &ldquo;skills&rdquo; or &ldquo;tools&rdquo; that give Claude new capabilities, like searching
          the web, reading files, or accessing databases.
        </p>

        <h3 className="text-foreground">How to Install</h3>
        <div className="bg-secondary/50 p-4 rounded-xl border border-border not-prose my-6">
          <ol className="list-decimal list-inside space-y-2 font-mono text-sm text-foreground-secondary">
            <li>Browse the shop and add treats to your bag.</li>
            <li>Open your bag (top right).</li>
            <li>
              Click <strong className="text-foreground">Checkout</strong> to copy the merged configuration.
            </li>
            <li>
              Paste it into your{' '}
              <code className="bg-secondary text-foreground px-1.5 py-0.5 rounded text-xs">claude_desktop_config.json</code> file.
            </li>
          </ol>
        </div>

        <h3 className="text-foreground">Config Location</h3>
        <p>You can find your config file at:</p>
        <ul className="not-prose font-mono text-xs bg-secondary border border-border text-foreground-secondary p-4 rounded-xl list-none space-y-2">
          <li>
            <span className="text-primary font-bold">macOS</span>{' '}
            ~/Library/Application Support/Claude/claude_desktop_config.json
          </li>
          <li>
            <span className="text-info font-bold">Windows</span>{' '}
            %APPDATA%\Claude\claude_desktop_config.json
          </li>
        </ul>

        <div className="mt-8 pt-8 border-t border-border text-center not-prose">
          <Button variant="candy" size="lg" onClick={onClose} className="rounded-full px-8 font-semibold">
            Got it, let&rsquo;s shop!
          </Button>
        </div>
      </div>
    </ModalShell>
  );
}
