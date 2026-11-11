-- =====================================================================
-- Fase 5 · Reemplazar un archivo sin perder el anterior
-- Antes el panel cambiaba la ruta del registro existente: la ruta vieja quedaba sin registro
-- y no se podía recuperar una versión publicada que la usaba (lo detectaron las pruebas).
-- Ahora, en UNA operación: el registro actual va a la papelera y se crea uno nuevo en la
-- misma posición. El archivo anterior sigue en Storage y en la papelera del panel.
-- =====================================================================
create or replace function public.reemplazar_medio(
  p_id uuid, p_ruta text, p_nombre text, p_ancho integer, p_alto integer, p_bytes bigint,
  p_sha256 text, p_formato text, p_mime text)
returns uuid language plpgsql security invoker set search_path = ''
as $$
declare
  v       public.medios;
  v_nuevo uuid;
begin
  if not public.es_admin() then raise exception 'Sin permiso' using errcode = '42501'; end if;
  select * into v from public.medios where id = p_id and eliminado_en is null for update;
  if not found then raise exception 'Ese archivo ya no está activo (recargá la página)'; end if;
  update public.medios set eliminado_en = now() where id = p_id;
  insert into public.medios (desarrollo_id, tipo, orden, bucket, ruta, nombre, ancho, alto, bytes, sha256, formato, mime, metadatos)
  values (v.desarrollo_id, v.tipo, v.orden, v.bucket, p_ruta, p_nombre, p_ancho, p_alto, p_bytes, p_sha256, p_formato, p_mime,
          jsonb_build_object('reemplaza_a', p_id))
  returning id into v_nuevo;
  return v_nuevo;
end;
$$;
revoke all on function public.reemplazar_medio(uuid, text, text, integer, integer, bigint, text, text, text) from public, anon, authenticated;
grant execute on function public.reemplazar_medio(uuid, text, text, integer, integer, bigint, text, text, text) to authenticated;
