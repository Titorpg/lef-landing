-- LEF — Cierra funciones viejas que seguían abiertas al público (29 sep 2026,
-- revisión de residuos pedida por el usuario).
--
-- Desde las pre-inscripciones (20260906140000) el formulario público ya no crea
-- estudiantes: guarda una solicitud que el admin revisa y convierte. Pero
-- create_enrollment seguía ejecutable por cualquier visitante (anon) con la llave
-- pública de la página: se podía crear un estudiante con su inscripción y ocupar
-- cupo en un grupo sin pasar por la revisión del admin. Verificado el 29 sep: la
-- función respondía a una llamada anónima.
--
-- create_enrollment se sigue usando por dentro (admin_convert_preinscripcion, que
-- corre con permisos del dueño), así que solo se quita el permiso a los usuarios.
-- get_enrollment_confirmation y get_public_modules eran del formulario viejo y ya
-- no los llama nadie.

revoke all on function public.create_enrollment(text, text, text, uuid, uuid, text, text, integer, text)
  from public, anon, authenticated;
revoke all on function public.get_enrollment_confirmation(uuid) from public, anon, authenticated;
revoke all on function public.get_public_modules() from public, anon, authenticated;
