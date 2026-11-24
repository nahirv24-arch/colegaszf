-- =====================================================================
-- Marca «Material en actualización» de cada desarrollo (24/11/2026).
--
-- SOLO AGREGA: una columna (falso por defecto) en "desarrollos". No borra ni modifica datos.
-- Funciona como «Ocultar / Mostrar»: tiene efecto inmediato en la página, sin publicar, y no
-- forma parte de las versiones publicadas (no genera «cambios sin publicar»).
--
-- La página pública la recibe como "desactualizado": true dentro del desarrollo, SOLO cuando
-- está marcada. Sin ninguna marca, contenido_publico() devuelve exactamente lo mismo que antes.
-- =====================================================================

alter table public.desarrollos
  add column if not exists desactualizado boolean not null default false;

comment on column public.desarrollos.desactualizado is
  'Material en actualización: la página avisa a los colegas que el material puede no estar al día. Efecto inmediato, sin publicar.';

-- ---------------------------------------------------------------------
-- contenido_publico(): igual a la de 20261124120000, salvo que a los desarrollos marcados se les
-- agrega "desactualizado": true al final (por texto, para conservar el orden de las claves).
-- ---------------------------------------------------------------------
create or replace function public.contenido_publico()
returns json language sql stable security definer set search_path = ''
as $$
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
      left join datos m on m.r = rutas.r), '[]'::json));
$$;

-- ---------------------------------------------------------------------
-- Lista del panel: suma "desactualizado" (igual que la de 20261111130000 en todo lo demás).
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
      'desactualizado', d.desactualizado,
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

-- Permisos: se conservan con «create or replace»; se repiten por claridad.
revoke all on function public.contenido_publico() from public;
grant execute on function public.contenido_publico() to anon, authenticated, service_role;
revoke all on function public.resumen_desarrollos() from public, anon;
grant execute on function public.resumen_desarrollos() to authenticated;
