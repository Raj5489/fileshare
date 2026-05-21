import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import Navbar from "@/components/Navbar";
import UploadZone from "@/components/UploadZone";
import { UploadCloud, Globe, Shield, Clock, Zap, Lock } from "lucide-react";

export default async function Home() {
  // Redirect logged-in users straight to their dashboard
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/dashboard");
  return (
    <div className="flex flex-1 flex-col">
      <Navbar />
      <main className="flex flex-1 flex-col items-center px-6 py-20">
        <div className="text-center max-w-2xl">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
            Share any file, instantly
          </h1>
          <p className="mt-6 text-lg leading-relaxed text-muted-foreground">
            No account required. Images, PDFs, documents, videos and more.
            Upload and share with a single link.
          </p>
        </div>

        <div className="mt-12 w-full max-w-xl">
          <UploadZone />
        </div>

        <div className="mt-20 grid max-w-3xl grid-cols-1 gap-10 sm:grid-cols-2">
          <Feature
            icon={<UploadCloud className="h-6 w-6" />}
            title="No Signup Needed"
            description="Upload and share files without creating an account. Just drag, drop, and share."
          />
          <Feature
            icon={<Globe className="h-6 w-6" />}
            title="Global CDN"
            description="Fast downloads from anywhere in the world, powered by Cloudflare R2."
          />
          <Feature
            icon={<Clock className="h-6 w-6" />}
            title="Auto Expiry"
            description="Set expiry dates or let files auto-delete after a set time period."
          />
          <Feature
            icon={<Shield className="h-6 w-6" />}
            title="Password Protection"
            description="Optionally protect your files with a password for added security."
          />
        </div>
      </main>
    </div>
  );
}

function Feature({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col items-center text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
        {icon}
      </div>
      <h3 className="mt-5 font-semibold tracking-tight">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        {description}
      </p>
    </div>
  );
}
