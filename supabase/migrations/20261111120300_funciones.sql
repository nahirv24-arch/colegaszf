-- =====================================================================
-- Fase 4 · 4/4 · Funciones: lectura pública, papelera, estadísticas, exportación e importación
-- =====================================================================

-- ---------------------------------------------------------------------
-- Arma los datos con la MISMA forma que datos/desarrollos.json (claves y orden originales).
-- SECURITY INVOKER: respeta RLS de quien la llama.
-- ---------------------------------------------------------------------
create or replace function public._ruta_publica(p_bucket text, p_ruta text)
returns text language sql immutable set search_path = ''
as $$ select case when p_bucket = 'media' then 'media/' || p_ruta else p_bucket || '/' || p_ruta end $$;

create or replace function public._unidad_json(p_campos jsonb, p_orden text[])
returns json language sql stable set search_path = ''
as $$
  select coalesce(json_object_agg(k, p_campos -> k order by ord), '{}'::json)
  from (
    select t.k, t.ord from unnest(p_orden) with ordinality as t(k, ord) where p_campos ? t.k
    union all
    select j.k, 1000000 from jsonb_object_keys(p_campos) as j(k) where not (j.k = any (p_orden))
  ) s;
$$;

create or replace function public._medios_json(p_desarrollo text, p_tipo text)
returns json language sql stable set search_path = ''
as $$
  select coalesce(json_agg(public._ruta_publica(m.bucket, m.ruta) order by m.orden), '[]'::json)
  from public.medios m
  where m.desarrollo_id = p_desarrollo and m.tipo = p_tipo and m.eliminado_en is null;
$$;

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
                             from public.unidades u where u.desarrollo_id = d.id), '[]'::json),
    'disponiblesEjemplo', d.disponibles_ejemplo,
    'columnas', d.columnas,
    'notaTabla', d.nota_tabla,
    'imagenes', public._medios_json(d.id, 'foto'));
$$;

create or replace function public._contenido(p_solo_publico boolean)
returns json language sql stable set search_path = ''
as $$
  select json_build_object(
    'sitio', json_build_object(
      'actualizado', coalesce((select c.valor #>> '{}' from public.configuracion c where c.clave = 'actualizado'), ''),
      'portada', coalesce((select public._ruta_publica(m.bucket, m.ruta) from public.medios m
                           where m.tipo = 'portada_general' and m.eliminado_en is null order by m.orden limit 1), ''),
      'emprendimientos', coalesce((
        select json_agg(public._desarrollo_json(d) order by d.posicion, d.id)
        from public.desarrollos d
        where d.eliminado_en is null
          and (not p_solo_publico or (d.estado = 'publicado' and d.visible))), '[]'::json)),
    'logo', coalesce((select public._ruta_publica(m.bucket, m.ruta) from public.medios m
                      where m.tipo = 'logo' and m.eliminado_en is null order by m.orden limit 1), ''),
    'medios', coalesce((
      select json_agg(json_build_object(
        'ruta', public._ruta_publica(m.bucket, m.ruta), 'sha256', m.sha256, 'bytes', m.bytes,
        'formato', m.formato, 'ancho', m.ancho, 'alto', m.alto) order by m.ruta)
      from public.medios m where m.eliminado_en is null), '[]'::json));
$$;

-- Lo que verá la web pública (fase futura): solo publicado + visible + no eliminado.
create or replace function public.contenido_publico()
returns json language sql stable security invoker set search_path = ''
as $$ select public._contenido(true) $$;

-- Para el panel: incluye borradores y ocultos (solo admin).
create or replace function public.contenido_completo()
returns json language plpgsql stable security invoker set search_path = ''
as $$
begin
  if not public.es_admin() then
    raise exception 'Solo el administrador puede ver el contenido completo' using errcode = '42501';
  end if;
  return public._contenido(false);
end;
$$;

-- ---------------------------------------------------------------------
-- Papelera: eliminar y restaurar sin borrar nada definitivamente.
-- ---------------------------------------------------------------------
create or replace function public.eliminar_desarrollo(p_id text)
returns void language plpgsql security invoker set search_path = ''
as $$
begin
  if not public.es_admin() then raise exception 'Sin permiso' using errcode = '42501'; end if;
  update public.desarrollos set eliminado_en = now() where id = p_id and eliminado_en is null;
  if not found then raise exception 'No existe o ya estaba en la papelera: %', p_id; end if;
end;
$$;

create or replace function public.restaurar_desarrollo(p_id text)
returns void language plpgsql security invoker set search_path = ''
as $$
begin
  if not public.es_admin() then raise exception 'Sin permiso' using errcode = '42501'; end if;
  update public.desarrollos set eliminado_en = null where id = p_id and eliminado_en is not null;
  if not found then raise exception 'No está en la papelera: %', p_id; end if;
end;
$$;

-- ---------------------------------------------------------------------
-- Estadísticas para el dashboard (fase 5). Todo se cuenta desde las tablas reales.
-- Estados comerciales: se informan TODOS los que existen ("por_estado") y además
-- los grupos disponibles / reservadas / vendidas según el texto del estado.
-- ---------------------------------------------------------------------
create or replace function public.estadisticas_panel()
returns json language plpgsql stable security invoker set search_path = ''
as $$
declare r json;
begin
  if not public.es_admin() then raise exception 'Sin permiso' using errcode = '42501'; end if;
  with d as (select * from public.desarrollos where eliminado_en is null),
  u as (select un.* from public.unidades un join d on d.id = un.desarrollo_id),
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
    from d)
  select json_build_object(
    'desarrollos', (select count(*) from d),
    'publicados', (select count(*) from d where estado = 'publicado'),
    'borradores', (select count(*) from d where estado = 'borrador'),
    'ocultos', (select count(*) from d where not visible),
    'en_papelera', (select count(*) from public.desarrollos where eliminado_en is not null),
    'con_material_incompleto', (select count(*) from faltantes where cardinality(falta) > 0),
    'detalle_incompletos', coalesce((select json_agg(json_build_object('id', id, 'nombre', nombre, 'falta', falta) order by id)
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
                                        'accion', h.accion, 'usuario', h.usuario, 'rol', h.rol) order by h.fecha desc)
      from (select * from public.historial order by fecha desc limit 20) h), '[]'::json)
  ) into r;
  return r;
end;
$$;

-- ---------------------------------------------------------------------
-- Exportación completa (respaldo): todas las tablas, incluida la papelera. Solo admin.
-- ---------------------------------------------------------------------
create or replace function public.exportar_todo()
returns json language plpgsql stable security invoker set search_path = ''
as $$
begin
  -- Admin desde el panel, o el script de respaldo con la clave secreta (service_role).
  if not (public.es_admin() or auth.role() = 'service_role') then
    raise exception 'Sin permiso' using errcode = '42501';
  end if;
  return json_build_object(
    'exportado_en', now(),
    'desarrollos', (select coalesce(json_agg(d order by d.posicion, d.id), '[]') from public.desarrollos d),
    'unidades', (select coalesce(json_agg(json_build_object(
        'desarrollo_id', u.desarrollo_id, 'posicion', u.posicion,
        'campos', public._unidad_json(u.campos, u.orden_campos)) order by u.desarrollo_id, u.posicion), '[]')
      from public.unidades u),
    'medios', (select coalesce(json_agg(m order by m.desarrollo_id nulls first, m.tipo, m.orden), '[]') from public.medios m),
    'configuracion', (select coalesce(json_agg(c order by c.clave), '[]') from public.configuracion c),
    'contenido', public._contenido(false));
end;
$$;

-- ---------------------------------------------------------------------
-- IMPORTACIÓN (solo desde el servidor con la clave secreta; nunca desde el navegador).
-- Inserta un desarrollo con sus unidades y medios en UNA transacción: o entra todo o nada.
-- Si el desarrollo ya existe NO toca nada y lo informa (no duplica ni pisa cambios).
-- p_desarrollo es json (no jsonb) para conservar el orden original de las claves de cada unidad.
-- ---------------------------------------------------------------------
create or replace function public.importar_desarrollo(
  p_desarrollo json, p_posicion integer, p_estado text, p_medios json)
returns text language plpgsql security definer set search_path = ''
as $$
declare
  v_id text := p_desarrollo ->> 'id';
  v_u json;
  v_i integer := 0;
  v_m json;
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
  return 'importado';
end;
$$;

-- Portada general, logo y fecha "actualizado". Solo agrega lo que falta.
create or replace function public.importar_general(p_actualizado text, p_medios json)
returns text language plpgsql security definer set search_path = ''
as $$
declare v_m json; v_n integer := 0;
begin
  insert into public.configuracion (clave, valor, publica)
  values ('actualizado', to_jsonb(p_actualizado), true) on conflict (clave) do nothing;
  for v_m in select * from json_array_elements(p_medios) loop
    if not exists (select 1 from public.medios where desarrollo_id is null and tipo = v_m ->> 'tipo' and eliminado_en is null) then
      insert into public.medios (desarrollo_id, tipo, orden, bucket, ruta, nombre, ancho, alto, bytes, sha256, formato, mime)
      values (null, v_m ->> 'tipo', 0, 'media', v_m ->> 'ruta', v_m ->> 'nombre', (v_m ->> 'ancho')::integer,
              (v_m ->> 'alto')::integer, (v_m ->> 'bytes')::bigint, v_m ->> 'sha256', v_m ->> 'formato', v_m ->> 'mime');
      v_n := v_n + 1;
    end if;
  end loop;
  return v_n || ' medios generales agregados';
end;
$$;

-- ---------------------------------------------------------------------
-- Permisos de ejecución de funciones (Supabase da EXECUTE a todos por defecto: se quita).
-- ---------------------------------------------------------------------
revoke all on function public._ruta_publica(text, text), public._unidad_json(jsonb, text[]),
  public._medios_json(text, text), public._desarrollo_json(public.desarrollos), public._contenido(boolean),
  public.contenido_publico(), public.contenido_completo(), public.eliminar_desarrollo(text),
  public.restaurar_desarrollo(text), public.estadisticas_panel(), public.exportar_todo(),
  public.importar_desarrollo(json, integer, text, json), public.importar_general(text, json)
  from public, anon, authenticated;

-- Funciones internas: las necesitan quienes llaman a contenido_* (corren con sus permisos y RLS).
grant execute on function public._ruta_publica(text, text), public._unidad_json(jsonb, text[]),
  public._medios_json(text, text), public._desarrollo_json(public.desarrollos), public._contenido(boolean)
  to anon, authenticated;
grant execute on function public.contenido_publico() to anon, authenticated;
grant execute on function public.contenido_completo(), public.eliminar_desarrollo(text),
  public.restaurar_desarrollo(text), public.estadisticas_panel(), public.exportar_todo() to authenticated;
-- Importación, comparación y respaldo: solo la clave secreta del servidor.
grant execute on function public.importar_desarrollo(json, integer, text, json),
  public.importar_general(text, json), public._contenido(boolean), public.exportar_todo(),
  public._ruta_publica(text, text), public._unidad_json(jsonb, text[]), public._medios_json(text, text),
  public._desarrollo_json(public.desarrollos) to service_role;
