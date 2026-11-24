-- =====================================================================
-- contenido_publico() más rápida (24/11/2026). Solo reemplaza la función: no toca datos ni tablas.
--
-- Problema: para cada archivo publicado se buscaba su fila en `medios` recorriendo TODA la tabla y
-- calculando la ruta pública fila por fila (archivos × filas de medios). Con el historial de
-- archivos reemplazados o quitados, en producción tardaba más de un segundo, y con varias
-- visitas a la vez se pasaba del límite de tiempo («No pudimos cargar el material»).
--
-- Arreglo: la ruta pública de cada fila de `medios` se calcula UNA sola vez (la más nueva por ruta,
-- igual que antes: order by creado_en desc) y se cruza con las rutas publicadas de una pasada.
-- El resultado es idéntico al de antes (se comprobó comparando la huella del JSON).
-- =====================================================================

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
    where m.desarrollo_id is null and m.eliminado_en is null),
  -- Datos de cada archivo: la fila más nueva por ruta pública (misma regla que _ruta_publica).
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

-- Los permisos se conservan con «create or replace»; se repiten por claridad.
revoke all on function public.contenido_publico() from public;
grant execute on function public.contenido_publico() to anon, authenticated, service_role;
