-- =====================================================================
-- Fase 5 · Versiones publicadas, papelera de unidades y funciones del panel
--
-- PROBLEMA: cada desarrollo tenía una sola copia de sus datos. Si la web pública leyera esas
-- tablas, cualquier cambio a medio hacer en el panel se vería al instante.
-- SOLUCIÓN (aditiva, no borra nada):
--   * Las tablas desarrollos / unidades / medios pasan a ser la COPIA DE TRABAJO (solo el admin).
--   * "publicaciones" guarda fotos congeladas de cada desarrollo al publicar (versión 1, 2, 3…).
--     La web pública lee SOLO la versión vigente. Las anteriores sirven para recuperar.
--   * Las unidades también van a la papelera (borrado reversible).
--   * Los archivos de Storage nunca se borran: reemplazar sube un archivo nuevo, así las
--     versiones anteriores siguen viéndose bien.
-- Los 17 desarrollos ya publicados reciben su versión 1 con su contenido actual (sin cambios).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) Unidades: papelera (borrado reversible) y orden único solo entre las activas
-- ---------------------------------------------------------------------
alter table public.unidades
  add column eliminado_en  timestamptz,
  add column eliminado_por uuid references auth.users (id) on delete set null;

alter table public.unidades drop constraint unidades_posicion_unica;
create unique index unidades_posicion_activa on public.unidades (desarrollo_id, posicion)
  where eliminado_en is null;

drop policy "unidades: solo admin quita filas" on public.unidades;
revoke delete on public.unidades from authenticated;   -- ya no hay borrado definitivo desde el navegador

-- ---------------------------------------------------------------------
-- 2) Versiones publicadas
-- ---------------------------------------------------------------------
create table public.publicaciones (
  id            bigint generated always as identity primary key,
  desarrollo_id text not null references public.desarrollos (id) on update cascade on delete restrict,
  version       integer not null check (version > 0),
  contenido     json not null,          -- json (no jsonb) para conservar el orden original de las claves
  vigente       boolean not null default false,
  publicado_en  timestamptz not null default now(),
  publicado_por uuid references auth.users (id) on delete set null,
  nota          text not null default '',
  constraint publicaciones_version_unica unique (desarrollo_id, version)
);
create unique index publicaciones_una_vigente on public.publicaciones (desarrollo_id) where vigente;
comment on table public.publicaciones is 'Fotos congeladas de cada desarrollo al publicarlo. La web pública lee solo la vigente.';

create trigger publicaciones_historial after insert or update or delete on public.publicaciones
  for each row execute function public.registrar_cambio();

alter table public.publicaciones enable row level security;
revoke all on public.publicaciones from anon, authenticated;
grant select on public.publicaciones to anon, authenticated;
create policy "publicaciones: público ve la vigente de desarrollos visibles; admin ve todo"
  on public.publicaciones for select to anon, authenticated
  using ((vigente and public.desarrollo_es_publico(desarrollo_id)) or (select public.es_admin()));
-- Sin políticas de escritura: solo se publica con publicar_desarrollo() (que exige ser admin).

-- ---------------------------------------------------------------------
-- 3) La copia de trabajo deja de ser pública (la web lee las versiones publicadas)
-- ---------------------------------------------------------------------
drop policy "desarrollos: público ve los publicados; admin ve todo" on public.desarrollos;
create policy "desarrollos: solo admin ve la copia de trabajo"
  on public.desarrollos for select to authenticated using ((select public.es_admin()));

drop policy "unidades: público ve las de desarrollos publicados; admin ve todo" on public.unidades;
create policy "unidades: solo admin ve la copia de trabajo"
  on public.unidades for select to authenticated using ((select public.es_admin()));

drop policy "medios: público ve los activos de desarrollos publicados; admin ve todo" on public.medios;
create policy "medios: solo admin ve la copia de trabajo"
  on public.medios for select to authenticated using ((select public.es_admin()));

revoke select on public.desarrollos, public.unidades, public.medios from anon;

-- ---------------------------------------------------------------------
-- 4) Armado del JSON de un desarrollo (ahora sin unidades en la papelera)
-- ---------------------------------------------------------------------
create or replace function public._desarrollo_json(d public.desarrollos)
returns json language sql stable set search_path = ''
as $$
  select json_build_object(
    'id', d.id,
    'nombre', d.nombre,
    'direccion', d.direccion,
    'desarrollista', d.desarrollista,
    'posesion', d.posesion,
    'gastos', d.gastos,
    'portada', coalesce((select public._ruta_publica(m.bucket, m.ruta) from public.medios m
                         where m.desarrollo_id = d.id and m.tipo = 'portada' and m.eliminado_en is null
                         order by m.orden limit 1), ''),
    'galeria', public._medios_json(d.id, 'render'),
    'planos', public._medios_json(d.id, 'plano'),
    'brochurePags', public._medios_json(d.id, 'pagina_brochure'),
    'links', d.links,
    'disponibles', coalesce((select json_agg(public._unidad_json(u.campos, u.orden_campos) order by u.posicion)
                             from public.unidades u where u.desarrollo_id = d.id and u.eliminado_en is null), '[]'::json),
    'disponiblesEjemplo', d.disponibles_ejemplo,
    'columnas', d.columnas,
    'notaTabla', d.nota_tabla,
    'imagenes', public._medios_json(d.id, 'foto'));
$$;

-- ---------------------------------------------------------------------
-- 5) Lo que ve la web pública: SOLO versiones vigentes de desarrollos publicados y visibles.
--    SECURITY DEFINER porque el visitante ya no puede leer la copia de trabajo.
-- ---------------------------------------------------------------------
create or replace function public.contenido_publico()
returns json language sql stable security definer set search_path = ''
as $$
  with pub as (
    select p.contenido, d.posicion, d.id
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
    where m.desarrollo_id is null and m.eliminado_en is null)
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
      left join lateral (select mm.* from public.medios mm
                         where public._ruta_publica(mm.bucket, mm.ruta) = rutas.r
                         order by mm.creado_en desc limit 1) m on true), '[]'::json));
$$;

-- ---------------------------------------------------------------------
-- 6) Publicar: congela la copia de trabajo como nueva versión vigente.
-- ---------------------------------------------------------------------
create or replace function public.publicar_desarrollo(p_id text, p_nota text default '', p_actualizar_fecha boolean default true)
returns integer language plpgsql security definer set search_path = ''
as $$
declare
  v_d   public.desarrollos;
  v_ver integer;
begin
  if not public.es_admin() then raise exception 'Sin permiso' using errcode = '42501'; end if;
  select * into v_d from public.desarrollos where id = p_id and eliminado_en is null for update;
  if not found then raise exception 'El desarrollo no existe o está en la papelera'; end if;
  if length(btrim(v_d.nombre)) = 0 then raise exception 'Falta el nombre del desarrollo'; end if;
  select coalesce(max(version), 0) + 1 into v_ver from public.publicaciones where desarrollo_id = p_id;
  update public.publicaciones set vigente = false where desarrollo_id = p_id and vigente;
  insert into public.publicaciones (desarrollo_id, version, contenido, vigente, publicado_por, nota)
  values (p_id, v_ver, public._desarrollo_json(v_d), true, auth.uid(), coalesce(p_nota, ''));
  if v_d.estado <> 'publicado' then
    update public.desarrollos set estado = 'publicado' where id = p_id;
  end if;
  if p_actualizar_fecha then
    update public.configuracion
      set valor = to_jsonb(to_char((now() at time zone 'America/Argentina/Cordoba')::date, 'YYYY-MM-DD'))
      where clave = 'actualizado';
  end if;
  return v_ver;
end;
$$;

-- ---------------------------------------------------------------------
-- 7) Recuperar una versión: vuelve a cargar en la COPIA DE TRABAJO el contenido de una
--    versión publicada (no publica nada; después se revisa y se publica).
--    No borra: lo actual va a la papelera y queda en el historial.
-- ---------------------------------------------------------------------
create or replace function public.restaurar_version(p_publicacion bigint)
returns void language plpgsql security definer set search_path = ''
as $$
declare
  v_p    public.publicaciones;
  v_c    json;
  v_id   text;
  v_u    json;
  v_i    integer := 0;
  v_t    record;
  v_m    public.medios;
begin
  if not public.es_admin() then raise exception 'Sin permiso' using errcode = '42501'; end if;
  select * into v_p from public.publicaciones where id = p_publicacion;
  if not found then raise exception 'Esa versión no existe'; end if;
  v_id := v_p.desarrollo_id;
  v_c := v_p.contenido;

  update public.desarrollos set
    nombre = v_c ->> 'nombre', direccion = v_c ->> 'direccion', desarrollista = v_c ->> 'desarrollista',
    posesion = v_c ->> 'posesion', gastos = v_c ->> 'gastos', nota_tabla = v_c ->> 'notaTabla',
    links = (v_c -> 'links')::jsonb, columnas = (v_c -> 'columnas')::jsonb,
    disponibles_ejemplo = (v_c ->> 'disponiblesEjemplo')::boolean
  where id = v_id;

  update public.unidades set eliminado_en = now() where desarrollo_id = v_id and eliminado_en is null;
  for v_u in select * from json_array_elements(v_c -> 'disponibles') loop
    v_i := v_i + 1;
    insert into public.unidades (desarrollo_id, posicion, campos, orden_campos)
    values (v_id, v_i, v_u::jsonb, array(select json_object_keys(v_u)));
  end loop;

  update public.medios set eliminado_en = now() where desarrollo_id = v_id and eliminado_en is null;
  -- portada (orden 0) + listas en su orden exacto (orden 1, 2, 3…)
  for v_t in
    select 'portada'::text as tipo, (v_c ->> 'portada') as r, 0::bigint as n
    union all select 'foto', e, n from json_array_elements_text(v_c -> 'imagenes') with ordinality a(e, n)
    union all select 'render', e, n from json_array_elements_text(v_c -> 'galeria') with ordinality a(e, n)
    union all select 'plano', e, n from json_array_elements_text(v_c -> 'planos') with ordinality a(e, n)
    union all select 'pagina_brochure', e, n from json_array_elements_text(v_c -> 'brochurePags') with ordinality a(e, n)
  loop
    continue when v_t.r is null or v_t.r = '';
    select * into v_m from public.medios
      where public._ruta_publica(bucket, ruta) = v_t.r
      order by (desarrollo_id = v_id) desc, creado_en desc limit 1;
    if not found then raise exception 'Falta el archivo % para recuperar la versión', v_t.r; end if;
    insert into public.medios (desarrollo_id, tipo, orden, bucket, ruta, nombre, ancho, alto, bytes, sha256, formato, mime, metadatos)
    values (v_id, v_t.tipo, v_t.n::integer, v_m.bucket, v_m.ruta, v_m.nombre, v_m.ancho, v_m.alto, v_m.bytes, v_m.sha256,
            v_m.formato, v_m.mime, v_m.metadatos);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------
-- 8) Reordenar unidades y archivos (en una sola operación, sin choques de posición)
-- ---------------------------------------------------------------------
create or replace function public.reordenar_unidades(p_id text, p_ids uuid[])
returns void language plpgsql security invoker set search_path = ''
as $$
begin
  if not public.es_admin() then raise exception 'Sin permiso' using errcode = '42501'; end if;
  if (select count(*) from public.unidades where desarrollo_id = p_id and eliminado_en is null) <> cardinality(p_ids)
     or (select count(*) from public.unidades where desarrollo_id = p_id and eliminado_en is null and id = any (p_ids)) <> cardinality(p_ids) then
    raise exception 'La lista no coincide con las unidades actuales (recargá la página)';
  end if;
  update public.unidades set posicion = posicion + 1000000 where desarrollo_id = p_id and eliminado_en is null;
  update public.unidades u set posicion = t.ord from unnest(p_ids) with ordinality as t(id, ord) where u.id = t.id;
end;
$$;

create or replace function public.reordenar_medios(p_id text, p_tipo text, p_ids uuid[])
returns void language plpgsql security invoker set search_path = ''
as $$
begin
  if not public.es_admin() then raise exception 'Sin permiso' using errcode = '42501'; end if;
  if (select count(*) from public.medios where desarrollo_id = p_id and tipo = p_tipo and eliminado_en is null) <> cardinality(p_ids)
     or (select count(*) from public.medios where desarrollo_id = p_id and tipo = p_tipo and eliminado_en is null and id = any (p_ids)) <> cardinality(p_ids) then
    raise exception 'La lista no coincide con los archivos actuales (recargá la página)';
  end if;
  update public.medios set orden = orden + 1000000 where desarrollo_id = p_id and tipo = p_tipo and eliminado_en is null;
  update public.medios m set orden = t.ord from unnest(p_ids) with ordinality as t(id, ord) where m.id = t.id;
end;
$$;

-- ---------------------------------------------------------------------
-- 9) Historial legible (con el correo de quien hizo el cambio; solo admin)
-- ---------------------------------------------------------------------
create or replace function public._historial_json(h public.historial)
returns json language sql stable security definer set search_path = ''
as $$
  select json_build_object(
    'id', h.id, 'fecha', h.fecha, 'tabla', h.tabla, 'registro', h.registro_id, 'accion', h.accion,
    'rol', h.rol, 'usuario', h.usuario,
    'usuario_email', (select u.email from auth.users u where u.id = h.usuario),
    'desarrollo_id', coalesce(case when h.tabla = 'desarrollos' then h.registro_id end,
                              h.despues ->> 'desarrollo_id', h.antes ->> 'desarrollo_id'),
    'antes', h.antes, 'despues', h.despues);
$$;

create or replace function public.historial_reciente(p_desarrollo text default null, p_limite integer default 50)
returns json language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.es_admin() then raise exception 'Sin permiso' using errcode = '42501'; end if;
  return coalesce((
    select json_agg(public._historial_json(h) order by h.fecha desc, h.id desc)
    from (
      select * from public.historial x
      where p_desarrollo is null
         or (x.tabla = 'desarrollos' and x.registro_id = p_desarrollo)
         or x.despues ->> 'desarrollo_id' = p_desarrollo
         or x.antes ->> 'desarrollo_id' = p_desarrollo
      order by x.fecha desc, x.id desc
      limit least(greatest(p_limite, 1), 500)) h), '[]'::json);
end;
$$;

-- ---------------------------------------------------------------------
-- 10) Resumen para la lista de desarrollos del panel
-- ---------------------------------------------------------------------
create or replace function public.resumen_desarrollos()
returns json language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.es_admin() then raise exception 'Sin permiso' using errcode = '42501'; end if;
  return coalesce((
    select json_agg(json_build_object(
      'id', d.id, 'nombre', d.nombre, 'direccion', d.direccion, 'posicion', d.posicion,
      'estado', d.estado, 'visible', d.visible, 'eliminado_en', d.eliminado_en, 'modificado_en', d.modificado_en,
      'unidades', (select count(*) from public.unidades u where u.desarrollo_id = d.id and u.eliminado_en is null),
      'medios', (select count(*) from public.medios m where m.desarrollo_id = d.id and m.eliminado_en is null),
      'tiene_portada', exists (select 1 from public.medios m where m.desarrollo_id = d.id and m.tipo = 'portada' and m.eliminado_en is null),
      'version_vigente', p.version, 'publicado_en', p.publicado_en,
      'cambios_sin_publicar', case when p.id is null then d.estado = 'borrador'
                                   else p.contenido::jsonb is distinct from public._desarrollo_json(d)::jsonb end
    ) order by d.posicion, d.id)
    from public.desarrollos d
    left join public.publicaciones p on p.desarrollo_id = d.id and p.vigente), '[]'::json);
end;
$$;

create or replace function public.versiones_desarrollo(p_id text)
returns json language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.es_admin() then raise exception 'Sin permiso' using errcode = '42501'; end if;
  return coalesce((
    select json_agg(json_build_object('id', p.id, 'version', p.version, 'vigente', p.vigente,
      'publicado_en', p.publicado_en, 'nota', p.nota,
      'publicado_por_email', (select u.email from auth.users u where u.id = p.publicado_por),
      'unidades', json_array_length(p.contenido -> 'disponibles'),
      'archivos', json_array_length(p.contenido -> 'imagenes') + json_array_length(p.contenido -> 'galeria')
                  + json_array_length(p.contenido -> 'planos') + json_array_length(p.contenido -> 'brochurePags'))
      order by p.version desc)
    from public.publicaciones p where p.desarrollo_id = p_id), '[]'::json);
end;
$$;

-- ---------------------------------------------------------------------
-- 11) Estadísticas (ahora sin unidades en papelera, con cambios sin publicar y correo del usuario)
-- ---------------------------------------------------------------------
create or replace function public.estadisticas_panel()
returns json language plpgsql stable security definer set search_path = ''
as $$
declare r json;
begin
  if not public.es_admin() then raise exception 'Sin permiso' using errcode = '42501'; end if;
  with d as (select * from public.desarrollos where eliminado_en is null),
  u as (select un.* from public.unidades un join d on d.id = un.desarrollo_id where un.eliminado_en is null),
  m as (select me.* from public.medios me where me.eliminado_en is null
          and (me.desarrollo_id is null or me.desarrollo_id in (select id from d))),
  faltantes as (
    select d.id, d.nombre, array_remove(array[
      case when not exists (select 1 from m where m.desarrollo_id = d.id and m.tipo = 'portada') then 'portada' end,
      case when not exists (select 1 from u where u.desarrollo_id = d.id) then 'disponibles' end,
      case when not exists (select 1 from m where m.desarrollo_id = d.id and m.tipo = 'pagina_brochure') then 'brochure' end,
      case when not exists (select 1 from m where m.desarrollo_id = d.id and m.tipo = 'foto') then 'fotos' end,
      case when not exists (select 1 from m where m.desarrollo_id = d.id and m.tipo = 'render') then 'renders' end,
      case when not exists (select 1 from m where m.desarrollo_id = d.id and m.tipo = 'plano') then 'planos' end,
      case when d.posesion = '' then 'posesion' end,
      case when d.direccion = '' then 'direccion' end], null) as falta
    from d),
  pend as (
    select d.id from d join public.publicaciones p on p.desarrollo_id = d.id and p.vigente
    where p.contenido::jsonb is distinct from public._desarrollo_json(d)::jsonb)
  select json_build_object(
    'desarrollos', (select count(*) from d),
    'publicados', (select count(*) from d where estado = 'publicado'),
    'borradores', (select count(*) from d where estado = 'borrador'),
    'ocultos', (select count(*) from d where not visible),
    'en_papelera', (select count(*) from public.desarrollos where eliminado_en is not null),
    'con_cambios_sin_publicar', (select count(*) from pend),
    'con_material_incompleto', (select count(*) from faltantes where cardinality(falta) > 0),
    'detalle_incompletos', coalesce((select json_agg(json_build_object('id', id, 'nombre', nombre, 'falta', falta) order by nombre)
                                     from faltantes where cardinality(falta) > 0), '[]'::json),
    'unidades', (select count(*) from u),
    'unidades_por_estado', coalesce((select json_object_agg(coalesce(estado, '(sin estado)'), n)
                                     from (select estado, count(*) n from u group by estado) s), '{}'::json),
    'unidades_disponibles', (select count(*) from u where estado ~* '^\s*(disponible|libre)'),
    'unidades_reservadas', (select count(*) from u where estado ~* '^\s*reservad'),
    'unidades_vendidas', (select count(*) from u where estado ~* '^\s*vendid'),
    'existe_estado_vendida', exists (select 1 from u where estado ~* '^\s*vendid'),
    'fotos', (select count(*) from m where tipo = 'foto'),
    'renders', (select count(*) from m where tipo = 'render'),
    'planos', (select count(*) from m where tipo = 'plano'),
    'paginas_brochure', (select count(*) from m where tipo = 'pagina_brochure'),
    'portadas', (select count(*) from m where tipo = 'portada'),
    'ultimas_modificaciones', coalesce((
      select json_agg(json_build_object('fecha', h.fecha, 'tabla', h.tabla, 'registro', h.registro_id,
                                        'accion', h.accion, 'usuario', h.usuario, 'rol', h.rol,
                                        'usuario_email', (select au.email from auth.users au where au.id = h.usuario),
                                        'desarrollo_id', coalesce(case when h.tabla = 'desarrollos' then h.registro_id end,
                                                                  h.despues ->> 'desarrollo_id', h.antes ->> 'desarrollo_id'))
                      order by h.fecha desc, h.id desc)
      from (select * from public.historial order by fecha desc, id desc limit 20) h), '[]'::json)
  ) into r;
  return r;
end;
$$;

-- ---------------------------------------------------------------------
-- 12) Exportación con versiones; importación que crea la versión 1 de lo publicado
-- ---------------------------------------------------------------------
create or replace function public.exportar_todo()
returns json language plpgsql stable security invoker set search_path = ''
as $$
begin
  if not (public.es_admin() or auth.role() = 'service_role') then
    raise exception 'Sin permiso' using errcode = '42501';
  end if;
  return json_build_object(
    'exportado_en', now(),
    'desarrollos', (select coalesce(json_agg(d order by d.posicion, d.id), '[]') from public.desarrollos d),
    'unidades', (select coalesce(json_agg(json_build_object(
        'desarrollo_id', u.desarrollo_id, 'posicion', u.posicion, 'eliminado_en', u.eliminado_en,
        'campos', public._unidad_json(u.campos, u.orden_campos)) order by u.desarrollo_id, u.posicion), '[]')
      from public.unidades u),
    'medios', (select coalesce(json_agg(m order by m.desarrollo_id nulls first, m.tipo, m.orden), '[]') from public.medios m),
    'configuracion', (select coalesce(json_agg(c order by c.clave), '[]') from public.configuracion c),
    'publicaciones', (select coalesce(json_agg(p order by p.desarrollo_id, p.version), '[]') from public.publicaciones p),
    'contenido', public._contenido(false));
end;
$$;

create or replace function public.importar_desarrollo(
  p_desarrollo json, p_posicion integer, p_estado text, p_medios json)
returns text language plpgsql security definer set search_path = ''
as $$
declare
  v_id text := p_desarrollo ->> 'id';
  v_u json;
  v_i integer := 0;
  v_m json;
  v_d public.desarrollos;
begin
  if exists (select 1 from public.desarrollos where id = v_id) then
    return 'ya_existia';
  end if;
  insert into public.desarrollos (id, posicion, nombre, direccion, desarrollista, posesion, gastos,
                                  nota_tabla, links, columnas, disponibles_ejemplo, estado, visible)
  values (v_id, p_posicion, p_desarrollo ->> 'nombre', p_desarrollo ->> 'direccion',
          p_desarrollo ->> 'desarrollista', p_desarrollo ->> 'posesion', p_desarrollo ->> 'gastos',
          p_desarrollo ->> 'notaTabla', (p_desarrollo -> 'links')::jsonb, (p_desarrollo -> 'columnas')::jsonb,
          (p_desarrollo ->> 'disponiblesEjemplo')::boolean, p_estado, true);
  for v_u in select * from json_array_elements(p_desarrollo -> 'disponibles') loop
    v_i := v_i + 1;
    insert into public.unidades (desarrollo_id, posicion, campos, orden_campos)
    values (v_id, v_i, v_u::jsonb, array(select json_object_keys(v_u)));
  end loop;
  for v_m in select * from json_array_elements(p_medios) loop
    insert into public.medios (desarrollo_id, tipo, orden, bucket, ruta, nombre, ancho, alto, bytes, sha256, formato, mime)
    values (v_id, v_m ->> 'tipo', (v_m ->> 'orden')::integer, 'media', v_m ->> 'ruta', v_m ->> 'nombre',
            (v_m ->> 'ancho')::integer, (v_m ->> 'alto')::integer, (v_m ->> 'bytes')::bigint,
            v_m ->> 'sha256', v_m ->> 'formato', v_m ->> 'mime');
  end loop;
  if p_estado = 'publicado' then
    select * into v_d from public.desarrollos where id = v_id;
    insert into public.publicaciones (desarrollo_id, version, contenido, vigente, nota)
    values (v_id, 1, public._desarrollo_json(v_d), true, 'Versión inicial importada');
  end if;
  return 'importado';
end;
$$;

-- ---------------------------------------------------------------------
-- 13) Versión 1 de los desarrollos ya publicados (contenido actual, sin cambios)
-- ---------------------------------------------------------------------
insert into public.publicaciones (desarrollo_id, version, contenido, vigente, nota)
select d.id, 1, public._desarrollo_json(d), true, 'Versión inicial importada (fase 4)'
from public.desarrollos d
where d.estado = 'publicado' and d.eliminado_en is null
  and not exists (select 1 from public.publicaciones p where p.desarrollo_id = d.id);

-- ---------------------------------------------------------------------
-- 14) Permisos de ejecución
-- ---------------------------------------------------------------------
revoke all on function public.contenido_publico(), public.publicar_desarrollo(text, text, boolean),
  public.restaurar_version(bigint), public.reordenar_unidades(text, uuid[]), public.reordenar_medios(text, text, uuid[]),
  public._historial_json(public.historial), public.historial_reciente(text, integer), public.resumen_desarrollos(),
  public.versiones_desarrollo(text), public.estadisticas_panel(), public.exportar_todo(),
  public.importar_desarrollo(json, integer, text, json)
  from public, anon, authenticated;

grant execute on function public.contenido_publico() to anon, authenticated, service_role;
grant execute on function public.publicar_desarrollo(text, text, boolean), public.restaurar_version(bigint),
  public.reordenar_unidades(text, uuid[]), public.reordenar_medios(text, text, uuid[]),
  public.historial_reciente(text, integer), public.resumen_desarrollos(), public.versiones_desarrollo(text),
  public.estadisticas_panel(), public.exportar_todo() to authenticated;
grant execute on function public.importar_desarrollo(json, integer, text, json), public.exportar_todo() to service_role;
