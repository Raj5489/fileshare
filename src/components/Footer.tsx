import { Github, Linkedin } from "lucide-react";

export default function Footer() {
  return (
    <footer className="border-t px-6 py-5">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 sm:flex-row">
        <p className="text-xs text-muted-foreground">
          © {new Date().getFullYear()} FileShare. All rights reserved.
        </p>
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          Built by{" "}
          <span className="font-medium text-foreground">Raj Parmar</span>
          <span className="mx-1 text-muted-foreground/40">·</span>
          <a
            href="https://github.com/Raj5489"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 hover:text-foreground transition-colors"
            aria-label="GitHub"
          >
            <Github className="h-3.5 w-3.5" />
            GitHub
          </a>
          <span className="mx-1 text-muted-foreground/40">·</span>
          <a
            href="https://www.linkedin.com/in/raj-parmar-22261934b"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 hover:text-foreground transition-colors"
            aria-label="LinkedIn"
          >
            <Linkedin className="h-3.5 w-3.5" />
            LinkedIn
          </a>
        </p>
      </div>
    </footer>
  );
}
