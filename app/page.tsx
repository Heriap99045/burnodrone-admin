"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import type { Session } from "@supabase/supabase-js";
import type { Product } from "@/lib/types";
import { getProducts } from "@/lib/products";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  createProduct,
  deleteProduct,
  updateProduct,
  uploadImage,
  type ProductInput,
} from "@/lib/admin-api";

const BASE_CATEGORIES = [
  "Flight Controller",
  "Camera & Gimbal",
  "GPS & Navigation",
  "Actuators",
  "Propulsion & Motor",
];

const NEW_CATEGORY = "__new__";

const emptyForm: ProductInput = {
  name: "",
  category: BASE_CATEGORIES[0],
  specs: "",
  price: "",
  image: "",
  affiliateUrl: "",
};

const inputClass =
  "w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-blue-500";

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/$/, "");

const configured = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
);

type Message = { type: "ok" | "error"; text: string } | null;

export default function AdminPage() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(!configured);

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

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <span className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent">
            BurnoDrone Admin
          </span>
          {session && (
            <div className="flex items-center gap-3 text-sm text-slate-300">
              {siteUrl && (
                <a
                  href={`${siteUrl}/katalog/`}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700"
                >
                  Lihat katalog
                </a>
              )}
              <span className="hidden sm:inline">{session.user.email}</span>
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
          <Dashboard />
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

function Dashboard() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
  const [form, setForm] = useState<ProductInput>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<Message>(null);
  const [uploading, setUploading] = useState(false);
  const [customCategory, setCustomCategory] = useState(false);

  // Kategori bawaan + semua kategori yang sudah dipakai produk di database.
  const categoryOptions = useMemo(
    () =>
      Array.from(
        new Set([...BASE_CATEGORIES, ...products.map((p) => p.category)]),
      ),
    [products],
  );

  useEffect(() => {
    let active = true;
    getProducts()
      .then((list) => {
        if (active) {
          setProducts(list);
          setLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (active) {
          setMessage({
            type: "error",
            text: err instanceof Error ? err.message : "Gagal memuat produk.",
          });
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [reloadKey]);

  function setField<K extends keyof ProductInput>(key: K, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function onPickImage(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    setMessage(null);
    try {
      const { url } = await uploadImage(file);
      setField("image", url);
    } catch (err) {
      setMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Gagal mengunggah gambar.",
      });
    } finally {
      setUploading(false);
    }
  }

  function startEdit(p: Product) {
    setCustomCategory(false);
    setEditingId(p.id);
    setForm({
      name: p.name,
      category: p.category,
      specs: p.specs,
      price: p.price,
      image: p.image,
      affiliateUrl: p.affiliateUrl,
    });
    setMessage(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function cancelEdit() {
    setCustomCategory(false);
    setEditingId(null);
    setForm(emptyForm);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      if (editingId) {
        await updateProduct(editingId, form);
      } else {
        await createProduct(form);
      }
      setMessage({
        type: "ok",
        text: editingId ? "Produk diperbarui." : "Produk ditambahkan.",
      });
      cancelEdit();
      setReloadKey((k) => k + 1);
    } catch (err) {
      setMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Terjadi kesalahan.",
      });
    } finally {
      setBusy(false);
    }
  }

  async function onDelete(p: Product) {
    if (!window.confirm(`Hapus "${p.name}"?`)) return;
    setMessage(null);
    try {
      await deleteProduct(p.id);
      setMessage({ type: "ok", text: "Produk dihapus." });
      if (editingId === p.id) cancelEdit();
      setReloadKey((k) => k + 1);
    } catch (err) {
      setMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Gagal menghapus.",
      });
    }
  }

  return (
    <div className="space-y-10">
      <section>
        <h1 className="text-2xl font-extrabold mb-4">
          {editingId ? "Edit Produk" : "Tambah Produk"}
        </h1>
        <form
          onSubmit={onSubmit}
          className="bg-slate-800/50 border border-slate-700/60 rounded-xl p-5 grid gap-4 md:grid-cols-2"
        >
          <input
            required
            placeholder="Nama produk"
            value={form.name}
            onChange={(e) => setField("name", e.target.value)}
            className={inputClass}
          />
          <div className="space-y-2">
            <select
              value={customCategory ? NEW_CATEGORY : form.category}
              onChange={(e) => {
                if (e.target.value === NEW_CATEGORY) {
                  setCustomCategory(true);
                  setField("category", "");
                } else {
                  setCustomCategory(false);
                  setField("category", e.target.value);
                }
              }}
              className={inputClass}
            >
              {categoryOptions.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
              <option value={NEW_CATEGORY}>+ Kategori baru...</option>
            </select>
            {customCategory && (
              <input
                required
                autoFocus
                placeholder="Nama kategori baru"
                value={form.category}
                onChange={(e) => setField("category", e.target.value)}
                className={inputClass}
              />
            )}
          </div>
          <input
            required
            placeholder="Spesifikasi singkat"
            value={form.specs}
            onChange={(e) => setField("specs", e.target.value)}
            className={`${inputClass} md:col-span-2`}
          />
          <input
            required
            placeholder="Harga (mis. Rp 4.500.000)"
            value={form.price}
            onChange={(e) => setField("price", e.target.value)}
            className={inputClass}
          />
          <div className="md:col-span-2 space-y-2">
            <input
              required
              type="url"
              placeholder="URL gambar (https://...) atau unggah file di bawah"
              value={form.image}
              onChange={(e) => setField("image", e.target.value)}
              className={inputClass}
            />
            <div className="flex items-center gap-3 text-sm text-slate-300">
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                disabled={uploading}
                onChange={(e) => {
                  void onPickImage(e.target.files?.[0]);
                  e.target.value = "";
                }}
                className="text-xs file:mr-3 file:rounded-lg file:border-0 file:bg-slate-700 file:px-3 file:py-1.5 file:text-slate-100 hover:file:bg-slate-600"
              />
              <span className="text-xs text-slate-400">
                {uploading ? "Mengunggah..." : "JPG/PNG/WebP, maks 2 MB"}
              </span>
            </div>
            {form.image && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={form.image}
                alt="Pratinjau"
                className="h-24 w-36 object-cover rounded bg-slate-900"
              />
            )}
          </div>
          <input
            required
            type="url"
            placeholder="Link afiliasi Shopee/Tokopedia (https://...)"
            value={form.affiliateUrl}
            onChange={(e) => setField("affiliateUrl", e.target.value)}
            className={`${inputClass} md:col-span-2`}
          />
          <div className="md:col-span-2 flex gap-3">
            <button
              type="submit"
              disabled={busy}
              className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-medium px-5 py-2 rounded-lg"
            >
              {busy ? "Menyimpan..." : editingId ? "Simpan Perubahan" : "Tambah"}
            </button>
            {editingId && (
              <button
                type="button"
                onClick={cancelEdit}
                className="bg-slate-800 hover:bg-slate-700 px-5 py-2 rounded-lg"
              >
                Batal
              </button>
            )}
          </div>
        </form>
        {message && (
          <p
            role={message.type === "error" ? "alert" : "status"}
            className={`mt-3 rounded-lg p-3 text-sm ${
              message.type === "error"
                ? "border border-red-500/40 bg-red-500/10 text-red-200"
                : "border border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
            }`}
          >
            {message.text}
          </p>
        )}
      </section>

      <section>
        <h2 className="text-xl font-bold mb-4">
          Daftar Produk {!loading && `(${products.length})`}
        </h2>
        {loading ? (
          <p className="text-slate-400">Memuat produk...</p>
        ) : products.length === 0 ? (
          <p className="text-slate-400">Belum ada produk.</p>
        ) : (
          <ul className="space-y-3">
            {products.map((p) => (
              <li
                key={p.id}
                className="bg-slate-800/50 border border-slate-700/60 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center gap-3"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={p.image}
                  alt=""
                  className="h-16 w-24 object-cover rounded bg-slate-900"
                />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold truncate">{p.name}</p>
                  <p className="text-xs text-slate-400">
                    {p.category} &middot;{" "}
                    <span className="text-emerald-400">{p.price}</span>
                  </p>
                </div>
                <div className="flex gap-2 text-sm">
                  <button
                    onClick={() => startEdit(p)}
                    className="px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => onDelete(p)}
                    className="px-3 py-1.5 rounded-lg bg-red-600/80 hover:bg-red-500"
                  >
                    Hapus
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
