import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type Product = Tables<"products">;

export const productsListKey = ["products", "list"] as const;
export const productsByClientKey = (clientId: string) => ["products", "by-client", clientId] as const;

export async function listProducts() {
  const { data, error } = await supabase
    .from("products")
    .select("*, client:profiles!products_client_id_fkey(id, full_name, email)")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function listProductsByClient(clientId: string) {
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .eq("client_id", clientId)
    .order("name", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function getProduct(id: string) {
  const { data, error } = await supabase.from("products").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data;
}

export type CreateProductInput = {
  client_id: string;
  name: string;
  description?: string | null;
  segment?: string | null;
};

export async function createProduct(input: CreateProductInput) {
  const { data, error } = await supabase.from("products").insert(input).select("*").single();
  if (error) throw error;
  return data;
}

export async function updateProduct(id: string, patch: Partial<CreateProductInput>) {
  const { data, error } = await supabase.from("products").update(patch).eq("id", id).select("*").single();
  if (error) throw error;
  return data;
}

export async function deleteProduct(id: string) {
  const { error } = await supabase.from("products").delete().eq("id", id);
  if (error) throw error;
}