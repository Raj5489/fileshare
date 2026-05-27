"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getSupabaseBrowser } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { User, LogOut, UploadCloud, Loader2, Download } from "lucide-react";

export default function Navbar() {
  const [user, setUser] = useState<{ email?: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState("");

  // Receive file states
  const [receiveCode, setReceiveCode] = useState("");
  const [receiveError, setReceiveError] = useState("");
  const [receiveOpen, setReceiveOpen] = useState(false);

  const router = useRouter();

  const routerRef = useRef(router);
  useEffect(() => {
    routerRef.current = router;
  }, [router]);

  useEffect(() => {
    // onAuthStateChange fires an INITIAL_SESSION event on mount, which covers
    // the post-OAuth-redirect case.
    const { data: listener } = getSupabaseBrowser().auth.onAuthStateChange(
      (event, session) => {
        setUser(session?.user ? { email: session.user.email } : null);
        setLoading(false);
        // After Google/GitHub OAuth redirect the SIGNED_IN event fires here.
        // Calling router.refresh() syncs the Next.js server cache so protected
        // routes and server components see the new session immediately.
        if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
          routerRef.current.refresh();
        }
      },
    );

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  async function handleAuth(e: React.FormEvent) {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError("");

    try {
      if (authMode === "login") {
        const { error } = await getSupabaseBrowser().auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
      } else {
        const { error } = await getSupabaseBrowser().auth.signUp({
          email,
          password,
        });
        if (error) throw error;
      }
      setAuthOpen(false);
      setEmail("");
      setPassword("");
      router.refresh();
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Authentication failed.";
      setAuthError(message);
    } finally {
      setAuthLoading(false);
    }
  }

  async function handleOAuth(provider: "google" | "github") {
    setAuthLoading(true);
    const { error } = await getSupabaseBrowser().auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) {
      setAuthError(error.message);
      setAuthLoading(false);
    }
  }

  async function handleLogout() {
    await getSupabaseBrowser().auth.signOut();
    router.push("/");
    router.refresh();
  }

  function handleReceiveSubmit(e: React.FormEvent) {
    e.preventDefault();
    setReceiveError("");

    let token = receiveCode.trim();
    if (!token) {
      setReceiveError("Please enter a code or link.");
      return;
    }

    if (token.includes("/")) {
      try {
        const urlStr = token.startsWith("http") ? token : `http://${token}`;
        const url = new URL(urlStr);
        const pathParts = url.pathname.split("/").filter(Boolean);

        // Check for collection URL: /c/[token]
        const cIndex = pathParts.indexOf("c");
        if (cIndex !== -1 && pathParts[cIndex + 1]) {
          setReceiveOpen(false);
          setReceiveCode("");
          router.push(`/c/${pathParts[cIndex + 1]}`);
          return;
        }

        // Check for file URL: /f/[token]
        const fIndex = pathParts.indexOf("f");
        if (fIndex !== -1 && pathParts[fIndex + 1]) {
          token = pathParts[fIndex + 1];
        } else {
          const lastPart = pathParts.pop();
          if (lastPart) token = lastPart;
        }
      } catch {
        const parts = token.split("/");
        const lastPart = parts.filter(Boolean).pop();
        if (lastPart) token = lastPart;
      }
    }

    const tokenRegex = /^[a-z0-9]+$/;
    if (!tokenRegex.test(token)) {
      setReceiveError("Invalid character in share code.");
      return;
    }

    setReceiveOpen(false);
    setReceiveCode("");
    router.push(`/f/${token}`);
  }

  return (
    <nav className="sticky top-0 z-50 border-b bg-card/80 backdrop-blur-md px-6 py-3">
      <div className="mx-auto flex max-w-6xl items-center justify-between">
        <Link
          href={user ? "/dashboard" : "/"}
          className="flex items-center gap-2.5 text-xl font-bold tracking-tight"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <UploadCloud className="h-5 w-5" />
          </div>
          <span>FileShare</span>
        </Link>

        <div className="flex items-center gap-2">
          <Dialog open={receiveOpen} onOpenChange={setReceiveOpen}>
            <DialogTrigger>
              <Button variant="outline" size="sm" className="gap-2">
                <Download className="h-4 w-4" />
                Receive File
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Receive File</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleReceiveSubmit} className="space-y-4">
                {receiveError && (
                  <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                    {receiveError}
                  </p>
                )}
                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    Share Code or URL
                  </label>
                  <Input
                    placeholder="e.g. a1b2c3 or https://.../f/a1b2c3"
                    value={receiveCode}
                    onChange={(e) => setReceiveCode(e.target.value)}
                    required
                  />
                </div>
                <Button type="submit" className="w-full">
                  Go to File
                </Button>
              </form>
            </DialogContent>
          </Dialog>

          {loading ? (
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          ) : user ? (
            <>
              <DropdownMenu>
                <DropdownMenuTrigger>
                  <Button variant="ghost" size="sm" className="gap-2">
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10">
                      <User className="h-3.5 w-3.5 text-primary" />
                    </div>
                    <span className="max-w-[120px] truncate">
                      {user.email?.split("@")[0] || "Account"}
                    </span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={handleLogout}>
                    <LogOut className="mr-2 h-4 w-4" />
                    Logout
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            <Dialog open={authOpen} onOpenChange={setAuthOpen}>
              <DialogTrigger>
                <Button size="sm">Login / Sign Up</Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>
                    {authMode === "login" ? "Login" : "Sign Up"}
                  </DialogTitle>
                </DialogHeader>
                <form onSubmit={handleAuth} className="space-y-4">
                  {authError && (
                    <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                      {authError}
                    </p>
                  )}
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Email</label>
                    <Input
                      type="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Password</label>
                    <Input
                      type="password"
                      placeholder="Enter your password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                  </div>
                  <Button
                    type="submit"
                    className="w-full"
                    disabled={authLoading}
                  >
                    {authLoading ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : authMode === "login" ? (
                      "Login"
                    ) : (
                      "Sign Up"
                    )}
                  </Button>
                </form>
                <div className="flex flex-col gap-2">
                  <Button
                    variant="outline"
                    onClick={() => handleOAuth("google")}
                    disabled={authLoading}
                  >
                    Continue with Google
                  </Button>
                </div>
                <p className="text-center text-sm text-muted-foreground">
                  {authMode === "login"
                    ? "Don't have an account?"
                    : "Already have an account?"}{" "}
                  <button
                    type="button"
                    onClick={() =>
                      setAuthMode(authMode === "login" ? "signup" : "login")
                    }
                    className="text-primary font-medium hover:underline"
                  >
                    {authMode === "login" ? "Sign Up" : "Login"}
                  </button>
                </p>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>
    </nav>
  );
}
