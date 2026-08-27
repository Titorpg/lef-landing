// LEF — configuración de Supabase (frontend).
//
// La "publishable key" es PÚBLICA por diseño: solo permite lo que las
// políticas RLS de la base de datos autorizan. No es un secreto y puede
// vivir en el repo. La service_role / secret key NUNCA va aquí.

window.LEF_SUPABASE = {
  url: "https://cemrxcatbxbcipxmsnjf.supabase.co",
  key: "sb_publishable_4vocQgemt38keqyYugjLkQ_bwYy62Jj"
};

// Crea un cliente de Supabase.
//   lefClient()               -> anónimo, sin sesión (páginas públicas)
//   lefClient({ session:true })-> guarda la sesión (panel admin / portal)
window.lefClient = function (opts) {
  opts = opts || {};
  if (!window.supabase || !window.LEF_SUPABASE) {
    console.warn("[LEF] supabase-js no cargó");
    return null;
  }
  return window.supabase.createClient(
    window.LEF_SUPABASE.url,
    window.LEF_SUPABASE.key,
    {
      auth: {
        persistSession: !!opts.session,
        autoRefreshToken: !!opts.session,
        storageKey: "lef-auth"
      }
    }
  );
};

// Cliente anónimo compartido para las páginas públicas (formulario de inscripción).
window.lefSupabase = window.lefClient();
