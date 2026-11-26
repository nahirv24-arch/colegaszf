-- =====================================================================
-- Cuentas de colegas, registro de actividad y «Página cerrada» (26/11/2026).
--
-- SOLO AGREGA: columnas nuevas en "colegas" (vacías por defecto), una tabla nueva ("actividad"),
-- una clave nueva en "configuracion" (pagina_cerrada = false) y funciones. No borra ni modifica datos.
--
-- Mientras «Página cerrada» esté APAGADA (así queda al aplicar esta migración), la página pública
-- devuelve exactamente lo mismo que antes y cualquiera la puede ver.
--
-- Cuentas: el usuario es un nombre (ej. "juan.perez"). Por dentro, Supabase necesita un correo:
-- se usa "<usuario>@colegas.zf.local", que nunca recibe mails. La contraseña la arma el panel
-- y se guarda cifrada (bcrypt). Si el colega se la olvida, la administradora la resetea.
-- Las cuentas de colegas NO tienen rol: no pueden editar nada (todo lo exige es_admin()).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) Datos de acceso en el registro de colegas
-- ---------------------------------------------------------------------
alter table public.colegas add column if not exists usuario text;
alter table public.colegas add column if not exists user_id uuid references auth.users (id) on delete set null;
alter table public.colegas add column if not exists acceso_activo boolean not null default true;
alter table public.colegas add column if not exists clave_provisoria boolean not null default false;
alter table public.colegas add column if not exists ultimo_ingreso timestamptz;

do $$ begin
  alter table public.colegas add constraint colegas_usuario_formato
    check (usuario is null or usuario ~ '^[a-z0-9][a-z0-9._-]{2,39}$');
exception when duplicate_object then null; end $$;
create unique index if not exists colegas_usuario_unico on public.colegas (usuario) where usuario is not null;
create unique index if not exists colegas_user_id_unico on public.colegas (user_id) where user_id is not null;

comment on column public.colegas.usuario is 'Usuario para ingresar a la página (armado con el nombre). Correo interno: <usuario>@colegas.zf.local';
comment on column public.colegas.clave_provisoria is 'true = el colega tiene que cambiar la contraseña al entrar.';

-- ---------------------------------------------------------------------
-- 2) ¿Quién está mirando?
-- ---------------------------------------------------------------------
create or replace function public.mi_colega()
returns uuid language sql stable security definer set search_path = ''
as $$
  select c.id from public.colegas c
  where c.user_id = (select auth.uid()) and c.acceso_activo and auth.uid() is not null
  limit 1;
$$;

create or replace function public.es_colega()
returns boolean language sql stable security definer set search_path = ''
as $$ select public.mi_colega() is not null; $$;

create or replace function public.pagina_cerrada()
returns boolean language sql stable security definer set search_path = ''
as $$
  select coalesce((select c.valor = 'true'::jsonb from public.configuracion c where c.clave = 'pagina_cerrada'), false);
$$;

create or replace function public.puede_ver_contenido()
returns boolean language sql stable security definer set search_path = ''
as $$ select not public.pagina_cerrada() or public.es_colega() or public.es_admin(); $$;

insert into public.configuracion (clave, valor, publica) values ('pagina_cerrada', 'false'::jsonb, false)
on conflict (clave) do nothing;

/** Lo que la página necesita saber al abrir (también sin sesión). */
create or replace function public.estado_pagina()
returns json language sql stable security definer set search_path = ''
as $$
  select json_build_object(
    'cerrada', public.pagina_cerrada(),
    'admin', public.es_admin(),
    'cuenta', (select json_build_object('nombre', c.nombre_apellido, 'usuario', c.usuario,
                                        'clave_provisoria', c.clave_provisoria, 'activa', c.acceso_activo)
               from public.colegas c where c.user_id = (select auth.uid()) and auth.uid() is not null limit 1));
$$;

-- ---------------------------------------------------------------------
-- 3) La página pública respeta «Página cerrada» (con la página abierta, devuelven lo mismo que antes)
-- ---------------------------------------------------------------------
create or replace function public.contenido_publico()
returns json language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.puede_ver_contenido() then
    raise exception 'pagina_cerrada' using errcode = '42501', hint = 'Ingresá con tu usuario y contraseña.';
  end if;
  return (
  with pub as (
    select case when d.desactualizado
                then (left(p.contenido::text, -1) || ', "desactualizado" : true}')::json
                else p.contenido end as contenido,
           d.posicion, d.id
    from public.publicaciones p
    join public.desarrollos d on d.id = p.desarrollo_id
    where p.vigente and d.estado = 'publicado' and d.visible and d.eliminado_en is null),
  rutas as (
    select distinct x.r
    from pub,
    lateral (
      select pub.contenido ->> 'portada' as r
      union all select json_array_elements_text(pub.contenido -> 'imagenes')
      union all select json_array_elements_text(pub.contenido -> 'galeria')
      union all select json_array_elements_text(pub.contenido -> 'planos')
      union all select json_array_elements_text(pub.contenido -> 'brochurePags')) x
    where x.r is not null and x.r <> ''
    union
    select public._ruta_publica(m.bucket, m.ruta) from public.medios m
    where m.desarrollo_id is null and m.eliminado_en is null),
  datos as (
    select distinct on (r) r, mm.sha256, mm.bytes, mm.formato, mm.ancho, mm.alto
    from (select case when mm.bucket = 'media' then 'media/' || mm.ruta else mm.bucket || '/' || mm.ruta end as r, mm.*
          from public.medios mm) mm
    order by r, mm.creado_en desc)
  select json_build_object(
    'sitio', json_build_object(
      'actualizado', coalesce((select c.valor #>> '{}' from public.configuracion c where c.clave = 'actualizado'), ''),
      'portada', coalesce((select public._ruta_publica(m.bucket, m.ruta) from public.medios m
                           where m.tipo = 'portada_general' and m.eliminado_en is null order by m.orden limit 1), ''),
      'emprendimientos', coalesce((select json_agg(pub.contenido order by pub.posicion, pub.id) from pub), '[]'::json)),
    'logo', coalesce((select public._ruta_publica(m.bucket, m.ruta) from public.medios m
                      where m.tipo = 'logo' and m.eliminado_en is null order by m.orden limit 1), ''),
    'medios', coalesce((
      select json_agg(json_build_object('ruta', rutas.r, 'sha256', m.sha256, 'bytes', m.bytes,
                                        'formato', m.formato, 'ancho', m.ancho, 'alto', m.alto) order by rutas.r)
      from rutas
      left join datos m on m.r = rutas.r), '[]'::json)));
end;
$$;

create or replace function public.propiedades_publicas()
returns json language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.puede_ver_contenido() then
    raise exception 'pagina_cerrada' using errcode = '42501', hint = 'Ingresá con tu usuario y contraseña.';
  end if;
  return (
  with pub as (
    select pp.contenido, p.categoria, p.posicion, p.creado_en, p.id
    from public.propiedad_publicaciones pp
    join public.propiedades p on p.id = pp.propiedad_id
    where pp.vigente and p.estado = 'publicado' and p.visible and p.eliminado_en is null),
  rutas as (
    select distinct x.r
    from pub,
    lateral (
      select pub.contenido ->> 'portada' as r
      union all select json_array_elements_text(pub.contenido -> 'fotos')
      union all select json_array_elements_text(pub.contenido -> 'planos')) x
    where x.r is not null and x.r <> '')
  select json_build_object(
    'terceros', coalesce((select json_agg(pub.contenido order by pub.posicion, pub.creado_en desc, pub.id)
                          from pub where pub.categoria = 'tercero'), '[]'::json),
    'comercios', coalesce((select json_agg(pub.contenido order by pub.posicion, pub.creado_en desc, pub.id)
                           from pub where pub.categoria = 'comercio'), '[]'::json),
    'medios', coalesce((
      select json_agg(json_build_object('ruta', rutas.r, 'sha256', m.sha256, 'bytes', m.bytes,
                                        'formato', m.formato, 'ancho', m.ancho, 'alto', m.alto) order by rutas.r)
      from rutas
      left join lateral (select mm.* from public.propiedad_medios mm
                         where public._ruta_publica(mm.bucket, mm.ruta) = rutas.r
                         order by mm.creado_en desc limit 1) m on true), '[]'::json)));
end;
$$;

-- Las versiones publicadas también se podían leer directo: con la página cerrada, solo con cuenta.
-- (Política RESTRICTIVA: se suma a la que ya existe, no la reemplaza.)
drop policy if exists "publicaciones: con la página cerrada, solo con cuenta" on public.publicaciones;
create policy "publicaciones: con la página cerrada, solo con cuenta"
  on public.publicaciones as restrictive for select to anon, authenticated
  using ((select public.puede_ver_contenido()));

-- ---------------------------------------------------------------------
-- 4) Cuentas: crear, resetear contraseña, pausar (solo la administradora)
-- ---------------------------------------------------------------------
create or replace function public._correo_colega(p_usuario text)
returns text language sql immutable set search_path = ''
as $$ select lower(p_usuario) || '@colegas.zf.local'; $$;

create or replace function public._cerrar_sesiones(p_user uuid)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  delete from auth.sessions where user_id = p_user;
  delete from auth.refresh_tokens where user_id::text = p_user::text;
end;
$$;

create or replace function public.crear_acceso_colega(p_colega uuid, p_usuario text, p_clave text)
returns void language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_usuario text := lower(btrim(p_usuario));
  v_correo text;
  v_id uuid := gen_random_uuid();
  v_col public.colegas%rowtype;
begin
  if not public.es_admin() then raise exception 'Sin permiso' using errcode = '42501'; end if;
  select * into v_col from public.colegas where id = p_colega for update;
  if not found then raise exception 'No existe ese colega.'; end if;
  if v_col.user_id is not null then raise exception 'Ese colega ya tiene acceso.'; end if;
  if v_usuario !~ '^[a-z0-9][a-z0-9._-]{2,39}$' then
    raise exception 'El usuario tiene que tener entre 3 y 40 letras sin acentos, números o puntos (ej.: juan.perez).';
  end if;
  if length(coalesce(p_clave, '')) < 10 then raise exception 'La contraseña tiene que tener al menos 10 caracteres.'; end if;
  v_correo := public._correo_colega(v_usuario);
  if exists (select 1 from public.colegas where usuario = v_usuario)
     or exists (select 1 from auth.users where lower(email) = v_correo) then
    raise exception 'El usuario «%» ya existe. Probá con otro (por ejemplo, agregando la inicial del segundo nombre).', v_usuario;
  end if;

  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                          raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
                          confirmation_token, recovery_token, email_change_token_new, email_change,
                          email_change_token_current, phone_change, phone_change_token, reauthentication_token)
  values ('00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated', v_correo,
          extensions.crypt(p_clave, extensions.gen_salt('bf')), now(),
          '{"provider":"email","providers":["email"],"colega":true}'::jsonb,
          json_build_object('nombre', v_col.nombre_apellido)::jsonb, now(), now(),
          '', '', '', '', '', '', '', '');
  insert into auth.identities (id, provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  values (gen_random_uuid(), v_id::text, v_id,
          json_build_object('sub', v_id::text, 'email', v_correo, 'email_verified', true)::jsonb,
          'email', null, now(), now());

  update public.colegas set usuario = v_usuario, user_id = v_id, acceso_activo = true, clave_provisoria = true
  where id = p_colega;
end;
$$;

create or replace function public.resetear_clave_colega(p_colega uuid, p_clave text)
returns void language plpgsql volatile security definer set search_path = ''
as $$
declare v_user uuid;
begin
  if not public.es_admin() then raise exception 'Sin permiso' using errcode = '42501'; end if;
  if length(coalesce(p_clave, '')) < 10 then raise exception 'La contraseña tiene que tener al menos 10 caracteres.'; end if;
  select user_id into v_user from public.colegas where id = p_colega;
  if v_user is null then raise exception 'Ese colega todavía no tiene acceso.'; end if;
  update auth.users set encrypted_password = extensions.crypt(p_clave, extensions.gen_salt('bf')), updated_at = now()
  where id = v_user;
  perform public._cerrar_sesiones(v_user);
  update public.colegas set clave_provisoria = true where id = p_colega;
end;
$$;

create or replace function public.pausar_acceso_colega(p_colega uuid, p_activo boolean)
returns void language plpgsql volatile security definer set search_path = ''
as $$
declare v_user uuid;
begin
  if not public.es_admin() then raise exception 'Sin permiso' using errcode = '42501'; end if;
  update public.colegas set acceso_activo = p_activo where id = p_colega returning user_id into v_user;
  if not found then raise exception 'No existe ese colega.'; end if;
  if not p_activo and v_user is not null then perform public._cerrar_sesiones(v_user); end if;
end;
$$;

/** El colega cambió su contraseña (desde la página): deja de ser provisoria. */
create or replace function public.marcar_clave_cambiada()
returns void language sql volatile security definer set search_path = ''
as $$
  update public.colegas set clave_provisoria = false where user_id = (select auth.uid()) and auth.uid() is not null;
$$;

/** Al quitar un colega del registro, su cuenta se borra (no puede volver a entrar). */
create or replace function public._borrar_cuenta_colega()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if old.user_id is not null then delete from auth.users where id = old.user_id; end if;
  return old;
end;
$$;
drop trigger if exists colegas_borrar_cuenta on public.colegas;
create trigger colegas_borrar_cuenta after delete on public.colegas
  for each row execute function public._borrar_cuenta_colega();

-- ---------------------------------------------------------------------
-- 5) Registro de actividad
-- ---------------------------------------------------------------------
create table if not exists public.actividad (
  id            bigint generated always as identity primary key,
  colega_id     uuid references public.colegas (id) on delete set null,
  colega_nombre text not null default '',
  tipo          text not null check (tipo in ('ingreso', 'ver_ficha', 'ver_precio', 'descarga',
                                              'ver_propiedad', 'ver_fotos', 'descarga_fotos', 'ver_categoria')),
  desarrollo_id text,
  propiedad_id  text,
  detalle       jsonb not null default '{}'::jsonb
                check (jsonb_typeof(detalle) = 'object' and length(detalle::text) <= 2000),
  creado_en     timestamptz not null default now()
);
comment on table public.actividad is 'Qué hace cada colega en la página (solo cuentas de colegas; solo lo lee la administración).';
create index if not exists actividad_fecha_idx on public.actividad (creado_en desc);
create index if not exists actividad_colega_idx on public.actividad (colega_id, creado_en desc);
create index if not exists actividad_desarrollo_idx on public.actividad (desarrollo_id, creado_en desc) where desarrollo_id is not null;

alter table public.actividad enable row level security;
revoke all on public.actividad from anon, authenticated;
grant select on public.actividad to authenticated;
drop policy if exists "actividad: solo admin lee" on public.actividad;
create policy "actividad: solo admin lee" on public.actividad for select to authenticated
  using ((select public.es_admin()));

/** Lo llama la página. Solo registra a colegas con acceso activo; repetidos en 15 s se ignoran. */
create or replace function public.registrar_actividad(p_tipo text, p_desarrollo text default null,
                                                      p_propiedad text default null, p_detalle jsonb default '{}'::jsonb)
returns void language plpgsql volatile security definer set search_path = ''
as $$
declare v_col public.colegas%rowtype;
begin
  select * into v_col from public.colegas where user_id = (select auth.uid()) and acceso_activo and auth.uid() is not null;
  if not found then return; end if;
  p_detalle := coalesce(p_detalle, '{}'::jsonb);
  if exists (select 1 from public.actividad a
             where a.colega_id = v_col.id and a.tipo = p_tipo
               and a.desarrollo_id is not distinct from p_desarrollo and a.propiedad_id is not distinct from p_propiedad
               and a.detalle = p_detalle and a.creado_en > now() - interval '15 seconds') then
    return;
  end if;
  insert into public.actividad (colega_id, colega_nombre, tipo, desarrollo_id, propiedad_id, detalle)
  values (v_col.id, v_col.nombre_apellido, p_tipo, left(p_desarrollo, 80), left(p_propiedad, 80), p_detalle);
  if p_tipo = 'ingreso' then update public.colegas set ultimo_ingreso = now() where id = v_col.id; end if;
end;
$$;

-- ---------------------------------------------------------------------
-- 6) Permisos
-- ---------------------------------------------------------------------
revoke all on function public.mi_colega(), public.es_colega(), public.pagina_cerrada(), public.puede_ver_contenido(),
  public.estado_pagina(), public._correo_colega(text), public._cerrar_sesiones(uuid),
  public.crear_acceso_colega(uuid, text, text), public.resetear_clave_colega(uuid, text),
  public.pausar_acceso_colega(uuid, boolean), public.marcar_clave_cambiada(), public._borrar_cuenta_colega(),
  public.registrar_actividad(text, text, text, jsonb) from public;
grant execute on function public.es_colega(), public.pagina_cerrada(), public.puede_ver_contenido(), public.mi_colega()
  to anon, authenticated;
grant execute on function public.estado_pagina() to anon, authenticated;
grant execute on function public.crear_acceso_colega(uuid, text, text), public.resetear_clave_colega(uuid, text),
  public.pausar_acceso_colega(uuid, boolean), public.marcar_clave_cambiada(),
  public.registrar_actividad(text, text, text, jsonb) to authenticated;
revoke all on function public.contenido_publico(), public.propiedades_publicas() from public;
grant execute on function public.contenido_publico(), public.propiedades_publicas() to anon, authenticated, service_role;
