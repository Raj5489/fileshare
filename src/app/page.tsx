import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import Navbar from "@/components/Navbar";
import UploadZone from "@/components/UploadZone";
import Footer from "@/components/Footer";
import { UploadCloud, Globe, Shield, Clock, Zap, Lock } from "lucide-react";

export default async function Home() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/dashboard");

  return (
    <div className="flex flex-1 flex-col">
      <Navbar />

      {/* ── Hero ── */}
      <main className="flex flex-1 flex-col items-center overflow-hidden">
        {/* Background layers */}
        <div className="absolute inset-0 hero-mesh pointer-events-none" />
        <div className="absolute inset-0 grid-pattern pointer-events-none opacity-60" />

        {/* Floating orbs */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="animate-float-slow absolute -top-32 -left-32 h-96 w-96 rounded-full bg-primary/8 blur-3xl" />
          <div className="animate-float-medium absolute top-1/3 -right-24 h-72 w-72 rounded-full bg-violet-500/6 blur-3xl" />
          <div className="animate-pulse-glow absolute bottom-1/4 left-1/4 h-48 w-48 rounded-full bg-primary/5 blur-2xl" />
        </div>

        {/* Hero content */}
        <section className="relative z-10 flex w-full flex-col items-center px-6 pt-24 pb-16">
          {/* Badge */}
          <div className="animate-fade-up mb-8 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-xs font-medium text-primary shadow-sm">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
            </span>
            No account required · Free forever
          </div>

          {/* Headline */}
          <h1
            className="animate-fade-up text-center text-5xl font-bold tracking-tight sm:text-6xl lg:text-7xl"
            style={{ animationDelay: "0.05s" }}
          >
            Share any file, <span className="gradient-text">instantly</span>
          </h1>

          <p
            className="animate-fade-up mt-6 max-w-xl text-center text-lg leading-relaxed text-muted-foreground"
            style={{ animationDelay: "0.1s" }}
          >
            Images, PDFs, documents, videos and more. Upload once, share
            everywhere — with expiry, passwords, and zero friction.
          </p>

          {/* Upload zone */}
          <div
            className="animate-fade-up mt-12 w-full max-w-xl"
            style={{ animationDelay: "0.15s" }}
          >
            <UploadZone />
          </div>

          {/* Trust strip */}
          <div
            className="animate-fade-up mt-10 flex flex-wrap items-center justify-center gap-6 text-xs text-muted-foreground"
            style={{ animationDelay: "0.2s" }}
          >
            {[
              {
                icon: <Shield className="h-3.5 w-3.5" />,
                label: "End-to-end secure",
              },
              {
                icon: <Zap className="h-3.5 w-3.5" />,
                label: "Instant upload",
              },
              { icon: <Globe className="h-3.5 w-3.5" />, label: "Global CDN" },
              {
                icon: <Lock className="h-3.5 w-3.5" />,
                label: "Password protection",
              },
            ].map((item) => (
              <span key={item.label} className="flex items-center gap-1.5">
                <span className="text-primary">{item.icon}</span>
                {item.label}
              </span>
            ))}
          </div>
        </section>

        {/* ── Features ── */}
        <section className="relative z-10 w-full max-w-5xl px-6 pb-24">
          <div className="mb-12 text-center">
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
              Everything you need to share files
            </h2>
            <p className="mt-3 text-muted-foreground">
              Built for speed, privacy, and simplicity.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            <FeatureCard
              icon={<UploadCloud className="h-5 w-5" />}
              title="No Signup Needed"
              description="Drag, drop, and share in seconds. No account, no friction, no waiting."
              gradient="from-blue-500/10 to-indigo-500/10"
              iconBg="bg-blue-500/10 text-blue-600"
            />
            <FeatureCard
              icon={<Globe className="h-5 w-5" />}
              title="Global CDN"
              description="Powered by Cloudflare R2. Lightning-fast downloads from anywhere on the planet."
              gradient="from-violet-500/10 to-purple-500/10"
              iconBg="bg-violet-500/10 text-violet-600"
            />
            <FeatureCard
              icon={<Clock className="h-5 w-5" />}
              title="Auto Expiry"
              description="Set links to expire in 1 hour, 24 hours, 7 days, or never. You're in control."
              gradient="from-amber-500/10 to-orange-500/10"
              iconBg="bg-amber-500/10 text-amber-600"
            />
            <FeatureCard
              icon={<Shield className="h-5 w-5" />}
              title="Password Protection"
              description="Lock any file behind a password. Only people with the code can download it."
              gradient="from-emerald-500/10 to-teal-500/10"
              iconBg="bg-emerald-500/10 text-emerald-600"
            />
            <FeatureCard
              icon={<Zap className="h-5 w-5" />}
              title="Instant Sharing"
              description="Get a shareable link and QR code the moment your upload completes."
              gradient="from-pink-500/10 to-rose-500/10"
              iconBg="bg-pink-500/10 text-pink-600"
            />
            <FeatureCard
              icon={<Lock className="h-5 w-5" />}
              title="Download Limits"
              description="Cap how many times a file can be downloaded. Perfect for one-time shares."
              gradient="from-cyan-500/10 to-sky-500/10"
              iconBg="bg-cyan-500/10 text-cyan-600"
            />
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  description,
  gradient,
  iconBg,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  gradient: string;
  iconBg: string;
}) {
  return (
    <div
      className={`feature-card card-3d relative overflow-hidden rounded-2xl border bg-card p-6 shadow-sm`}
    >
      {/* Gradient wash */}
      <div
        className={`absolute inset-0 bg-gradient-to-br ${gradient} opacity-60 pointer-events-none`}
      />
      <div className="relative z-10">
        <div
          className={`mb-4 inline-flex h-10 w-10 items-center justify-center rounded-xl ${iconBg}`}
        >
          {icon}
        </div>
        <h3 className="font-semibold tracking-tight">{title}</h3>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          {description}
        </p>
      </div>
    </div>
  );
}
