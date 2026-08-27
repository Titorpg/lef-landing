// LEF — configuración de Supabase (frontend).
//
// La "publishable key" es PÚBLICA por diseño: solo permite lo que las
// políticas RLS de la base de datos autorizan (aquí: insertar inscripciones,
// nada de lectura). No es un secreto y puede vivir en el repo.
// La service_role / secret key NUNCA va aquí.

window.LEF_SUPABASE = {
  url: "https://cemrxcatbxbcipxmsnjf.supabase.co",
  key: "sb_publishable_4vocQgemt38keqyYugjLkQ_bwYy62Jj"
};

window.lefSupabase = (function () {
  try {
    if (!window.supabase || !window.LEF_SUPABASE) return null;
    return window.supabase.createClient(
      window.LEF_SUPABASE.url,
      window.LEF_SUPABASE.key,
      { auth: { persistSession: false } }
    );
  } catch (e) {
    console.warn("[LEF] No se pudo iniciar Supabase:", e);
    return null;
  }
})();
