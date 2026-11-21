"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  error?: boolean;
}

interface ChatBubbleProps {
  message: Message;
}

export default function ChatBubble({ message }: ChatBubbleProps) {
  const isUser = message.role === "user";

  // Render the timestamp only on the client to avoid SSR/client mismatch.
  // The server and client can produce different time strings from the same
  // Date object (timezone, locale, or the few seconds between renders).
  const [timeString, setTimeString] = useState<string>("");
  useEffect(() => {
    setTimeString(
      message.timestamp.toLocaleTimeString("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
      }),
    );
  }, [message.timestamp]);

  return (
    <div
      className={cn(
        "flex items-end gap-2 px-4 py-1",
        isUser ? "flex-row-reverse" : "flex-row",
      )}
    >
      {/* Avatar */}
      {!isUser && (
        <div className="mb-5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10">
          <span className="text-[9px] font-semibold text-primary">AI</span>
        </div>
      )}

      <div
        className={cn(
          "flex max-w-[80%] flex-col gap-1",
          isUser ? "items-end" : "items-start",
        )}
      >
        {/* Bubble */}
        <div
          className={cn(
            "rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
            isUser
              ? "rounded-br-sm bg-primary text-primary-foreground"
              : cn(
                  "rounded-bl-sm bg-muted text-foreground",
                  message.error &&
                    "border border-destructive/30 bg-destructive/5 text-destructive",
                ),
          )}
        >
          <p className="whitespace-pre-wrap break-words">{message.content}</p>
        </div>

        {/* Timestamp */}
        <span className="px-1 text-[10px] text-muted-foreground">
          {timeString}
        </span>
      </div>
    </div>
  );
}
