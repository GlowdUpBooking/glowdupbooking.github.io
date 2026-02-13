import { supabase } from "./supabase";


export async function getFounderSpotsLeft() {
  const { data, error } = await supabase
    .from("founding_offer")
    .select("max_spots, claimed_spots")
    .eq("id", 1)
    .single();

  if (error) throw error;

  const spotsLeft = Math.max(0, (data.max_spots ?? 0) - (data.claimed_spots ?? 0));
  return spotsLeft;
}