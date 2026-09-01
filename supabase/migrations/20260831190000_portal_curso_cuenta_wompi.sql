-- LEF — Portal del estudiante: pestañas "Mi curso" y "Mi cuenta", y pagos reales con Wompi.
-- El estudiante ya podía ver su facturación; ahora además puede ver en qué módulo/horario
-- está inscrito, editar su foto/contraseña/datos de contacto, y pagar su mensualidad en
-- línea (PSE/tarjeta) desde el portal — no desde el formulario público de inscripción.

-- ============================================================================
-- 0. get_my_billing — se amplía el objeto "student" con whatsapp/edad/ciudad,
--    para precargar el formulario de "Mi cuenta" (antes solo traía nombre/correo).
-- ============================================================================
create or replace function public.get_my_billing()
  returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'student', (select to_jsonb(s) from (
        select st.full_name, st.email, st.whatsapp, st.age, st.city from public.students st
        where st.id = public.current_student_id()) s),
    'subscriptions', coalesce((select jsonb_agg(to_jsonb(sub) order by sub.created_at)
        from public.subscriptions sub where sub.student_id = public.current_student_id()), '[]'::jsonb),
    'payments', coalesce((select jsonb_agg(to_jsonb(p) order by p.paid_at desc)
        from public.payments p where p.student_id = public.current_student_id()), '[]'::jsonb)
  );
$$;

-- ============================================================================
-- 1. get_my_course — módulo, horario y profesor del estudiante autenticado
-- ============================================================================
create or replace function public.get_my_course()
  returns table(
    enrollment_status text, registration_number text,
    module_level text, module_title text, module_description text,
    schedule_days text[], schedule_start_time time, schedule_end_time time,
    teacher_full_name text)
  language sql stable security definer set search_path = public as $$
  select e.status, e.registration_number,
         m.level, m.title, m.description,
         sch.days, sch.start_time, sch.end_time,
         t.full_name
  from public.enrollments e
  join public.modules m on m.id = e.module_id
  left join public.groups g on g.id = e.group_id
  left join public.schedules sch on sch.id = g.schedule_id
  left join public.teachers t on t.id = g.teacher_id
  where e.student_id = public.current_student_id()
    and e.status <> 'Cancelled'
  order by e.created_at desc
  limit 1;
$$;

revoke all on function public.get_my_course() from public, anon;
grant execute on function public.get_my_course() to authenticated;

-- ============================================================================
-- 2. update_my_profile — el estudiante edita sus propios datos de contacto
--    (no toca doc_type/doc_number: eso lo sigue corrigiendo solo el admin)
-- ============================================================================
create or replace function public.update_my_profile(
  p_full_name text, p_whatsapp text, p_email text,
  p_age integer default null, p_city text default null)
  returns void language plpgsql security definer set search_path = public as $$
declare v_student_id uuid;
begin
  v_student_id := public.current_student_id();
  if v_student_id is null then raise exception 'LEF_NOT_ALLOWED'; end if;
  if coalesce(trim(p_full_name),'') = '' or coalesce(trim(p_email),'') = ''
     or coalesce(trim(p_whatsapp),'') = '' then
    raise exception 'LEF_MISSING_FIELDS';
  end if;

  update public.students
    set full_name = trim(p_full_name),
        whatsapp  = trim(p_whatsapp),
        email     = trim(p_email),
        age       = p_age,
        city      = nullif(trim(coalesce(p_city, '')), '')
    where id = v_student_id;
end;
$$;

revoke all on function public.update_my_profile(text,text,text,integer,text) from public, anon;
grant execute on function public.update_my_profile(text,text,text,integer,text) to authenticated;

-- ============================================================================
-- 3. profiles.avatar_url + política para que cada quien edite su propia fila
-- ============================================================================
alter table public.profiles add column if not exists avatar_url text;

drop policy if exists "edita su propio profile" on public.profiles;
create policy "edita su propio profile" on public.profiles for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ============================================================================
-- 4. Storage: bucket "avatars" — foto de perfil, público de lectura, cada quien
--    solo puede subir/actualizar/borrar dentro de su propia carpeta {user_id}/...
-- ============================================================================
insert into storage.buckets (id, name, public)
  values ('avatars', 'avatars', true)
  on conflict (id) do nothing;

drop policy if exists "avatars publico de lectura" on storage.objects;
create policy "avatars publico de lectura" on storage.objects for select
  using (bucket_id = 'avatars');

drop policy if exists "avatars sube su propia carpeta" on storage.objects;
create policy "avatars sube su propia carpeta" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "avatars actualiza su propia carpeta" on storage.objects;
create policy "avatars actualiza su propia carpeta" on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "avatars borra su propia carpeta" on storage.objects;
create policy "avatars borra su propia carpeta" on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- ============================================================================
-- 5. record_wompi_payment — SOLO para el Edge Function del webhook (service_role).
--    No se otorga a authenticated/anon: un estudiante nunca debe poder llamarla
--    directamente, solo llega aquí después de verificar la firma de Wompi.
-- ============================================================================
-- Refuerzo a nivel de base de datos contra duplicados (además del chequeo manual abajo).
create unique index if not exists payments_gateway_txn_uidx
  on public.payments(gateway_txn_id) where gateway_txn_id is not null;

create or replace function public.record_wompi_payment(
  p_subscription_id uuid, p_amount numeric, p_currency text, p_method text,
  p_gateway_txn_id text, p_reference text)
  returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_sub public.subscriptions%rowtype;
  v_payment_id uuid;
  v_existing uuid;
begin
  -- Idempotencia: si Wompi reintenta el webhook, no duplicar el pago.
  select id into v_existing from public.payments where gateway_txn_id = p_gateway_txn_id;
  if v_existing is not null then return v_existing; end if;

  select * into v_sub from public.subscriptions where id = p_subscription_id;
  if not found then raise exception 'LEF_SUBSCRIPTION_NOT_FOUND'; end if;

  insert into public.payments (subscription_id, student_id, amount, currency,
                               period_month, method, status, reference, gateway_txn_id, notes)
  values (p_subscription_id, v_sub.student_id, p_amount, p_currency,
          date_trunc('month', now())::date, p_method, 'approved',
          p_reference, p_gateway_txn_id, 'Pago en línea vía Wompi')
  returning id into v_payment_id;

  update public.subscriptions
  set next_due_date = (date_trunc('month', now()) + interval '1 month')::date
                        + (billing_day - 1),
      status = case when status = 'frozen' then 'active' else status end,
      frozen_at = null,
      updated_at = now()
  where id = p_subscription_id;

  return v_payment_id;
end;
$$;

revoke all on function public.record_wompi_payment(uuid,numeric,text,text,text,text) from public, anon, authenticated;
