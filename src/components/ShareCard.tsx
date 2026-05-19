"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
    <Card className="rounded-2xl shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
            <Link2 className="h-4 w-4 text-primary" />
          </div>
          Share Link Ready
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex items-center gap-2">
          <input
            type="text"
            readOnly
            value={shareUrl}
            className="flex-1 rounded-lg border bg-muted/50 px-3 py-2.5 text-sm font-mono"
          />
          <Button onClick={handleCopy} size="sm">
            {copied ? (
              <Check className="mr-1.5 h-4 w-4" />
            ) : (
              <Copy className="mr-1.5 h-4 w-4" />
            )}
            {copied ? "Copied" : "Copy"}
          </Button>
        </div>

        <div className="flex justify-center py-2">
          <div className="rounded-xl bg-muted/50 p-3">
            <QRCodeSVG value={shareUrl} size={160} level="M" />
          </div>
        </div>

        <p className="text-center text-sm text-muted-foreground">
          Token: <code className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-xs">{token}</code>
        </p>
      </CardContent>
    </Card>
  );
}
