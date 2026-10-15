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
