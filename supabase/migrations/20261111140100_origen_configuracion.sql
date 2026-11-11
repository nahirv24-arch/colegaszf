-- =====================================================================
-- Ajuste de la clasificación del historial (solo lectura; el registro no se toca).
-- Las ediciones de configuración hechas con la clave del servidor solo las hacen los scripts
-- de prueba (restauran la fecha "actualizado" al terminar). La importación real CREA esa
-- configuración (acción "crear"), no la edita. Por eso se marcan como prueba automatizada.
-- =====================================================================
create or replace function public._origen_evento(h public.historial)
returns text language sql stable security definer set search_path = ''
as $$
  select case
    when coalesce(case when h.tabla = 'desarrollos' then h.registro_id end,
                  h.despues ->> 'desarrollo_id', h.antes ->> 'desarrollo_id', '') ~ '^(prueba|intruso|verificacion)-'
      or (h.tabla = 'roles_usuario' and coalesce(h.despues ->> 'nota', h.antes ->> 'nota', '') ilike '%temporal%')
      or (h.usuario is not null and not exists (select 1 from auth.users u where u.id = h.usuario))
      or (h.tabla = 'configuracion' and h.accion = 'editar' and h.rol = 'service_role')
      then 'prueba'
    when h.usuario is null or h.rol = 'service_role' then 'sistema'
    else 'administracion'
  end;
$$;
revoke all on function public._origen_evento(public.historial) from public, anon, authenticated;
