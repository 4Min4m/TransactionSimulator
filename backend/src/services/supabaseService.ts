import { supabase } from "../utils/supabaseClient";

export const getTransactions = async () => {
  const { data, error } = await supabase
    .from("transactions")
    .select("*")
    .order("created_at", { ascending: false }) // order by time
    .limit(1); // only one record
  if (error) throw new Error(error.message);
  return data;
};