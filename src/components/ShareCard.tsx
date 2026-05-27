"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Copy, Check, Link2 } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";

interface ShareCardProps {
  shareUrl: string;
  token: string;
}

export default function ShareCard({ shareUrl, token }: ShareCardProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast.success("Link copied to clipboard!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy link.");
    }
  }

  return (
    <div className="relative overflow-hidden rounded-2xl border bg-card shadow-md shadow-black/5 w-full">
      {/* Top accent */}
      <div className="h-1 w-full bg-gradient-to-r from-primary/40 via-primary to-violet-500/60" />

      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-4 pb-3 border-b bg-muted/20">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Link2 className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold">Share Link Ready</p>
          <p className="text-xs text-muted-foreground truncate">
            Anyone with this link can access the file
          </p>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* URL + Copy — stacks on tiny screens */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          {/* URL display */}
          <div className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border bg-muted/40 px-3 py-2">
            <span className="min-w-0 flex-1 truncate text-xs font-mono text-foreground/70 leading-relaxed">
              {shareUrl}
            </span>
          </div>
          {/* Copy button — full width on mobile, auto on sm+ */}
          <Button
            onClick={handleCopy}
            size="sm"
            className={`w-full sm:w-auto shrink-0 gap-2 transition-all ${
              copied
                ? "bg-emerald-500 hover:bg-emerald-500 text-white"
                : "btn-shimmer text-white"
            }`}
          >
            {copied ? (
              <Check className="h-4 w-4" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
            {copied ? "Copied!" : "Copy Link"}
          </Button>
        </div>

        {/* QR code */}
        <div className="flex flex-col items-center gap-2">
          <div className="relative rounded-2xl border bg-white p-3 shadow-sm">
            <div className="absolute top-2 left-2 h-3 w-3 border-t-2 border-l-2 border-primary/40 rounded-tl" />
            <div className="absolute top-2 right-2 h-3 w-3 border-t-2 border-r-2 border-primary/40 rounded-tr" />
            <div className="absolute bottom-2 left-2 h-3 w-3 border-b-2 border-l-2 border-primary/40 rounded-bl" />
            <div className="absolute bottom-2 right-2 h-3 w-3 border-b-2 border-r-2 border-primary/40 rounded-br" />
            <QRCodeSVG value={shareUrl} size={140} level="M" />
          </div>
          <p className="text-xs text-muted-foreground">
            Scan to open on mobile
          </p>
        </div>

        {/* Token */}
        <div className="flex items-center justify-center gap-2 rounded-xl bg-muted/40 px-4 py-2">
          <span className="text-xs text-muted-foreground">Token</span>
          <code className="rounded-md bg-background border px-2 py-0.5 font-mono text-xs font-medium">
            {token}
          </code>
        </div>
      </div>
    </div>
  );
}
