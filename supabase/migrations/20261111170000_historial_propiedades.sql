-- =====================================================================
-- Etapa 5 · El historial del dashboard reconoce Terceros y Comercios.
-- Solo reemplaza 3 funciones de LECTURA (clasifican los eventos al leerlos).
-- No cambia tablas, datos, políticas ni el registro del historial.
--   * _origen_evento: las propiedades de prueba (prueba-*, intruso-*, verificacion-*) cuentan
--     como «prueba automatizada», igual que los desarrollos de prueba.
--   * _tipo_evento: publicar una propiedad = «Publicación»; despublicarla = «Visibilidad».
--   * _evento_json: agrega propiedad_id, propiedad_titulo y propiedad_categoria.
-- =====================================================================

create or replace function public._propiedad_de_evento(h public.historial)
returns text language sql immutable set search_path = ''
as $$
  select case when h.tabla = 'propiedades' then h.registro_id
              when h.tabla in ('propiedad_medios', 'propiedad_publicaciones')
                then coalesce(h.despues ->> 'propiedad_id', h.antes ->> 'propiedad_id') end;
$$;
revoke all on function public._propiedad_de_evento(public.historial) from public, anon, authenticated;

create or replace function public._origen_evento(h public.historial)
returns text language sql stable security definer set search_path = ''
as $$
  select case
    when coalesce(case when h.tabla = 'desarrollos' then h.registro_id end,
                  h.despues ->> 'desarrollo_id', h.antes ->> 'desarrollo_id', '') ~ '^(prueba|intruso|verificacion)-'
      or coalesce(public._propiedad_de_evento(h), '') ~ '^(prueba|intruso|verificacion)-'
      or (h.tabla = 'roles_usuario' and coalesce(h.despues ->> 'nota', h.antes ->> 'nota', '') ilike '%temporal%')
      or (h.usuario is not null and not exists (select 1 from auth.users u where u.id = h.usuario))
      or (h.tabla = 'configuracion' and h.accion = 'editar' and h.rol = 'service_role')
      then 'prueba'
    when h.usuario is null or h.rol = 'service_role' then 'sistema'
    else 'administracion'
  end;
$$;

create or replace function public._tipo_evento(h public.historial)
returns text language sql immutable set search_path = ''
as $$
  select case
    when h.tabla in ('publicaciones', 'propiedad_publicaciones') and h.accion = 'crear' then 'publicacion'
    when h.accion = 'eliminar' then 'papelera'
    when h.accion = 'restaurar' then 'recuperacion'
    when h.accion = 'borrar_definitivo' then 'borrado'
    when h.accion = 'crear' then 'alta'
    when h.tabla in ('desarrollos', 'propiedades') and (h.antes ->> 'visible') is distinct from (h.despues ->> 'visible') then 'visibilidad'
    when (h.despues ? 'posicion' and (h.despues ->> 'posicion')::numeric >= 1000000)
      or (h.despues ? 'orden' and (h.despues ->> 'orden')::numeric >= 1000000) then 'transitorio'
    when (h.antes ->> 'posicion') is distinct from (h.despues ->> 'posicion')
      or (h.antes ->> 'orden') is distinct from (h.despues ->> 'orden') then 'orden'
    else 'edicion'
  end;
$$;

create or replace function public._evento_json(h public.historial)
returns json language sql stable security definer set search_path = ''
as $$
  select json_build_object(
    'id', h.id, 'fecha', h.fecha, 'tabla', h.tabla, 'accion', h.accion,
    'tipo', public._tipo_evento(h), 'origen', public._origen_evento(h),
    'desarrollo_id', coalesce(case when h.tabla = 'desarrollos' then h.registro_id end,
                              h.despues ->> 'desarrollo_id', h.antes ->> 'desarrollo_id'),
    'desarrollo_nombre', (select d.nombre from public.desarrollos d
                          where d.id = coalesce(case when h.tabla = 'desarrollos' then h.registro_id end,
                                                h.despues ->> 'desarrollo_id', h.antes ->> 'desarrollo_id')),
    'propiedad_id', public._propiedad_de_evento(h),
    'propiedad_titulo', (select p.titulo from public.propiedades p where p.id = public._propiedad_de_evento(h)),
    'propiedad_categoria', (select p.categoria from public.propiedades p where p.id = public._propiedad_de_evento(h)),
    -- El correo solo se muestra para cambios de administración (no el de cuentas temporales).
    'usuario_email', case when public._origen_evento(h) = 'administracion'
                          then (select u.email from auth.users u where u.id = h.usuario) end);
$$;
