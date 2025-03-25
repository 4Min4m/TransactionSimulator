import { supabase } from "../utils/supabaseClient";

export const getTransactions = async () => {
  const { data, error } = await supabase.from("transactions").select("*");
  if (error) throw new Error(error.message);
  return data;
};