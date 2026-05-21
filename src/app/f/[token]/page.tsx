import Navbar from "@/components/Navbar";
import SharePageClient from "./SharePageClient";
import { FileX, Clock, ShieldOff } from "lucide-react";
import Link from "next/link";

async function getFileMetadata(token: string) {
  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/files/${token}`,
      { next: { revalidate: 0 } },
    );
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

function ErrorPage({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-1 flex-col">
      <Navbar />
      <main className="flex flex-1 flex-col items-center justify-center px-6">
        <div className="flex flex-col items-center text-center max-w-sm">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted mb-6">
            <Icon className="h-8 w-8 text-muted-foreground" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
          <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
            {description}
          </p>
          <Link
            href="/"
            className="mt-8 text-sm font-medium text-primary hover:underline"
          >
            ← Back to FileShare
          </Link>
        </div>
      </main>
    </div>
  );
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
      <ErrorPage
        icon={FileX}
        title="File not found"
        description="This file doesn't exist or has been removed by the owner."
      />
    );
  }

  if (metadata.is_expired) {
    return (
      <ErrorPage
        icon={Clock}
        title="Link expired"
        description="This share link has expired. Ask the sender to share a new link."
      />
    );
  }

  if (metadata.is_download_limit_reached) {
    return (
      <ErrorPage
        icon={ShieldOff}
        title="Download limit reached"
        description="This file has reached its maximum number of downloads and is no longer available."
      />
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
