import { useEffect, useRef, useState } from "react";
import { Bot, Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { logEvent } from "@/lib/analytics";
import { event } from "@/data/event";
import robotSprite from "@/assets/robot-wave.webp";

const EXAMPLES = ["Which talks cover log files?", "Where can I get coffee near the venue?", "What's on my schedule Thursday?"];
const WAVE_EVERY = 15000; // ms between waves

/**
 * The robot on the button. Its wave was rendered from a small Three.js model
 * into a strip of frames (src/assets/robot-wave.webp; the model is in this
 * file's git history), so pages show it instantly without loading WebGL.
 * It waves hello once per visit, then now and then, and when hovered. With
 * reduced motion it holds still, mid-wave (see .robot in global.css).
 */
function WavingRobot({ wave }: { wave: React.MutableRefObject<(() => void) | null> }) {
  const robot = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = robot.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const play = () => el.classList.add("robot-waving");
    const done = () => el.classList.remove("robot-waving");
    el.addEventListener("animationend", done);
    wave.current = play;
    let hello = 0;
    try {
      if (!sessionStorage.getItem("tsc_robot_waved")) {
        sessionStorage.setItem("tsc_robot_waved", "1");
        hello = window.setTimeout(play, 700);
      }
    } catch {}
    const timer = window.setInterval(play, WAVE_EVERY);
    return () => {
      clearTimeout(hello);
      clearInterval(timer);
      el.removeEventListener("animationend", done);
      wave.current = null;
    };
  }, [wave]);

  return <span ref={robot} className="robot block h-10 w-10 shrink-0" style={{ backgroundImage: `url(${robotSprite.src})` }} aria-hidden="true" />;
}

/** "For AI bots": the MCP server's URL and how to add it to Claude or another assistant. */
export default function AiBotsButton() {
  // The URL of this deployment's MCP server (the review site before launch).
  const [mcpUrl, setMcpUrl] = useState(`${event.appUrl}/mcp`);
  const [copied, setCopied] = useState(false);
  const wave = useRef<(() => void) | null>(null);
  useEffect(() => setMcpUrl(`${location.origin}/mcp`), []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(mcpUrl);
    } catch {
      // Clipboard blocked: the field is selectable, so people can copy by hand.
      return;
    }
    logEvent("mcp_url_copy");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog onOpenChange={(open) => open && logEvent("mcp_modal_open")}>
      <DialogTrigger asChild>
        {/* A labelled pill, so it reads as its own button next to the account picture. */}
        <Button
          variant="outline"
          size="sm"
          className="h-11 gap-0.5 rounded-full pl-0.5 pr-3 text-xs font-medium text-foreground sm:text-sm"
          onMouseEnter={() => wave.current?.()}
          data-testid="button-ai-bots"
        >
          <WavingRobot wave={wave} />
          For AI bots
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-lg" data-testid="dialog-ai-bots">
        <DialogHeader className="text-left sm:text-left">
          <div className="mb-1 flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Bot className="h-5 w-5" />
          </div>
          <DialogTitle className="text-xl">Bring {event.name} into your AI assistant</DialogTitle>
          <DialogDescription className="leading-relaxed">
            Connect Claude, ChatGPT or any assistant that supports MCP. Ask about talks, speakers, sponsors and places to eat, drink and stay.
            Sign in when it asks, and it can see and update your My Conference list and, once you've joined Meet, find people who share your
            topics.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div>
            <label htmlFor="mcp-url" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              MCP server URL
            </label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                id="mcp-url"
                readOnly
                size={1}
                value={mcpUrl}
                onFocus={(e) => e.currentTarget.select()}
                className="min-h-11 min-w-0 flex-1 rounded-md border border-input bg-muted/40 px-3 font-mono text-sm text-foreground"
                data-testid="input-mcp-url"
              />
              <Button onClick={copy} className="min-h-11 shrink-0 gap-1.5 sm:w-24" data-testid="button-copy-mcp-url">
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>
          </div>

          <div>
            <h3 className="mb-2 text-sm font-semibold text-foreground">In Claude</h3>
            <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
              <li>
                Open <span className="text-foreground">Settings → Connectors</span> and choose <span className="text-foreground">Add custom connector</span>.
              </li>
              <li>Paste the URL above and add it.</li>
              <li>Sign in with your {event.name} account when asked.</li>
            </ol>
            <p className="mt-2 text-sm text-muted-foreground">Other assistants: add it as a remote MCP server.</p>
          </div>

          <div>
            <h3 className="mb-2 text-sm font-semibold text-foreground">Try asking</h3>
            <div className="flex flex-wrap gap-2">
              {EXAMPLES.map((example) => (
                <span key={example} className="rounded-full border border-border bg-card px-3 py-1 text-xs text-foreground">
                  {example}
                </span>
              ))}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
