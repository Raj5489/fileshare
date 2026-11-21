"use client";

const SUGGESTIONS = [
  "How do I upload a file?",
  "How can I share a folder?",
  "My upload is very slow.",
  "My download is not working.",
  "How does file expiry work?",
  "How can I protect my shared file?",
  "How do I contact support?",
];

interface SuggestedQuestionsProps {
  onSelect: (question: string) => void;
  disabled?: boolean;
}

export default function SuggestedQuestions({
  onSelect,
  disabled,
}: SuggestedQuestionsProps) {
  return (
    <div className="flex flex-wrap gap-2 px-4 pb-3">
      {SUGGESTIONS.map((q) => (
        <button
          key={q}
          onClick={() => !disabled && onSelect(q)}
          disabled={disabled}
          className="rounded-full border border-border bg-background px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:bg-primary/5 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
        >
          {q}
        </button>
      ))}
    </div>
  );
}
