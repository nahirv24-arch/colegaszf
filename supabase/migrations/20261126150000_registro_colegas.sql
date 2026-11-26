-- =====================================================================
-- Registro propio de colegas (26/11/2026).
--
-- SOLO AGREGA: dos columnas en "colegas" (pendiente = false y origen = 'panel' para los que ya existen)
-- y funciones. No borra ni modifica datos.
--
-- El colega crea su cuenta desde la página con nombre, usuario y contraseña.
-- Queda PENDIENTE (sin acceso) hasta que la administradora lo aprueba en el panel.
-- Mientras está pendiente, acceso_activo = false: no ve nada con la página cerrada y no se registra su actividad.
-- =====================================================================

alter table public.colegas add column if not exists pendiente boolean not null default false;
alter table public.colegas add column if not exists origen text not null default 'panel';
do $$ begin
  alter table public.colegas add constraint colegas_origen_valido check (origen in ('panel', 'registro'));
exception when duplicate_object then null; end $$;
comment on column public.colegas.pendiente is 'true = se registró solo y espera la aprobación de la administradora.';
comment on column public.colegas.origen is 'panel = lo cargó la administradora; registro = se creó la cuenta desde la página.';

/** Crea el usuario de Supabase (correo interno <usuario>@colegas.zf.local). Devuelve su id. */
create or replace function public._crear_usuario_colega(p_usuario text, p_clave text, p_nombre text)
returns uuid language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_id uuid := gen_random_uuid();
  v_correo text := public._correo_colega(p_usuario);
begin
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                          raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
                          confirmation_token, recovery_token, email_change_token_new, email_change,
                          email_change_token_current, phone_change, phone_change_token, reauthentication_token)
  values ('00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated', v_correo,
          extensions.crypt(p_clave, extensions.gen_salt('bf')), now(),
          '{"provider":"email","providers":["email"],"colega":true}'::jsonb,
          json_build_object('nombre', p_nombre)::jsonb, now(), now(),
          '', '', '', '', '', '', '', '');
  insert into auth.identities (id, provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  values (gen_random_uuid(), v_id::text, v_id,
          json_build_object('sub', v_id::text, 'email', v_correo, 'email_verified', true)::jsonb,
          'email', null, now(), now());
  return v_id;
end;
$$;

/** Lo llama la página (sin sesión): el colega se crea la cuenta y queda pendiente de aprobación. */
create or replace function public.registrar_colega(p_nombre text, p_usuario text, p_clave text)
returns void language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_nombre text := regexp_replace(btrim(coalesce(p_nombre, '')), '\s+', ' ', 'g');
  v_usuario text := lower(btrim(coalesce(p_usuario, '')));
  v_col uuid;
  v_user uuid;
begin
  if length(v_nombre) < 3 or length(v_nombre) > 120 then
    raise exception 'Escribí tu nombre y apellido.';
  end if;
  if v_usuario !~ '^[a-z0-9][a-z0-9._-]{2,39}$' then
    raise exception 'El usuario tiene que tener entre 3 y 40 letras sin acentos, números o puntos (ej.: juan.perez).';
  end if;
  if length(coalesce(p_clave, '')) < 8 then raise exception 'La contraseña tiene que tener al menos 8 caracteres.'; end if;
  if length(p_clave) > 72 then raise exception 'La contraseña es demasiado larga (máximo 72 caracteres).'; end if;
  -- Freno contra registros masivos: si se juntan demasiados pendientes, hay que escribir por WhatsApp.
  if (select count(*) from public.colegas where pendiente) >= 50
     or (select count(*) from public.colegas where origen = 'registro' and creado_en > now() - interval '1 hour') >= 20 then
    raise exception 'Por ahora no podemos tomar más registros. Escribinos por WhatsApp y te damos acceso.';
  end if;
  if exists (select 1 from public.colegas where usuario = v_usuario)
     or exists (select 1 from auth.users where lower(email) = public._correo_colega(v_usuario)) then
    raise exception 'El usuario «%» ya existe. Probá con otro (por ejemplo, agregando la inicial del segundo nombre).', v_usuario;
  end if;

  v_user := public._crear_usuario_colega(v_usuario, p_clave, v_nombre);
  insert into public.colegas (nombre_apellido, usuario, user_id, origen, pendiente, acceso_activo, clave_provisoria)
  values (v_nombre, v_usuario, v_user, 'registro', true, false, false)
  returning id into v_col;
end;
$$;

/** La administradora aprueba (o rechaza, con «Quitar») a un colega que se registró solo. */
create or replace function public.aprobar_colega(p_colega uuid)
returns void language plpgsql volatile security definer set search_path = ''
as $$
begin
  if not public.es_admin() then raise exception 'Sin permiso' using errcode = '42501'; end if;
  update public.colegas set pendiente = false, acceso_activo = true where id = p_colega;
  if not found then raise exception 'No existe ese colega.'; end if;
end;
$$;

/** Reactivar a alguien pendiente también lo aprueba. */
create or replace function public.pausar_acceso_colega(p_colega uuid, p_activo boolean)
returns void language plpgsql volatile security definer set search_path = ''
as $$
declare v_user uuid;
begin
  if not public.es_admin() then raise exception 'Sin permiso' using errcode = '42501'; end if;
  update public.colegas set acceso_activo = p_activo, pendiente = case when p_activo then false else pendiente end
  where id = p_colega returning user_id into v_user;
  if not found then raise exception 'No existe ese colega.'; end if;
  if not p_activo and v_user is not null then perform public._cerrar_sesiones(v_user); end if;
end;
$$;

/** Lo que la página necesita saber al abrir: ahora también si la cuenta está pendiente. */
create or replace function public.estado_pagina()
returns json language sql stable security definer set search_path = ''
as $$
  select json_build_object(
    'cerrada', public.pagina_cerrada(),
    'admin', public.es_admin(),
    'cuenta', (select json_build_object('nombre', c.nombre_apellido, 'usuario', c.usuario,
                                        'clave_provisoria', c.clave_provisoria, 'activa', c.acceso_activo,
                                        'pendiente', c.pendiente)
               from public.colegas c where c.user_id = (select auth.uid()) and auth.uid() is not null limit 1),
    'logo', coalesce((select public._ruta_publica(m.bucket, m.ruta) from public.medios m
                      where m.tipo = 'logo' and m.eliminado_en is null order by m.orden limit 1), ''));
$$;

revoke all on function public._crear_usuario_colega(text, text, text), public.registrar_colega(text, text, text),
  public.aprobar_colega(uuid), public.pausar_acceso_colega(uuid, boolean), public.estado_pagina() from public;
grant execute on function public.registrar_colega(text, text, text), public.estado_pagina() to anon, authenticated;
grant execute on function public.aprobar_colega(uuid), public.pausar_acceso_colega(uuid, boolean) to authenticated;
