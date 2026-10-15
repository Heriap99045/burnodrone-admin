"use client";

import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Session } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

const inputClass =
  "w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-blue-500";

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/$/, "");

const configured = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
);

export function AdminShell({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(!configured);
  const pathname = usePathname();
  const onArticles = pathname.startsWith("/artikel");

  useEffect(() => {
    if (!configured) return;
    const supabase = getSupabaseBrowserClient();

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });

    const { data } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const tabClass = (active: boolean) =>
    `px-3 py-1.5 rounded-lg text-sm font-medium ${
      active
        ? "bg-blue-600 text-white"
        : "bg-slate-800 text-slate-300 hover:bg-slate-700"
    }`;

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 py-4 flex flex-wrap items-center justify-between gap-3">
          <span className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent">
            BurnoDrone Admin
          </span>
          {session && (
            <div className="flex flex-wrap items-center gap-2 text-sm text-slate-300">
              <Link href="/" className={tabClass(!onArticles)}>
                Produk
              </Link>
              <Link href="/artikel/" className={tabClass(onArticles)}>
                Artikel
              </Link>
              {siteUrl && (
                <a
                  href={siteUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700"
                >
                  Lihat situs
                </a>
              )}
              <span className="hidden md:inline">{session.user.email}</span>
              <button
                onClick={() => getSupabaseBrowserClient().auth.signOut()}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700"
              >
                Keluar
              </button>
            </div>
          )}
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8">
        {!configured ? (
          <p className="rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-red-200">
            Supabase belum dikonfigurasi (NEXT_PUBLIC_SUPABASE_URL dan
            NEXT_PUBLIC_SUPABASE_ANON_KEY).
          </p>
        ) : !ready ? (
          <p className="text-slate-400">Memuat...</p>
        ) : session ? (
          children
        ) : (
          <LoginForm />
        )}
      </main>
    </div>
  );
}

function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error: authError } =
      await getSupabaseBrowserClient().auth.signInWithPassword({
        email,
        password,
      });
    if (authError) setError(authError.message);
    setBusy(false);
  }

  return (
    <form
      onSubmit={onSubmit}
      className="max-w-sm mx-auto bg-slate-800/50 border border-slate-700/60 rounded-xl p-6 space-y-4"
    >
      <h1 className="text-xl font-bold">Login Admin</h1>
      <input
        type="email"
        required
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className={inputClass}
      />
      <input
        type="password"
        required
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className={inputClass}
      />
      {error && <p className="text-sm text-red-300">{error}</p>}
      <button
        type="submit"
        disabled={busy}
        className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-medium py-2 rounded-lg"
      >
        {busy ? "Masuk..." : "Masuk"}
      </button>
    </form>
  );
}
