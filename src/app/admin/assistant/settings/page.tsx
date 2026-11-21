/**
 * /admin/assistant/settings
 * Server component — reads env-driven config at render time.
 * Shows AI provider status, model, and integration health.
 * No secrets are exposed; only names and configured status.
 */
import { getProviderInfo } from "@/lib/assistant/ai-provider";
import { CheckCircle, XCircle, Info } from "lucide-react";

function StatusRow({
  label, ok, detail,
}: { label: string; ok: boolean; detail?: string }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-border last:border-0">
      <div className="flex items-center gap-2">
        {ok
          ? <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />
          : <XCircle    className="h-4 w-4 text-destructive shrink-0" />}
        <span className="text-sm">{label}</span>
      </div>
      {detail && (
        <span className="text-xs font-mono text-muted-foreground">{detail}</span>
      )}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-border last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium">{value}</span>
    </div>
  );
}

export default function SettingsPage() {
  const ai = getProviderInfo();

  const telegramConfigured = Boolean(process.env.TELEGRAM_BOT_TOKEN);
  const adminConfigured    = Boolean(process.env.ADMIN_EMAILS);
  const redisConfigured    = Boolean(process.env.UPSTASH_REDIS_REST_URL);

  return (
    <div className="flex flex-col gap-5 max-w-2xl">
      <div>
        <h1 className="text-xl font-bold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Configuration status read from environment variables. Edit values in your hosting environment or{" "}
          <code className="rounded bg-muted px-1 text-xs">.env.local</code> for local development.
        </p>
      </div>

      {/* AI Provider */}
      <div className="rounded-xl border border-border bg-card p-4">
        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">AI Provider</p>
        <StatusRow label="Groq API key configured" ok={ai.configured} detail={ai.configured ? "set" : "missing GROQ_API_KEY"} />
        <InfoRow   label="Provider"  value={ai.provider} />
        <InfoRow   label="Model"     value={ai.model} />
        <InfoRow   label="Max tokens per response" value="512" />
        <InfoRow   label="Temperature" value="0.3" />
        <InfoRow   label="Request timeout" value="25 s" />
      </div>

      {/* Integrations */}
      <div className="rounded-xl border border-border bg-card p-4">
        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Integrations</p>
        <StatusRow label="Telegram bot configured"  ok={telegramConfigured} detail={telegramConfigured ? "TELEGRAM_BOT_TOKEN set" : "missing"} />
        <StatusRow label="Redis rate limiting"       ok={redisConfigured}    detail={redisConfigured    ? "Upstash connected"    : "disabled (fail-open)"} />
        <StatusRow label="Admin access configured"   ok={adminConfigured}    detail={adminConfigured    ? "ADMIN_EMAILS set"     : "missing — no admin access"} />
      </div>

      {/* Rate limits */}
      <div className="rounded-xl border border-border bg-card p-4">
        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Rate Limits</p>
        <InfoRow label="Chat messages"      value="10 / min / IP" />
        <InfoRow label="Ticket submissions" value="3 / hour / IP" />
        <InfoRow label="Max message length" value="1,000 characters" />
        <InfoRow label="Context window"     value="6 messages (3 turns)" />
        <InfoRow label="KB entries per prompt" value="4 max" />
      </div>

      {/* Chatbot */}
      <div className="rounded-xl border border-border bg-card p-4">
        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Website Chatbot</p>
        <InfoRow label="Widget location"  value="All pages (root layout)" />
        <InfoRow label="Session cookie"   value="fs_chat_session · HttpOnly · 30 days" />
        <InfoRow label="Suggested questions" value="7 preset questions shown on first open" />
      </div>

      {/* How to change */}
      <div className="flex gap-2 rounded-xl border border-border bg-muted/30 p-4 text-xs text-muted-foreground">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <div>
          <p className="font-medium text-foreground">Changing settings</p>
          <p className="mt-0.5">
            All configuration is done via environment variables. Update them in your Vercel project settings
            (Settings → Environment Variables) and redeploy. Never commit secrets to source control.
            See <code className="rounded bg-background px-1">.env.example</code> for the full variable list.
          </p>
        </div>
      </div>
    </div>
  );
}
