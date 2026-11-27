-- =====================================================================
-- Ubicación de cada desarrollo para el mapa (27/11/2026, pedido de Nahir).
--
-- SOLO AGREGA: dos columnas vacías (lat, lng) en "desarrollos". No borra ni modifica datos.
-- Funciona como «Pendiente de actualización»: efecto inmediato en la página, sin publicar, y no
-- forma parte de las versiones publicadas (no genera «cambios sin publicar»).
--
-- La página la recibe como "ubicacion": {"lat": …, "lng": …} dentro del desarrollo, SOLO cuando
-- está cargada. Sin ubicaciones cargadas, contenido_publico() devuelve exactamente lo mismo que antes.
-- =====================================================================

alter table public.desarrollos add column if not exists lat numeric(9, 6);
alter table public.desarrollos add column if not exists lng numeric(9, 6);

do $$ begin
  alter table public.desarrollos add constraint desarrollos_ubicacion_valida
    check ((lat is null and lng is null)
           or (lat is not null and lng is not null and lat between -90 and 90 and lng between -180 and 180));
exception when duplicate_object then null; end $$;

comment on column public.desarrollos.lat is 'Latitud para el mapa de la página (efecto inmediato, sin publicar).';
comment on column public.desarrollos.lng is 'Longitud para el mapa de la página (efecto inmediato, sin publicar).';

-- ---------------------------------------------------------------------
-- contenido_publico(): igual a la de 20261126130000, salvo que a los desarrollos con ubicación
-- se les agrega "ubicacion" al final (por texto, para conservar el orden de las claves).
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
    select case when not d.desactualizado and (d.lat is null or d.lng is null) then p.contenido
                else (left(p.contenido::text, -1)
                      || case when d.desactualizado then ', "desactualizado" : true' else '' end
                      || case when d.lat is not null and d.lng is not null
                              then format(', "ubicacion" : {"lat" : %s, "lng" : %s}', d.lat, d.lng) else '' end
                      || '}')::json end as contenido,
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

revoke all on function public.contenido_publico() from public;
grant execute on function public.contenido_publico() to anon, authenticated, service_role;
