-- =====================================================================
-- Registro de colegas con acceso a la página (solo para el panel).
-- Datos de contacto: los ve y edita SOLO una cuenta de administración.
-- La página pública no tiene ningún acceso. Sin trigger de historial,
-- para que los teléfonos no queden copiados en el registro de actividad.
-- Migración aditiva: no modifica ni borra nada existente.
-- =====================================================================

create table public.colegas (
  id              uuid primary key default gen_random_uuid(),
  nombre_apellido text not null check (length(btrim(nombre_apellido)) between 1 and 120),
  telefono        text not null default '' check (length(telefono) <= 40),
  inmobiliaria    text not null default '' check (length(inmobiliaria) <= 120),
  notas           text not null default '' check (length(notas) <= 2000),
  creado_en       timestamptz not null default now(),
  modificado_en   timestamptz not null default now(),
  creado_por      uuid references auth.users (id) on delete set null,
  modificado_por  uuid references auth.users (id) on delete set null
);
comment on table public.colegas is
  'Colegas inmobiliarios a los que se les dio acceso a la página. Solo administración. No se publica.';
create index colegas_nombre_idx on public.colegas (lower(nombre_apellido));

-- Quién y cuándo (mismos sellos automáticos que el resto de las tablas).
create trigger colegas_sellar before insert or update on public.colegas
  for each row execute function public.sellar_cambios();

-- Permisos: nada para anon; las cuentas del panel pasan por es_admin().
alter table public.colegas enable row level security;
revoke all on public.colegas from anon, authenticated;
grant select, insert, update, delete on public.colegas to authenticated;

create policy "colegas: solo admin ve"
  on public.colegas for select to authenticated using ((select public.es_admin()));
create policy "colegas: solo admin crea"
  on public.colegas for insert to authenticated with check ((select public.es_admin()));
create policy "colegas: solo admin modifica"
  on public.colegas for update to authenticated
  using ((select public.es_admin())) with check ((select public.es_admin()));
create policy "colegas: solo admin borra"
  on public.colegas for delete to authenticated using ((select public.es_admin()));
