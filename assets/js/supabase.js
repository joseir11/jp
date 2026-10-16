// Configuração pública do Supabase. A chave publishable pode ficar no frontend.
window.SUPABASE_URL = "https://qjvcmtrhjqxrvikzjfyy.supabase.co";
window.SUPABASE_PUBLISHABLE_KEY = "sb_publishable_lFWkMbguwqSmNWzCaZ1kWA_Xd8A7gAs";
window.supabaseClient = window.supabase.createClient(
  window.SUPABASE_URL,
  window.SUPABASE_PUBLISHABLE_KEY
);
