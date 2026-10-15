import type { Product } from "@/lib/types";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "").replace(/\/$/, "");

export type ProductInput = Omit<Product, "id">;

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (!API_URL) {
    throw new Error("NEXT_PUBLIC_API_URL belum diisi.");
  }

  const { data } = await getSupabaseBrowserClient().auth.getSession();
  const token = data.session?.access_token;
  if (!token) {
    throw new Error("Sesi login habis. Silakan login lagi.");
  }

  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      // FormData: biarkan browser mengisi Content-Type (boundary) sendiri.
      ...(typeof init.body === "string"
        ? { "Content-Type": "application/json" }
        : {}),
      Authorization: `Bearer ${token}`,
      ...init.headers,
    },
  });

  const body = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) {
    throw new Error(body.error ?? `Permintaan gagal (${res.status})`);
  }
  return body as T;
}

export function createProduct(product: ProductInput) {
  return request<Product>("/admin/products", {
    method: "POST",
    body: JSON.stringify(product),
  });
}

export function updateProduct(id: string, product: ProductInput) {
  return request<Product>(`/admin/products/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: JSON.stringify(product),
  });
}

export function uploadImage(file: File) {
  const data = new FormData();
  data.append("file", file);
  return request<{ url: string }>("/admin/upload", {
    method: "POST",
    body: data,
  });
}

export function deleteProduct(id: string) {
  return request<{ ok: true }>(`/admin/products/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

// ---------------------------------------------------------------------------
// Artikel
// ---------------------------------------------------------------------------

export interface Article {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  category: string;
  image: string;
  content: string; // Markdown
  published: boolean;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export type ArticleInput = Pick<
  Article,
  "slug" | "title" | "excerpt" | "category" | "image" | "content" | "published"
>;

// `rebuild` true berarti situs publik sudah diminta build ulang (Vercel Deploy Hook).
export type ArticleResult = Article & { rebuild: boolean };

export function listArticles() {
  return request<Article[]>("/admin/articles");
}

export function createArticle(article: ArticleInput) {
  return request<ArticleResult>("/admin/articles", {
    method: "POST",
    body: JSON.stringify(article),
  });
}

export function updateArticle(id: string, article: ArticleInput) {
  return request<ArticleResult>(`/admin/articles/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: JSON.stringify(article),
  });
}

export function deleteArticle(id: string) {
  return request<{ ok: true; rebuild: boolean }>(
    `/admin/articles/${encodeURIComponent(id)}`,
    { method: "DELETE" },
  );
}
