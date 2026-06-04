import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://jtwhrjwyqzolnxnesmrw.supabase.co";
const supabaseKey = "sb_publishable_MxiclW8CON9pvpPpcpJ9Ww_3Dl4MXoA";

export const supabase = createClient(supabaseUrl, supabaseKey);