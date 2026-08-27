-- LEF — la suscripción muestra su MÓDULO (no una descripción libre).
drop function if exists public.admin_billing_overview();
create or replace function public.admin_billing_overview()
  returns table(subscription_id uuid, student_id uuid, student_name text, student_email text,
                module_label text, monthly_amount numeric, currency text, status text,
                next_due_date date, last_payment_at timestamptz, last_payment_amount numeric,
                is_overdue boolean)
  language sql stable security definer set search_path = public as $$
  select sub.id, st.id, st.full_name, st.email,
         coalesce(m.level || ' · ' || m.title, sub.description) as module_label,
         sub.monthly_amount, sub.currency, sub.status, sub.next_due_date,
         lp.paid_at, lp.amount,
         (sub.status = 'active' and sub.next_due_date is not null
          and current_date > sub.next_due_date + sub.grace_days)
  from public.subscriptions sub
  join public.students st on st.id = sub.student_id
  left join public.modules m on m.id = sub.module_id
  left join lateral (
    select paid_at, amount from public.payments p
    where p.subscription_id = sub.id and p.status = 'approved'
    order by p.paid_at desc limit 1
  ) lp on true
  where public.is_admin()
  order by st.full_name;
$$;
grant execute on function public.admin_billing_overview() to authenticated;
