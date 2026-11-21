"use client";

/**
 * Animated three-dot typing indicator shown while the AI is generating.
 * Uses pure CSS animation — no JS timers.
 */
export default function TypingIndicator() {
  return (
    <div className="flex items-start gap-2.5 px-4 py-1">
      {/* Avatar dot matching assistant bubble style */}
      <div className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10">
        <span className="text-[10px]">AI</span>
      </div>
      <div className="rounded-2xl rounded-tl-sm bg-muted px-4 py-3">
        <div className="flex items-center gap-1">
          <span
            className="h-2 w-2 rounded-full bg-muted-foreground/50 animate-bounce"
            style={{ animationDelay: "0ms", animationDuration: "900ms" }}
          />
          <span
            className="h-2 w-2 rounded-full bg-muted-foreground/50 animate-bounce"
            style={{ animationDelay: "180ms", animationDuration: "900ms" }}
          />
          <span
            className="h-2 w-2 rounded-full bg-muted-foreground/50 animate-bounce"
            style={{ animationDelay: "360ms", animationDuration: "900ms" }}
          />
        </div>
      </div>
    </div>
  );
}
