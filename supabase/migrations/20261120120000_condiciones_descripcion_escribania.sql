-- =====================================================================
-- Etapa 2 (20/11/2026) · Condiciones de publicación, descripción y escribanía de cada desarrollo
--
-- SOLO AGREGA: tres columnas opcionales (texto, vacías por defecto) en la tabla existente
-- "desarrollos". No borra ni modifica datos. RLS y permisos no cambian: la copia de trabajo
-- sigue siendo solo de la administradora y el público lee las versiones publicadas.
--
-- Para que los 17 desarrollos NO aparezcan con «cambios sin publicar», el JSON publicado
-- incluye los campos nuevos SOLO cuando tienen contenido. Un desarrollo sin estos datos
-- produce exactamente el mismo JSON que antes.
-- =====================================================================

alter table public.desarrollos
  add column if not exists condiciones text not null default ''
    check (length(condiciones) <= 20000),
  add column if not exists descripcion text not null default ''
    check (length(descripcion) <= 20000),
  add column if not exists escribania  text not null default ''
    check (length(escribania) <= 300);

comment on column public.desarrollos.condiciones is 'Condiciones de publicación para colegas (texto libre, respeta saltos de línea). Opcional.';
comment on column public.desarrollos.descripcion is 'Descripción general del desarrollo (varios párrafos). Opcional.';
comment on column public.desarrollos.escribania  is 'Escribano / escribanía con la que trabaja el desarrollo. Opcional.';

-- ---------------------------------------------------------------------
-- JSON de un desarrollo: mismo armado que antes + los campos nuevos al final, solo si tienen texto.
-- (Se agregan por texto para conservar el orden original de las claves, que el tipo json respeta.)
-- ---------------------------------------------------------------------
create or replace function public._desarrollo_json(d public.desarrollos)
returns json language sql stable set search_path = ''
as $$
  with base as (
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
      'imagenes', public._medios_json(d.id, 'foto')) as j),
  extras as (
    select jsonb_strip_nulls(jsonb_build_object(
      'condiciones', nullif(btrim(d.condiciones), ''),
      'descripcion', nullif(btrim(d.descripcion), ''),
      'escribania',  nullif(btrim(d.escribania), ''))) as x)
  select case when extras.x = '{}'::jsonb then base.j
              else (left(base.j::text, -1) || ', ' || substr(extras.x::text, 2))::json end
  from base, extras;
$$;

-- ---------------------------------------------------------------------
-- Recuperar una versión: además de lo anterior, recupera los tres campos nuevos
-- (las versiones anteriores a esta migración no los tienen: quedan vacíos).
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
    disponibles_ejemplo = (v_c ->> 'disponiblesEjemplo')::boolean,
    condiciones = coalesce(v_c ->> 'condiciones', ''),
    descripcion = coalesce(v_c ->> 'descripcion', ''),
    escribania  = coalesce(v_c ->> 'escribania', '')
  where id = v_id;

  update public.unidades set eliminado_en = now() where desarrollo_id = v_id and eliminado_en is null;
  for v_u in select * from json_array_elements(v_c -> 'disponibles') loop
    v_i := v_i + 1;
    insert into public.unidades (desarrollo_id, posicion, campos, orden_campos)
    values (v_id, v_i, v_u::jsonb, array(select json_object_keys(v_u)));
  end loop;

  update public.medios set eliminado_en = now() where desarrollo_id = v_id and eliminado_en is null;
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

-- Permisos: iguales a los que ya tenían estas funciones (create or replace los conserva; se repiten por claridad).
revoke all on function public._desarrollo_json(public.desarrollos), public.restaurar_version(bigint) from public, anon;
grant execute on function public._desarrollo_json(public.desarrollos) to anon, authenticated, service_role;
grant execute on function public.restaurar_version(bigint) to authenticated;
