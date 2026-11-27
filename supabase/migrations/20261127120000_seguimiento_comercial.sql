-- =====================================================================
-- Seguimiento comercial con colegas (27/11/2026, pedido de Nahir).
--
-- SOLO AGREGA: cinco tablas nuevas y una clave nueva en "configuracion". No borra ni cambia datos.
--   reuniones    · fecha, tema, lugar, desarrollo y quiénes vinieron
--   consultas    · un colega pregunta por un desarrollo o una unidad
--   visitas      · cliente que visita una propiedad, de dónde viene y cómo le fue
--   operaciones  · reservas y ventas (con quién, cuánto, comisión)
--   pendientes   · cosas para hacer («volver a llamar el jueves»)
--   configuracion.seguimiento · fechas del proyecto (inicio de la idea, lanzamiento, fecha límite) y metas
--
-- Todo es PRIVADO: solo la administración lo ve (es_admin()). La página pública y las cuentas de
-- colegas no tienen ningún acceso. Igual que "colegas", estas tablas no pasan por el historial.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Reuniones
-- ---------------------------------------------------------------------
create table if not exists public.reuniones (
  id              uuid primary key default gen_random_uuid(),
  fecha           date not null,
  titulo          text not null default '' check (length(titulo) <= 160),
  lugar           text not null default '' check (length(lugar) <= 120),
  desarrollo_id   text references public.desarrollos (id) on delete set null,
  asistentes      uuid[] not null default '{}',
  otros_asistentes text not null default '' check (length(otros_asistentes) <= 600),
  notas           text not null default '' check (length(notas) <= 4000),
  creado_en       timestamptz not null default now(),
  modificado_en   timestamptz not null default now(),
  creado_por      uuid references auth.users (id) on delete set null,
  modificado_por  uuid references auth.users (id) on delete set null
);
comment on table public.reuniones is 'Reuniones con colegas: quiénes vinieron (asistentes = ids de colegas). Solo administración.';
create index if not exists reuniones_fecha_idx on public.reuniones (fecha desc);

-- ---------------------------------------------------------------------
-- Consultas
-- ---------------------------------------------------------------------
create table if not exists public.consultas (
  id              uuid primary key default gen_random_uuid(),
  fecha           date not null,
  colega_id       uuid references public.colegas (id) on delete set null,
  desarrollo_id   text references public.desarrollos (id) on delete set null,
  propiedad_id    text references public.propiedades (id) on delete set null,
  unidad          text not null default '' check (length(unidad) <= 60),
  canal           text not null default 'whatsapp'
                  check (canal in ('whatsapp', 'llamada', 'mail', 'presencial', 'otro')),
  cliente         text not null default '' check (length(cliente) <= 120),
  notas           text not null default '' check (length(notas) <= 2000),
  creado_en       timestamptz not null default now(),
  modificado_en   timestamptz not null default now(),
  creado_por      uuid references auth.users (id) on delete set null,
  modificado_por  uuid references auth.users (id) on delete set null
);
comment on table public.consultas is 'Consultas de colegas por un desarrollo o unidad. Solo administración.';
create index if not exists consultas_fecha_idx on public.consultas (fecha desc);
create index if not exists consultas_colega_idx on public.consultas (colega_id);

-- ---------------------------------------------------------------------
-- Visitas a propiedades
-- ---------------------------------------------------------------------
create table if not exists public.visitas (
  id              uuid primary key default gen_random_uuid(),
  fecha           date not null,
  desarrollo_id   text references public.desarrollos (id) on delete set null,
  propiedad_id    text references public.propiedades (id) on delete set null,
  unidad          text not null default '' check (length(unidad) <= 60),
  cliente         text not null check (length(btrim(cliente)) between 1 and 120),
  cliente_telefono text not null default '' check (length(cliente_telefono) <= 40),
  origen          text not null default 'colega'
                  check (origen in ('colega', 'instagram', 'whatsapp', 'web', 'portal', 'cartel', 'referido', 'oficina', 'otro')),
  colega_id       uuid references public.colegas (id) on delete set null,
  resultado       text not null default 'pendiente'
                  check (resultado in ('pendiente', 'interesado', 'no_interesado', 'volvera', 'reservo', 'compro')),
  notas           text not null default '' check (length(notas) <= 2000),
  creado_en       timestamptz not null default now(),
  modificado_en   timestamptz not null default now(),
  creado_por      uuid references auth.users (id) on delete set null,
  modificado_por  uuid references auth.users (id) on delete set null
);
comment on table public.visitas is 'Visitas de clientes a propiedades: de dónde vienen y cómo les fue. Solo administración.';
create index if not exists visitas_fecha_idx on public.visitas (fecha desc);
create index if not exists visitas_colega_idx on public.visitas (colega_id);

-- ---------------------------------------------------------------------
-- Reservas y ventas
-- ---------------------------------------------------------------------
create table if not exists public.operaciones (
  id              uuid primary key default gen_random_uuid(),
  fecha           date not null,
  estado          text not null default 'venta' check (estado in ('reserva', 'venta', 'caida')),
  desarrollo_id   text references public.desarrollos (id) on delete set null,
  propiedad_id    text references public.propiedades (id) on delete set null,
  unidad          text not null default '' check (length(unidad) <= 60),
  colega_id       uuid references public.colegas (id) on delete set null,
  cliente         text not null default '' check (length(cliente) <= 120),
  monto           numeric(14, 2) check (monto is null or monto >= 0),
  moneda          text not null default 'USD' check (moneda in ('USD', 'ARS')),
  forma_pago      text not null default '' check (forma_pago in ('', 'contado', 'financiado', 'mixto')),
  comision_pct    numeric(5, 2) check (comision_pct is null or (comision_pct >= 0 and comision_pct <= 100)),
  comision_monto  numeric(14, 2) check (comision_monto is null or comision_monto >= 0),
  comision_pagada boolean not null default false,
  visita_id       uuid references public.visitas (id) on delete set null,
  notas           text not null default '' check (length(notas) <= 2000),
  creado_en       timestamptz not null default now(),
  modificado_en   timestamptz not null default now(),
  creado_por      uuid references auth.users (id) on delete set null,
  modificado_por  uuid references auth.users (id) on delete set null
);
comment on table public.operaciones is 'Reservas y ventas: con qué colega, cuánto y la comisión. Solo administración.';
create index if not exists operaciones_fecha_idx on public.operaciones (fecha desc);
create index if not exists operaciones_colega_idx on public.operaciones (colega_id);

-- ---------------------------------------------------------------------
-- Pendientes
-- ---------------------------------------------------------------------
create table if not exists public.pendientes (
  id              uuid primary key default gen_random_uuid(),
  fecha           date,
  texto           text not null check (length(btrim(texto)) between 1 and 300),
  colega_id       uuid references public.colegas (id) on delete set null,
  hecho           boolean not null default false,
  hecho_en        timestamptz,
  creado_en       timestamptz not null default now(),
  modificado_en   timestamptz not null default now(),
  creado_por      uuid references auth.users (id) on delete set null,
  modificado_por  uuid references auth.users (id) on delete set null
);
comment on table public.pendientes is 'Cosas para hacer (seguimiento de colegas y clientes). Solo administración.';
create index if not exists pendientes_hecho_idx on public.pendientes (hecho, fecha);

-- ---------------------------------------------------------------------
-- Sellos automáticos y permisos (igual que "colegas")
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['reuniones', 'consultas', 'visitas', 'operaciones', 'pendientes'] loop
    execute format('drop trigger if exists %I on public.%I', t || '_sellar', t);
    execute format('create trigger %I before insert or update on public.%I for each row execute function public.sellar_cambios()', t || '_sellar', t);
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('drop policy if exists %I on public.%I', t || ': solo admin ve', t);
    execute format('drop policy if exists %I on public.%I', t || ': solo admin crea', t);
    execute format('drop policy if exists %I on public.%I', t || ': solo admin modifica', t);
    execute format('drop policy if exists %I on public.%I', t || ': solo admin borra', t);
    execute format('create policy %I on public.%I for select to authenticated using ((select public.es_admin()))', t || ': solo admin ve', t);
    execute format('create policy %I on public.%I for insert to authenticated with check ((select public.es_admin()))', t || ': solo admin crea', t);
    execute format('create policy %I on public.%I for update to authenticated using ((select public.es_admin())) with check ((select public.es_admin()))', t || ': solo admin modifica', t);
    execute format('create policy %I on public.%I for delete to authenticated using ((select public.es_admin()))', t || ': solo admin borra', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- Fechas del proyecto y metas (privado). La fecha de inicio de la idea queda vacía: la carga Nahir.
-- ---------------------------------------------------------------------
insert into public.configuracion (clave, valor, publica)
values ('seguimiento',
        '{"inicio_idea": null, "lanzamiento": "2026-11-27", "limite": "2027-07-01", "meta_ventas": null, "meta_visitas": null, "meta_colegas": null}'::jsonb,
        false)
on conflict (clave) do nothing;
