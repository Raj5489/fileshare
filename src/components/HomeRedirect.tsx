"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowser } from "@/lib/supabase";

// The homepage is statically prerendered so it can be cached at the edge.
// Redirect signed-in users to their dashboard client-side instead of doing a
// server-side auth lookup (which would force dynamic rendering on every visit).
export default function HomeRedirect() {
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    getSupabaseBrowser()
      .auth.getSession()
      .then(({ data }) => {
        if (!cancelled && data.session?.user) {
          router.replace("/dashboard");
        }
      })
      .catch(() => {
        // No session / network error — just show the landing page.
      });
    return () => {
      cancelled = true;
    };
  }, [router]);

  return null;
}
