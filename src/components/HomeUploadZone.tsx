"use client";

import dynamic from "next/dynamic";

// Lazy-load the full upload widget on the homepage so its heavy deps
// (react-dropzone, jszip, qrcode.react, dialogs) are fetched only when the
// widget is about to be used, instead of blocking the hero / LCP render.
// ssr:false must live in a Client Component (not a Server Component).
const UploadZone = dynamic(() => import("@/components/UploadZone"), {
  ssr: false,
  loading: () => (
    <div className="flex h-40 w-full items-center justify-center rounded-2xl border-2 border-dashed border-border bg-card/40 text-sm text-muted-foreground">
      Drop files here or click to browse
    </div>
  ),
});

export default function HomeUploadZone() {
  return <UploadZone />;
}
