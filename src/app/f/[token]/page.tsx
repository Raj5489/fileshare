import { notFound } from "next/navigation";
import Navbar from "@/components/Navbar";
import SharePageClient from "./SharePageClient";

async function getFileMetadata(token: string) {
  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/files/${token}`,
      { next: { revalidate: 0 } }
    );
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export default async function SharePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const metadata = await getFileMetadata(token);

  if (!metadata || metadata.error) {
    return (
      <div className="flex flex-1 flex-col">
        <Navbar />
        <main className="flex flex-1 flex-col items-center justify-center px-6">
          <div className="text-center">
            <h1 className="text-3xl font-bold tracking-tight">File not found</h1>
            <p className="mt-3 text-muted-foreground">
              The file you are looking for does not exist or has been removed.
            </p>
          </div>
        </main>
      </div>
    );
  }

  if (metadata.is_expired) {
    return (
      <div className="flex flex-1 flex-col">
        <Navbar />
        <main className="flex flex-1 flex-col items-center justify-center px-6">
          <div className="text-center">
            <h1 className="text-3xl font-bold tracking-tight">Link Expired</h1>
            <p className="mt-3 text-muted-foreground">
              This share link has expired and is no longer available.
            </p>
          </div>
        </main>
      </div>
    );
  }

  if (metadata.is_download_limit_reached) {
    return (
      <div className="flex flex-1 flex-col">
        <Navbar />
        <main className="flex flex-1 flex-col items-center justify-center px-6">
          <div className="text-center">
            <h1 className="text-3xl font-bold tracking-tight">Download Limit Reached</h1>
            <p className="mt-3 text-muted-foreground">
              This file has reached its maximum download limit.
            </p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col">
      <Navbar />
      <main className="flex flex-1 flex-col items-center px-6 py-16">
        <SharePageClient metadata={metadata} />
      </main>
    </div>
  );
}
