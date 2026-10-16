"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import { AdminShell } from "@/components/admin-shell";
import { Markdown } from "@/lib/markdown";
import {
  createArticle,
  deleteArticle,
  listArticles,
  updateArticle,
  uploadImage,
  type Article,
  type ArticleInput,
} from "@/lib/admin-api";

// Harus sama persis dengan kategori di menu "Teknologi" situs publik.
const BASE_CATEGORIES = [
  "Drone & UAV",
  "Elektronik & IoT",
  "Perangkat Cerdas",
  "Inovasi Digital",
  "Tutorial & Panduan",
];

const NEW_CATEGORY = "__new__";

const emptyForm: ArticleInput = {
  slug: "",
  title: "",
  excerpt: "",
  category: BASE_CATEGORIES[0],
  image: "",
  content: "",
  published: false,
};

const inputClass =
  "w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-blue-500";

const toolbarBtn =
  "px-2.5 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 border border-slate-700";

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/$/, "");

type Message = { type: "ok" | "error"; text: string } | null;

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100)
    .replace(/-+$/, "");
}

function formatDate(iso: string | null): string {
  if (!iso) return "-";
  return new Date(iso).toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function ArticlesPage() {
  return (
    <AdminShell>
      <ArticleManager />
    </AdminShell>
  );
}

function ArticleManager() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
  const [form, setForm] = useState<ArticleInput>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [slugTouched, setSlugTouched] = useState(false);
  const [tab, setTab] = useState<"edit" | "preview">("edit");
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [customCategory, setCustomCategory] = useState(false);
  const [message, setMessage] = useState<Message>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const inlineImageRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let active = true;
    listArticles()
      .then((list) => {
        if (active) {
          setArticles(list);
          setLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (active) {
          setMessage({
            type: "error",
            text: err instanceof Error ? err.message : "Gagal memuat artikel.",
          });
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [reloadKey]);

  const categoryOptions = useMemo(
    () =>
      Array.from(
        new Set([...BASE_CATEGORIES, ...articles.map((a) => a.category)]),
      ),
    [articles],
  );

  function setField<K extends keyof ArticleInput>(
    key: K,
    value: ArticleInput[K],
  ) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function onTitleChange(value: string) {
    setForm((prev) => ({
      ...prev,
      title: value,
      slug: slugTouched || editingId ? prev.slug : slugify(value),
    }));
  }

  function resetForm() {
    setCustomCategory(false);
    setForm(emptyForm);
    setEditingId(null);
    setSlugTouched(false);
    setTab("edit");
  }

  function startEdit(a: Article) {
    setCustomCategory(false);
    setEditingId(a.id);
    setSlugTouched(true);
    setTab("edit");
    setForm({
      slug: a.slug,
      title: a.title,
      excerpt: a.excerpt,
      category: a.category,
      image: a.image,
      content: a.content,
      published: a.published,
    });
    setMessage(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // Menyisipkan teks di posisi kursor / mengganti teks yang sedang dipilih.
  function insertAtSelection(build: (selected: string) => string) {
    const el = textareaRef.current;
    const start = el?.selectionStart ?? form.content.length;
    const end = el?.selectionEnd ?? form.content.length;
    const text = build(form.content.slice(start, end));

    setForm((prev) => ({
      ...prev,
      content: prev.content.slice(0, start) + text + prev.content.slice(end),
    }));
    requestAnimationFrame(() => {
      el?.focus();
      const pos = start + text.length;
      el?.setSelectionRange(pos, pos);
    });
  }

  function askUrl(label: string): string | null {
    const url = window.prompt(label)?.trim();
    if (!url) return null;
    if (!/^https?:\/\//i.test(url)) {
      window.alert("Alamat harus diawali http:// atau https://");
      return null;
    }
    return url;
  }

  function addLink(affiliate: boolean) {
    const url = askUrl(
      affiliate
        ? "Tempel link afiliasi Shopee/Tokopedia (https://...)"
        : "Alamat link (https://...)",
    );
    if (!url) return;
    insertAtSelection(
      (sel) =>
        `[${sel || (affiliate ? "Lihat produk di Shopee" : "teks link")}](${url}${
          affiliate ? ' "affiliate"' : ""
        })`,
    );
  }

  async function onPickInlineImage(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    setMessage(null);
    try {
      const { url } = await uploadImage(file);
      insertAtSelection(() => `\n\n![deskripsi gambar](${url})\n\n`);
    } catch (err) {
      setMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Gagal mengunggah gambar.",
      });
    } finally {
      setUploading(false);
    }
  }

  async function onPickCover(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
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

  function rebuildNote(changed: boolean, rebuild: boolean): string {
    if (!changed) return "";
    return rebuild
      ? " Situs sedang di-build ulang, perubahan tampil sekitar 1-2 menit lagi."
      : " Perubahan akan tampil di situs setelah situs di-build ulang.";
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setMessage(null);

    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(form.slug)) {
      setMessage({
        type: "error",
        text: 'Slug hanya boleh huruf kecil, angka, dan tanda "-".',
      });
      return;
    }

    setBusy(true);
    try {
      const wasPublished = editingId
        ? (articles.find((a) => a.id === editingId)?.published ?? false)
        : false;
      const result = editingId
        ? await updateArticle(editingId, form)
        : await createArticle(form);

      setMessage({
        type: "ok",
        text:
          (editingId ? "Artikel diperbarui." : "Artikel disimpan.") +
          rebuildNote(form.published || wasPublished, result.rebuild),
      });
      resetForm();
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

  async function onDelete(a: Article) {
    if (!window.confirm(`Hapus artikel "${a.title}"?`)) return;
    setMessage(null);
    try {
      const result = await deleteArticle(a.id);
      setMessage({
        type: "ok",
        text: "Artikel dihapus." + rebuildNote(a.published, result.rebuild),
      });
      if (editingId === a.id) resetForm();
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
          {editingId ? "Edit Artikel" : "Tulis Artikel"}
        </h1>

        <form
          onSubmit={onSubmit}
          className="bg-slate-800/50 border border-slate-700/60 rounded-xl p-5 grid gap-4 md:grid-cols-2"
        >
          <input
            required
            placeholder="Judul artikel"
            value={form.title}
            onChange={(e) => onTitleChange(e.target.value)}
            className={`${inputClass} md:col-span-2`}
          />

          <div className="space-y-1">
            <input
              required
              placeholder="slug-url-artikel"
              value={form.slug}
              onChange={(e) => {
                setSlugTouched(true);
                setField("slug", e.target.value);
              }}
              className={inputClass}
            />
            <p className="text-xs text-slate-500">
              Alamat: /artikel/{form.slug || "slug-url-artikel"}/
            </p>
          </div>

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
              <option value={NEW_CATEGORY}>+ Kategori lain...</option>
            </select>
            {customCategory && (
              <input
                required
                autoFocus
                placeholder="Nama kategori lain"
                value={form.category}
                onChange={(e) => setField("category", e.target.value)}
                className={inputClass}
              />
            )}
          </div>

          <textarea
            required
            rows={2}
            maxLength={500}
            placeholder="Ringkasan singkat (tampil di daftar artikel dan hasil Google)"
            value={form.excerpt}
            onChange={(e) => setField("excerpt", e.target.value)}
            className={`${inputClass} md:col-span-2`}
          />

          <div className="md:col-span-2 space-y-2">
            <input
              type="url"
              placeholder="URL gambar sampul (https://...) atau unggah file di bawah"
              value={form.image}
              onChange={(e) => setField("image", e.target.value)}
              className={inputClass}
            />
            <div className="flex items-center gap-3 text-sm text-slate-300">
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                disabled={uploading}
                onChange={onPickCover}
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
                alt="Pratinjau sampul"
                className="h-24 w-40 object-cover rounded bg-slate-900"
              />
            )}
          </div>

          <div className="md:col-span-2 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setTab("edit")}
                className={`${toolbarBtn} ${tab === "edit" ? "!bg-blue-600 !border-blue-500" : ""}`}
              >
                Tulis
              </button>
              <button
                type="button"
                onClick={() => setTab("preview")}
                className={`${toolbarBtn} ${tab === "preview" ? "!bg-blue-600 !border-blue-500" : ""}`}
              >
                Pratinjau
              </button>

              {tab === "edit" && (
                <>
                  <span className="mx-1 h-5 w-px bg-slate-700" />
                  <button
                    type="button"
                    className={toolbarBtn}
                    onClick={() =>
                      insertAtSelection((s) => `\n\n## ${s || "Judul bagian"}\n\n`)
                    }
                  >
                    H2
                  </button>
                  <button
                    type="button"
                    className={toolbarBtn}
                    onClick={() =>
                      insertAtSelection((s) => `\n\n### ${s || "Sub bagian"}\n\n`)
                    }
                  >
                    H3
                  </button>
                  <button
                    type="button"
                    className={toolbarBtn}
                    onClick={() => insertAtSelection((s) => `**${s || "teks tebal"}**`)}
                  >
                    Tebal
                  </button>
                  <button
                    type="button"
                    className={toolbarBtn}
                    onClick={() => insertAtSelection((s) => `*${s || "teks miring"}*`)}
                  >
                    Miring
                  </button>
                  <button
                    type="button"
                    className={toolbarBtn}
                    onClick={() =>
                      insertAtSelection((s) =>
                        s
                          ? s
                              .split("\n")
                              .map((l) => `- ${l}`)
                              .join("\n")
                          : "\n\n- butir pertama\n- butir kedua\n\n",
                      )
                    }
                  >
                    Daftar
                  </button>
                  <button
                    type="button"
                    className={toolbarBtn}
                    onClick={() => addLink(false)}
                  >
                    Link
                  </button>
                  <button
                    type="button"
                    className={`${toolbarBtn} !border-emerald-600/70 !text-emerald-300`}
                    onClick={() => addLink(true)}
                  >
                    Link afiliasi
                  </button>
                  <button
                    type="button"
                    className={toolbarBtn}
                    disabled={uploading}
                    onClick={() => inlineImageRef.current?.click()}
                  >
                    Gambar
                  </button>
                  <input
                    ref={inlineImageRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={onPickInlineImage}
                  />
                </>
              )}
            </div>

            {tab === "edit" ? (
              <textarea
                ref={textareaRef}
                required
                rows={18}
                placeholder={
                  "Tulis artikel dengan Markdown.\n\n## Judul bagian\nParagraf biasa, **tebal**, *miring*, `GPS_TYPE = 2`.\n\nSisipkan link afiliasi dengan tombol \"Link afiliasi\"."
                }
                value={form.content}
                onChange={(e) => setField("content", e.target.value)}
                className={`${inputClass} font-mono leading-relaxed`}
              />
            ) : (
              <div className="rounded-lg border border-slate-700 bg-slate-900 p-5 min-h-48">
                {form.content.trim() ? (
                  <Markdown source={form.content} />
                ) : (
                  <p className="text-sm text-slate-500">Belum ada isi.</p>
                )}
              </div>
            )}
          </div>

          <label className="md:col-span-2 flex items-center gap-2 text-sm text-slate-200">
            <input
              type="checkbox"
              checked={form.published}
              onChange={(e) => setField("published", e.target.checked)}
              className="h-4 w-4"
            />
            Terbitkan (tampil di situs). Kosongkan untuk menyimpan sebagai draft.
          </label>

          <div className="md:col-span-2 flex gap-3">
            <button
              type="submit"
              disabled={busy}
              className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-medium px-5 py-2 rounded-lg"
            >
              {busy
                ? "Menyimpan..."
                : editingId
                  ? "Simpan Perubahan"
                  : form.published
                    ? "Simpan & Terbitkan"
                    : "Simpan Draft"}
            </button>
            {(editingId || form.title || form.content) && (
              <button
                type="button"
                onClick={resetForm}
                className="bg-slate-800 hover:bg-slate-700 px-5 py-2 rounded-lg"
              >
                {editingId ? "Batal" : "Kosongkan"}
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
          Daftar Artikel {!loading && `(${articles.length})`}
        </h2>
        {loading ? (
          <p className="text-slate-400">Memuat artikel...</p>
        ) : articles.length === 0 ? (
          <p className="text-slate-400">Belum ada artikel di database.</p>
        ) : (
          <ul className="space-y-3">
            {articles.map((a) => (
              <li
                key={a.id}
                className="bg-slate-800/50 border border-slate-700/60 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center gap-3"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-semibold truncate">{a.title}</p>
                  <p className="text-xs text-slate-400 mt-1">
                    {a.category} &middot;{" "}
                    <span
                      className={a.published ? "text-emerald-400" : "text-amber-400"}
                    >
                      {a.published ? "Terbit" : "Draft"}
                    </span>{" "}
                    &middot; {formatDate(a.publishedAt ?? a.createdAt)}
                  </p>
                </div>
                <div className="flex gap-2 text-sm">
                  {a.published && siteUrl && (
                    <a
                      href={`${siteUrl}/artikel/${a.slug}/`}
                      target="_blank"
                      rel="noreferrer"
                      className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700"
                    >
                      Lihat
                    </a>
                  )}
                  <button
                    onClick={() => startEdit(a)}
                    className="px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => onDelete(a)}
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
