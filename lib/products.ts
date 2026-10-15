import type { Product } from "@/lib/types";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

type ProductRow = Omit<Product, "affiliateUrl"> & { affiliate_url: string };

export async function getProducts(): Promise<Product[]> {
  const { data, error } = await getSupabaseBrowserClient()
    .from("products")
    .select("id, name, category, specs, price, image, affiliate_url")
    .order("name");

  if (error) {
    throw new Error(`Gagal mengambil produk dari Supabase: ${error.message}`);
  }

  return (data as ProductRow[]).map(({ affiliate_url, ...product }) => ({
    ...product,
    affiliateUrl: affiliate_url,
  }));
}
