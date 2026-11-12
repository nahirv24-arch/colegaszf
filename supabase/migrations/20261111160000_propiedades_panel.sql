-- =====================================================================
-- Etapa 4 · Funciones del panel para Terceros y Comercios (solo administradora).
-- SOLO AGREGA funciones nuevas. No cambia tablas, datos ni políticas.
--
-- Material esencial de una propiedad (para «incompletas»; propuesta, a confirmar por Nahir):
--   portada · ubicación (dirección o barrio) · precio · superficie · al menos 1 foto
-- Opcionales (no cuentan): planos, documentos, descripción, características, links.
-- =====================================================================

-- Lo que falta de lo esencial (lista de etiquetas; vacía = completa).
create or replace function public._propiedad_faltantes(p public.propiedades)
returns text[] language sql stable set search_path = ''
as $$
  select array_remove(array[
    case when not exists (select 1 from public.propiedad_medios m
                          where m.propiedad_id = p.id and m.tipo = 'portada' and m.eliminado_en is null) then 'Portada' end,
    case when btrim(p.direccion) = '' and btrim(p.barrio) = '' then 'Ubicación' end,
    case when btrim(p.precio) = '' then 'Precio' end,
    case when btrim(p.superficie) = '' then 'Superficie' end,
    case when not exists (select 1 from public.propiedad_medios m
                          where m.propiedad_id = p.id and m.tipo = 'foto' and m.eliminado_en is null) then 'Fotos' end
  ], null);
$$;
revoke all on function public._propiedad_faltantes(public.propiedades) from public, anon, authenticated;

-- Listado del panel (incluye la papelera; el panel filtra).
create or replace function public.resumen_propiedades(p_categoria text default null)
returns json language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.es_admin() then raise exception 'Sin permiso' using errcode = '42501'; end if;
  return coalesce((
    select json_agg(json_build_object(
      'id', p.id, 'categoria', p.categoria, 'titulo', p.titulo, 'operacion', p.operacion,
      'direccion', p.direccion, 'barrio', p.barrio, 'precio', p.precio, 'disponibilidad', p.disponibilidad,
      'estado', p.estado, 'visible', p.visible, 'eliminado_en', p.eliminado_en, 'modificado_en', p.modificado_en,
      'fotos', (select count(*) from public.propiedad_medios m where m.propiedad_id = p.id and m.tipo = 'foto' and m.eliminado_en is null),
      'planos', (select count(*) from public.propiedad_medios m where m.propiedad_id = p.id and m.tipo = 'plano' and m.eliminado_en is null),
      'documentos', (select count(*) from public.propiedad_medios m where m.propiedad_id = p.id and m.tipo = 'documento' and m.eliminado_en is null),
      'tiene_portada', exists (select 1 from public.propiedad_medios m where m.propiedad_id = p.id and m.tipo = 'portada' and m.eliminado_en is null),
      'faltan', to_json(public._propiedad_faltantes(p)),
      'version_vigente', v.version, 'publicado_en', v.publicado_en,
      'cambios_sin_publicar', case when v.id is null then p.estado = 'borrador'
                                   else v.contenido::jsonb is distinct from public._propiedad_json(p)::jsonb end
    ) order by p.posicion, p.creado_en desc, p.id)
    from public.propiedades p
    left join public.propiedad_publicaciones v on v.propiedad_id = p.id and v.vigente
    where p_categoria is null or p.categoria = p_categoria), '[]'::json);
end;
$$;

-- Cambiar el orden de las fotos / planos / documentos de una propiedad.
create or replace function public.reordenar_propiedad_medios(p_id text, p_tipo text, p_ids uuid[])
returns void language plpgsql security invoker set search_path = ''
as $$
begin
  if not public.es_admin() then raise exception 'Sin permiso' using errcode = '42501'; end if;
  if (select count(*) from public.propiedad_medios where propiedad_id = p_id and tipo = p_tipo and eliminado_en is null) <> cardinality(p_ids)
     or (select count(*) from public.propiedad_medios where propiedad_id = p_id and tipo = p_tipo and eliminado_en is null and id = any (p_ids)) <> cardinality(p_ids) then
    raise exception 'La lista no coincide con los archivos actuales (recargá la página)';
  end if;
  update public.propiedad_medios set orden = orden + 1000000 where propiedad_id = p_id and tipo = p_tipo and eliminado_en is null;
  update public.propiedad_medios m set orden = t.ord from unnest(p_ids) with ordinality as t(id, ord) where m.id = t.id;
end;
$$;

-- Vista previa: la ficha armada con el BORRADOR (lo que se publicaría), más las medidas de las imágenes.
create or replace function public.propiedad_borrador(p_id text)
returns json language plpgsql stable security definer set search_path = ''
as $$
declare v_p public.propiedades;
begin
  if not public.es_admin() then raise exception 'Sin permiso' using errcode = '42501'; end if;
  select * into v_p from public.propiedades where id = p_id;
  if not found then return null; end if;
  return json_build_object(
    'propiedad', public._propiedad_json(v_p),
    'medios', coalesce((select json_agg(json_build_object('ruta', public._ruta_publica(m.bucket, m.ruta), 'sha256', m.sha256,
                          'bytes', m.bytes, 'formato', m.formato, 'ancho', m.ancho, 'alto', m.alto))
                        from public.propiedad_medios m where m.propiedad_id = p_id and m.eliminado_en is null), '[]'::json));
end;
$$;

revoke all on function public.resumen_propiedades(text), public.reordenar_propiedad_medios(text, text, uuid[]),
  public.propiedad_borrador(text) from public, anon;
grant execute on function public.resumen_propiedades(text), public.reordenar_propiedad_medios(text, text, uuid[]),
  public.propiedad_borrador(text) to authenticated;
