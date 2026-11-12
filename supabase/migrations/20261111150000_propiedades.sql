-- =====================================================================
-- Etapa 3 · Terceros y Comercios (propiedades individuales)
--
-- SOLO AGREGA: tablas, funciones y políticas nuevas. No modifica ni borra nada de los
-- desarrollos (tablas, versiones, funciones, links). La web pública sigue leyendo los
-- desarrollos con contenido_publico() exactamente igual; Terceros y Comercios se leen
-- con una función aparte, propiedades_publicas().
--
-- Mismo modelo que los desarrollos:
--   * propiedades / propiedad_medios = COPIA DE TRABAJO (solo la administradora).
--   * propiedad_publicaciones = versiones congeladas al publicar; el público ve solo la vigente.
--   * Estados: borrador · publicado · despublicado (= publicado con visible = false).
--   * Papelera (eliminado_en) en lugar de borrado definitivo. Historial automático.
-- Privacidad: NO hay campos para datos de propietarios (nombre, teléfono, email).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) Propiedades (Terceros y Comercios)
-- ---------------------------------------------------------------------
create table public.propiedades (
  id             text primary key
                 check (id ~ '^[a-z0-9][a-z0-9-]*$'),                 -- va en el link: /terceros#casa-cerro
  categoria      text not null check (categoria in ('tercero', 'comercio')),
  posicion       integer not null default 0,                           -- orden manual (0 = sin orden)
  titulo         text not null check (length(btrim(titulo)) > 0),
  operacion      text not null default ''
                 check (operacion in ('', 'venta', 'alquiler', 'venta_alquiler')),
  direccion      text not null default '',
  barrio         text not null default '',
  precio         text not null default '',                              -- TEXTO, como en los desarrollos ("USD 120.000")
  expensas       text not null default '',
  superficie     text not null default '',                              -- texto libre ("85 m² cubiertos")
  disponibilidad text not null default 'disponible'
                 check (disponibilidad in ('disponible', 'reservada', 'vendida', 'alquilada', 'no_disponible')),
  descripcion    text not null default '',
  detalles       jsonb not null default '{}'::jsonb                     -- campos propios de cada categoría
                 check (jsonb_typeof(detalles) = 'object'),
  links          jsonb not null default '{}'::jsonb                     -- video, recorrido 360°, mapa…
                 check (jsonb_typeof(links) = 'object'),
  estado         text not null default 'borrador' check (estado in ('borrador', 'publicado')),
  visible        boolean not null default true,                         -- false = despublicado
  creado_en      timestamptz not null default now(),
  modificado_en  timestamptz not null default now(),
  creado_por     uuid references auth.users (id) on delete set null,
  modificado_por uuid references auth.users (id) on delete set null,
  eliminado_en   timestamptz,                                           -- papelera (recuperable)
  eliminado_por  uuid references auth.users (id) on delete set null
);
comment on table public.propiedades is
  'Propiedades de terceros y comercios. Copia de trabajo: el público lee propiedad_publicaciones. Sin datos de propietarios.';
comment on column public.propiedades.detalles is
  'Terceros: tipo, ambientes, dormitorios, banos, cochera, antiguedad. Comercios: rubro, frente, planta, banos. Valores de texto.';
create index propiedades_categoria_idx on public.propiedades (categoria, posicion) where eliminado_en is null;

-- ---------------------------------------------------------------------
-- 2) Archivos de cada propiedad (fotos, planos, documentación en PDF)
--    Los archivos viven en el bucket "media", carpeta propiedades/<id>/…
-- ---------------------------------------------------------------------
create table public.propiedad_medios (
  id             uuid primary key default gen_random_uuid(),
  propiedad_id   text not null references public.propiedades (id) on update cascade on delete restrict,
  tipo           text not null check (tipo in ('portada', 'foto', 'plano', 'documento')),
  orden          integer not null check (orden >= 0),
  bucket         text not null default 'media' check (bucket in ('media', 'privado')),
  ruta           text not null,
  nombre         text not null default '',                              -- nombre visible del documento
  ancho          integer check (ancho > 0),
  alto           integer check (alto > 0),
  bytes          bigint check (bytes >= 0),
  sha256         text check (sha256 ~ '^[0-9a-f]{64}$'),
  formato        text check (formato in ('jpeg', 'png', 'webp', 'pdf')),
  mime           text,
  metadatos      jsonb not null default '{}'::jsonb,
  creado_en      timestamptz not null default now(),
  modificado_en  timestamptz not null default now(),
  creado_por     uuid references auth.users (id) on delete set null,
  modificado_por uuid references auth.users (id) on delete set null,
  eliminado_en   timestamptz,
  eliminado_por  uuid references auth.users (id) on delete set null,
  constraint propiedad_medios_documento_pdf check ((tipo = 'documento') = (formato is not distinct from 'pdf'))
);
create unique index propiedad_medios_posicion_unica on public.propiedad_medios (propiedad_id, tipo, orden)
  where eliminado_en is null;

-- ---------------------------------------------------------------------
-- 3) Versiones publicadas
-- ---------------------------------------------------------------------
create table public.propiedad_publicaciones (
  id            bigint generated always as identity primary key,
  propiedad_id  text not null references public.propiedades (id) on update cascade on delete restrict,
  version       integer not null check (version > 0),
  contenido     json not null,
  vigente       boolean not null default false,
  publicado_en  timestamptz not null default now(),
  publicado_por uuid references auth.users (id) on delete set null,
  nota          text not null default '',
  constraint propiedad_publicaciones_version_unica unique (propiedad_id, version)
);
create unique index propiedad_publicaciones_una_vigente on public.propiedad_publicaciones (propiedad_id) where vigente;

-- ---------------------------------------------------------------------
-- 4) Sellos, historial e identificador fijo (mismas funciones que los desarrollos)
-- ---------------------------------------------------------------------
create trigger propiedades_sellar before insert or update on public.propiedades
  for each row execute function public.sellar_cambios();
create trigger propiedad_medios_sellar before insert or update on public.propiedad_medios
  for each row execute function public.sellar_cambios();

create trigger propiedades_historial after insert or update or delete on public.propiedades
  for each row execute function public.registrar_cambio();
create trigger propiedad_medios_historial after insert or update or delete on public.propiedad_medios
  for each row execute function public.registrar_cambio();
create trigger propiedad_publicaciones_historial after insert or update or delete on public.propiedad_publicaciones
  for each row execute function public.registrar_cambio();

create or replace function public.bloquear_cambio_id_propiedad()
returns trigger language plpgsql set search_path = ''
as $$
begin
  if new.id is distinct from old.id then
    raise exception 'El identificador de una propiedad no se puede cambiar (los links dejarían de funcionar)'
      using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function public.bloquear_cambio_id_propiedad() from public, anon, authenticated;
create trigger propiedades_id_inmutable before update of id on public.propiedades
  for each row execute function public.bloquear_cambio_id_propiedad();

-- ---------------------------------------------------------------------
-- 5) Permisos: el público NO lee la copia de trabajo; solo la administradora escribe.
--    Nadie borra definitivamente desde el navegador.
-- ---------------------------------------------------------------------
revoke all on public.propiedades, public.propiedad_medios, public.propiedad_publicaciones from anon, authenticated;
grant select, insert, update on public.propiedades, public.propiedad_medios to authenticated;
grant select on public.propiedad_publicaciones to authenticated;

alter table public.propiedades             enable row level security;
alter table public.propiedad_medios        enable row level security;
alter table public.propiedad_publicaciones enable row level security;

create policy "propiedades: solo admin ve la copia de trabajo"
  on public.propiedades for select to authenticated using ((select public.es_admin()));
create policy "propiedades: solo admin crea"
  on public.propiedades for insert to authenticated with check ((select public.es_admin()));
create policy "propiedades: solo admin modifica"
  on public.propiedades for update to authenticated
  using ((select public.es_admin())) with check ((select public.es_admin()));

create policy "propiedad_medios: solo admin ve la copia de trabajo"
  on public.propiedad_medios for select to authenticated using ((select public.es_admin()));
create policy "propiedad_medios: solo admin crea"
  on public.propiedad_medios for insert to authenticated with check ((select public.es_admin()));
create policy "propiedad_medios: solo admin modifica"
  on public.propiedad_medios for update to authenticated
  using ((select public.es_admin())) with check ((select public.es_admin()));

create policy "propiedad_publicaciones: solo admin lee las versiones"
  on public.propiedad_publicaciones for select to authenticated using ((select public.es_admin()));
-- Sin políticas de escritura: solo se publica con publicar_propiedad() (exige ser admin).

-- ---------------------------------------------------------------------
-- 6) Armado del JSON de una propiedad (lo que se congela al publicar)
-- ---------------------------------------------------------------------
create or replace function public._propiedad_medios_json(p_id text, p_tipo text)
returns json language sql stable set search_path = ''
as $$
  select coalesce(json_agg(public._ruta_publica(m.bucket, m.ruta) order by m.orden), '[]'::json)
  from public.propiedad_medios m
  where m.propiedad_id = p_id and m.tipo = p_tipo and m.eliminado_en is null;
$$;

create or replace function public._propiedad_json(p public.propiedades)
returns json language sql stable set search_path = ''
as $$
  select json_build_object(
    'id', p.id,
    'categoria', p.categoria,
    'titulo', p.titulo,
    'operacion', p.operacion,
    'direccion', p.direccion,
    'barrio', p.barrio,
    'precio', p.precio,
    'expensas', p.expensas,
    'superficie', p.superficie,
    'disponibilidad', p.disponibilidad,
    'descripcion', p.descripcion,
    'detalles', p.detalles,
    'links', p.links,
    'portada', coalesce((select public._ruta_publica(m.bucket, m.ruta) from public.propiedad_medios m
                         where m.propiedad_id = p.id and m.tipo = 'portada' and m.eliminado_en is null
                         order by m.orden limit 1), ''),
    'fotos', public._propiedad_medios_json(p.id, 'foto'),
    'planos', public._propiedad_medios_json(p.id, 'plano'),
    'documentos', coalesce((select json_agg(json_build_object('ruta', public._ruta_publica(m.bucket, m.ruta),
                                                              'nombre', m.nombre) order by m.orden)
                            from public.propiedad_medios m
                            where m.propiedad_id = p.id and m.tipo = 'documento' and m.eliminado_en is null), '[]'::json));
$$;
revoke all on function public._propiedad_medios_json(text, text), public._propiedad_json(public.propiedades)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 7) Lo que ve la web pública: SOLO la versión vigente de las propiedades publicadas y visibles.
--    Devuelve { terceros: [...], comercios: [...], medios: [...] } (medios = medidas de las imágenes).
-- ---------------------------------------------------------------------
create or replace function public.propiedades_publicas()
returns json language sql stable security definer set search_path = ''
as $$
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
                         order by mm.creado_en desc limit 1) m on true), '[]'::json));
$$;
revoke all on function public.propiedades_publicas() from public;
grant execute on function public.propiedades_publicas() to anon, authenticated;

-- ---------------------------------------------------------------------
-- 8) Publicar, despublicar (visible = false, desde el panel), papelera
-- ---------------------------------------------------------------------
create or replace function public.publicar_propiedad(p_id text, p_nota text default '', p_actualizar_fecha boolean default true)
returns integer language plpgsql security definer set search_path = ''
as $$
declare
  v_p   public.propiedades;
  v_ver integer;
begin
  if not public.es_admin() then raise exception 'Sin permiso' using errcode = '42501'; end if;
  select * into v_p from public.propiedades where id = p_id and eliminado_en is null for update;
  if not found then raise exception 'La propiedad no existe o está en la papelera'; end if;
  if length(btrim(v_p.titulo)) = 0 then raise exception 'Falta el título de la propiedad'; end if;
  select coalesce(max(version), 0) + 1 into v_ver from public.propiedad_publicaciones where propiedad_id = p_id;
  update public.propiedad_publicaciones set vigente = false where propiedad_id = p_id and vigente;
  insert into public.propiedad_publicaciones (propiedad_id, version, contenido, vigente, publicado_por, nota)
  values (p_id, v_ver, public._propiedad_json(v_p), true, auth.uid(), coalesce(p_nota, ''));
  if v_p.estado <> 'publicado' or not v_p.visible then
    update public.propiedades set estado = 'publicado', visible = true where id = p_id;
  end if;
  if p_actualizar_fecha then
    update public.configuracion
      set valor = to_jsonb(to_char((now() at time zone 'America/Argentina/Cordoba')::date, 'YYYY-MM-DD'))
      where clave = 'actualizado';
  end if;
  return v_ver;
end;
$$;
revoke all on function public.publicar_propiedad(text, text, boolean) from public, anon;
grant execute on function public.publicar_propiedad(text, text, boolean) to authenticated;

create or replace function public.eliminar_propiedad(p_id text)
returns void language plpgsql security invoker set search_path = ''
as $$
begin
  if not public.es_admin() then raise exception 'Sin permiso' using errcode = '42501'; end if;
  update public.propiedades set eliminado_en = now() where id = p_id and eliminado_en is null;
  if not found then raise exception 'No existe o ya estaba en la papelera: %', p_id; end if;
end;
$$;

create or replace function public.restaurar_propiedad(p_id text)
returns void language plpgsql security invoker set search_path = ''
as $$
begin
  if not public.es_admin() then raise exception 'Sin permiso' using errcode = '42501'; end if;
  update public.propiedades set eliminado_en = null where id = p_id and eliminado_en is not null;
  if not found then raise exception 'No está en la papelera: %', p_id; end if;
end;
$$;
revoke all on function public.eliminar_propiedad(text), public.restaurar_propiedad(text) from public, anon;
grant execute on function public.eliminar_propiedad(text), public.restaurar_propiedad(text) to authenticated;
