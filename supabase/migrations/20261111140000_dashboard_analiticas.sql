-- =====================================================================
-- Rediseño del dashboard · Funciones de LECTURA para el panel (solo administradora).
-- No cambia tablas, datos ni políticas RLS. El historial no se modifica: los eventos se
-- clasifican al leerlos (administración / sistema / prueba automatizada).
-- =====================================================================

-- ---------------------------------------------------------------------
-- Completitud de cada desarrollo. Criterios aprobados por Nahir (11/11/2026):
-- 7 puntos ESENCIALES con el mismo peso (cada uno 1/7):
--   portada · dirección · fecha de posesión · lista de disponibles (≥1 unidad) ·
--   brochure (≥1 página) · planos (≥1) · material visual (fotos O renders, ≥1)
-- OPCIONALES (se muestran, no cuentan): desarrollista · gastos · nota de la tabla ·
--   fotos y renders (ambos) · planilla en vivo.
-- Atención: alta = publicado e incompleto · media = borrador incompleto · ninguna = 100 %.
-- ---------------------------------------------------------------------
create or replace function public.completitud_desarrollos()
returns json language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.es_admin() then raise exception 'Sin permiso' using errcode = '42501'; end if;
  return coalesce((
    with base as (
      select d.*,
        (select count(*) from public.medios m where m.desarrollo_id = d.id and m.eliminado_en is null and m.tipo = 'portada') as n_portada,
        (select count(*) from public.medios m where m.desarrollo_id = d.id and m.eliminado_en is null and m.tipo = 'foto') as n_fotos,
        (select count(*) from public.medios m where m.desarrollo_id = d.id and m.eliminado_en is null and m.tipo = 'render') as n_renders,
        (select count(*) from public.medios m where m.desarrollo_id = d.id and m.eliminado_en is null and m.tipo = 'plano') as n_planos,
        (select count(*) from public.medios m where m.desarrollo_id = d.id and m.eliminado_en is null and m.tipo = 'pagina_brochure') as n_paginas,
        (select count(*) from public.unidades u where u.desarrollo_id = d.id and u.eliminado_en is null) as n_unidades,
        (select p.contenido::jsonb is distinct from public._desarrollo_json(d)::jsonb
           from public.publicaciones p where p.desarrollo_id = d.id and p.vigente) as cambios
      from public.desarrollos d
      where d.eliminado_en is null),
    chequeo as (
      select b.*,
        json_build_array(
          json_build_object('clave', 'portada', 'etiqueta', 'Portada', 'ok', b.n_portada > 0, 'cantidad', b.n_portada, 'pestana', 'multimedia'),
          json_build_object('clave', 'direccion', 'etiqueta', 'Dirección', 'ok', btrim(b.direccion) <> '', 'cantidad', null, 'pestana', 'datos'),
          json_build_object('clave', 'posesion', 'etiqueta', 'Fecha de posesión', 'ok', btrim(b.posesion) <> '', 'cantidad', null, 'pestana', 'datos'),
          json_build_object('clave', 'disponibles', 'etiqueta', 'Lista de disponibles', 'ok', b.n_unidades > 0, 'cantidad', b.n_unidades, 'pestana', 'unidades'),
          json_build_object('clave', 'brochure', 'etiqueta', 'Brochure', 'ok', b.n_paginas > 0, 'cantidad', b.n_paginas, 'pestana', 'multimedia'),
          json_build_object('clave', 'planos', 'etiqueta', 'Planos', 'ok', b.n_planos > 0, 'cantidad', b.n_planos, 'pestana', 'multimedia'),
          json_build_object('clave', 'visual', 'etiqueta', 'Fotos o renders', 'ok', (b.n_fotos + b.n_renders) > 0, 'cantidad', b.n_fotos + b.n_renders, 'pestana', 'multimedia')
        ) as esenciales,
        json_build_array(
          json_build_object('clave', 'desarrollista', 'etiqueta', 'Desarrollista', 'ok', btrim(b.desarrollista) <> '', 'pestana', 'datos'),
          json_build_object('clave', 'gastos', 'etiqueta', 'Gastos de posesión', 'ok', btrim(b.gastos) <> '', 'pestana', 'datos'),
          json_build_object('clave', 'nota', 'etiqueta', 'Nota de la tabla', 'ok', btrim(b.nota_tabla) <> '', 'pestana', 'datos'),
          json_build_object('clave', 'fotos_y_renders', 'etiqueta', 'Fotos y renders (ambos)', 'ok', b.n_fotos > 0 and b.n_renders > 0, 'pestana', 'multimedia'),
          json_build_object('clave', 'planilla', 'etiqueta', 'Planilla en vivo', 'ok', coalesce(btrim(b.links ->> 'disponibles'), '') <> '', 'pestana', 'datos')
        ) as opcionales,
        ((b.n_portada > 0)::int + (btrim(b.direccion) <> '')::int + (btrim(b.posesion) <> '')::int + (b.n_unidades > 0)::int
          + (b.n_paginas > 0)::int + (b.n_planos > 0)::int + ((b.n_fotos + b.n_renders) > 0)::int) as cumplidos
      from base b)
    select json_agg(json_build_object(
      'id', c.id, 'nombre', c.nombre, 'estado', c.estado, 'visible', c.visible, 'modificado_en', c.modificado_en,
      'cambios_sin_publicar', coalesce(c.cambios, c.estado = 'borrador'),
      'cumplidos', c.cumplidos, 'total', 7, 'porcentaje', round(100.0 * c.cumplidos / 7),
      'atencion', case when c.cumplidos = 7 then 'ninguna' when c.estado = 'publicado' then 'alta' else 'media' end,
      'esenciales', c.esenciales, 'opcionales', c.opcionales,
      'conteos', json_build_object('unidades', c.n_unidades, 'fotos', c.n_fotos, 'renders', c.n_renders,
                                   'planos', c.n_planos, 'paginas_brochure', c.n_paginas, 'portada', c.n_portada))
      order by c.posicion, c.id)
    from chequeo c), '[]'::json);
end;
$$;

-- ---------------------------------------------------------------------
-- Clasificación de eventos del historial (al leer; el historial no se toca)
--   prueba         → desarrollo de prueba (prueba-*, intruso-*, verificacion-*), cuenta temporal
--                    que ya no existe, o rol temporal de pruebas
--   sistema        → importaciones y scripts (clave del servidor) o procesos sin usuario
--   administracion → cambios hechos por una cuenta administradora existente
-- ---------------------------------------------------------------------
create or replace function public._origen_evento(h public.historial)
returns text language sql stable security definer set search_path = ''
as $$
  select case
    when coalesce(case when h.tabla = 'desarrollos' then h.registro_id end,
                  h.despues ->> 'desarrollo_id', h.antes ->> 'desarrollo_id', '') ~ '^(prueba|intruso|verificacion)-'
      or (h.tabla = 'roles_usuario' and coalesce(h.despues ->> 'nota', h.antes ->> 'nota', '') ilike '%temporal%')
      or (h.usuario is not null and not exists (select 1 from auth.users u where u.id = h.usuario))
      then 'prueba'
    when h.usuario is null or h.rol = 'service_role' then 'sistema'
    else 'administracion'
  end;
$$;

-- Tipo de acción legible para el panel.
create or replace function public._tipo_evento(h public.historial)
returns text language sql immutable set search_path = ''
as $$
  select case
    when h.tabla = 'publicaciones' and h.accion = 'crear' then 'publicacion'
    when h.accion = 'eliminar' then 'papelera'
    when h.accion = 'restaurar' then 'recuperacion'
    when h.accion = 'borrar_definitivo' then 'borrado'
    when h.accion = 'crear' then 'alta'
    when h.tabla = 'desarrollos' and (h.antes ->> 'visible') is distinct from (h.despues ->> 'visible') then 'visibilidad'
    when (h.despues ? 'posicion' and (h.despues ->> 'posicion')::numeric >= 1000000)
      or (h.despues ? 'orden' and (h.despues ->> 'orden')::numeric >= 1000000) then 'transitorio'
    when (h.antes ->> 'posicion') is distinct from (h.despues ->> 'posicion')
      or (h.antes ->> 'orden') is distinct from (h.despues ->> 'orden') then 'orden'
    else 'edicion'
  end;
$$;

-- Fila liviana para listas (sin "antes"/"después": el detalle se pide aparte).
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
    -- El correo solo se muestra para cambios de administración (no el de cuentas temporales).
    'usuario_email', case when public._origen_evento(h) = 'administracion'
                          then (select u.email from auth.users u where u.id = h.usuario) end);
$$;

-- ---------------------------------------------------------------------
-- Resumen de actividad para el dashboard: conteos agregados + los últimos eventos.
-- No descarga el historial completo.
-- ---------------------------------------------------------------------
create or replace function public.actividad_resumen(p_incluir_pruebas boolean default false, p_limite integer default 80)
returns json language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.es_admin() then raise exception 'Sin permiso' using errcode = '42501'; end if;
  return (
    with h as (
      select x.*, public._origen_evento(x) as origen, public._tipo_evento(x) as tipo
      from public.historial x),
    f as (select * from h where tipo <> 'transitorio' and (p_incluir_pruebas or origen <> 'prueba'))
    select json_build_object(
      'total', (select count(*) from h),
      'por_origen', coalesce((select json_object_agg(origen, n) from (select origen, count(*) n from h group by origen) s), '{}'::json),
      'por_tipo', coalesce((select json_object_agg(tipo, n) from (select tipo, count(*) n from f group by tipo) s), '{}'::json),
      'dias_con_actividad', (select count(distinct (fecha at time zone 'America/Argentina/Cordoba')::date) from f),
      'por_dia', coalesce((select json_agg(json_build_object('dia', dia, 'n', n) order by dia) from (
          select (fecha at time zone 'America/Argentina/Cordoba')::date as dia, count(*) n
          from f where fecha > now() - interval '60 days' group by 1) s), '[]'::json),
      'recientes', coalesce((select json_agg(public._evento_json(x) order by x.fecha desc, x.id desc) from (
          select * from f order by fecha desc, id desc limit least(greatest(p_limite, 1), 200)) y
          join public.historial x on x.id = y.id), '[]'::json)));
end;
$$;

-- ---------------------------------------------------------------------
-- Historial completo, paginado ("cargar más"), con filtros. Sin "antes"/"después".
-- ---------------------------------------------------------------------
create or replace function public.historial_paginado(
  p_origen text default null, p_tipo text default null, p_desarrollo text default null,
  p_antes_de bigint default null, p_limite integer default 50)
returns json language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.es_admin() then raise exception 'Sin permiso' using errcode = '42501'; end if;
  return coalesce((
    select json_agg(public._evento_json(x) order by x.id desc)
    from (
      select h.* from public.historial h
      where (p_antes_de is null or h.id < p_antes_de)
        and public._tipo_evento(h) <> 'transitorio'
        and (p_origen is null or public._origen_evento(h) = p_origen)
        and (p_tipo is null or public._tipo_evento(h) = p_tipo)
        and (p_desarrollo is null
             or coalesce(case when h.tabla = 'desarrollos' then h.registro_id end,
                         h.despues ->> 'desarrollo_id', h.antes ->> 'desarrollo_id') = p_desarrollo)
      order by h.id desc
      limit least(greatest(p_limite, 1), 200)) x), '[]'::json);
end;
$$;

-- Detalle de UN evento (antes / después), solo cuando se despliega.
create or replace function public.evento_detalle(p_id bigint)
returns json language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.es_admin() then raise exception 'Sin permiso' using errcode = '42501'; end if;
  return (select json_build_object('id', h.id, 'antes', h.antes, 'despues', h.despues) from public.historial h where h.id = p_id);
end;
$$;

-- ---------------------------------------------------------------------
-- Permisos
-- ---------------------------------------------------------------------
revoke all on function public.completitud_desarrollos(), public._origen_evento(public.historial),
  public._tipo_evento(public.historial), public._evento_json(public.historial),
  public.actividad_resumen(boolean, integer),
  public.historial_paginado(text, text, text, bigint, integer), public.evento_detalle(bigint)
  from public, anon, authenticated;
grant execute on function public.completitud_desarrollos(), public.actividad_resumen(boolean, integer),
  public.historial_paginado(text, text, text, bigint, integer), public.evento_detalle(bigint) to authenticated;
