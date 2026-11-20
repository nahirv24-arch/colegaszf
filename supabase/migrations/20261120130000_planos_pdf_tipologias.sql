-- =====================================================================
-- Etapa 3 (20/11/2026) · Planos en PDF original, tipologías y miniaturas
--
-- SOLO AGREGA / AMPLÍA. No borra ni modifica datos existentes.
--   * medios.formato acepta además 'pdf', y SOLO para planos.
--   * Cada plano guarda en medios.metadatos (columna que ya existía):
--       titulo     nombre visible del plano ("Departamento 2 dormitorios")
--       tipologia  "Monoambiente", "1 dormitorio", "2 dormitorios"… u otra
--       variante   "Tipo A", "Tipo B"…
--       vista      { ruta, ancho, alto }: miniatura para la web (archivo aparte en el bucket "media").
--                  El archivo ORIGINAL (PDF o imagen) es el de medios.ruta y nunca se modifica.
--   * El JSON publicado suma "planosInfo" (alineado con "planos") SOLO si algún plano tiene PDF o
--     datos cargados. Un desarrollo con planos de imagen sin datos produce el mismo JSON que antes
--     (no aparecen falsos «cambios sin publicar»).
-- RLS y permisos: sin cambios. Las funciones nuevas exigen ser administradora.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) Formato PDF (solo planos)
-- ---------------------------------------------------------------------
alter table public.medios drop constraint if exists medios_formato_check;
alter table public.medios add constraint medios_formato_check
  check (formato in ('jpeg', 'png', 'webp', 'pdf'));
alter table public.medios add constraint medios_pdf_solo_planos
  check (formato is distinct from 'pdf' or tipo = 'plano');

-- ---------------------------------------------------------------------
-- 2) Información pública de los planos de un desarrollo (mismo orden que "planos")
-- ---------------------------------------------------------------------
create or replace function public._planos_info_json(p_desarrollo text)
returns json language sql stable set search_path = ''
as $$
  select coalesce(json_agg(json_build_object(
      'ruta', public._ruta_publica(m.bucket, m.ruta),
      'vista', coalesce(case when nullif(m.metadatos #>> '{vista,ruta}', '') is not null
                             then public._ruta_publica('media', m.metadatos #>> '{vista,ruta}') end, ''),
      'vistaAncho', coalesce((m.metadatos #>> '{vista,ancho}')::integer, m.ancho, 0),
      'vistaAlto', coalesce((m.metadatos #>> '{vista,alto}')::integer, m.alto, 0),
      'nombre', coalesce(m.metadatos ->> 'titulo', ''),
      'tipologia', coalesce(m.metadatos ->> 'tipologia', ''),
      'variante', coalesce(m.metadatos ->> 'variante', ''),
      'formato', coalesce(m.formato, ''),
      'bytes', coalesce(m.bytes, 0)) order by m.orden), '[]'::json)
  from public.medios m
  where m.desarrollo_id = p_desarrollo and m.tipo = 'plano' and m.eliminado_en is null;
$$;

create or replace function public._planos_con_datos(p_desarrollo text)
returns boolean language sql stable set search_path = ''
as $$
  select exists (
    select 1 from public.medios m
    where m.desarrollo_id = p_desarrollo and m.tipo = 'plano' and m.eliminado_en is null
      and (m.formato = 'pdf'
           or nullif(btrim(m.metadatos ->> 'titulo'), '') is not null
           or nullif(btrim(m.metadatos ->> 'tipologia'), '') is not null
           or nullif(btrim(m.metadatos ->> 'variante'), '') is not null
           or nullif(m.metadatos #>> '{vista,ruta}', '') is not null));
$$;

-- ---------------------------------------------------------------------
-- 3) JSON de un desarrollo: igual que en la etapa 2 + "planosInfo" cuando corresponde.
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
      'escribania',  nullif(btrim(d.escribania), ''))) as x),
  planos as (
    select case when public._planos_con_datos(d.id)
                then jsonb_build_object('planosInfo', public._planos_info_json(d.id)::jsonb)
                else '{}'::jsonb end as x),
  todo as (select extras.x || planos.x as x from extras, planos)
  select case when todo.x = '{}'::jsonb then base.j
              else (left(base.j::text, -1) || ', ' || substr(todo.x::text, 2))::json end
  from base, todo;
$$;

-- ---------------------------------------------------------------------
-- 4) Editar los datos de un plano sin volver a subir el archivo
-- ---------------------------------------------------------------------
create or replace function public.editar_plano(p_id uuid, p_titulo text, p_tipologia text, p_variante text)
returns void language plpgsql security invoker set search_path = ''
as $$
begin
  if not public.es_admin() then raise exception 'Sin permiso' using errcode = '42501'; end if;
  if length(coalesce(p_titulo, '')) > 200 or length(coalesce(p_tipologia, '')) > 80 or length(coalesce(p_variante, '')) > 80 then
    raise exception 'Texto demasiado largo';
  end if;
  update public.medios
     set metadatos = metadatos || jsonb_build_object(
           'titulo', btrim(coalesce(p_titulo, '')),
           'tipologia', btrim(coalesce(p_tipologia, '')),
           'variante', btrim(coalesce(p_variante, '')))
   where id = p_id and tipo = 'plano' and eliminado_en is null;
  if not found then raise exception 'Ese plano ya no está activo (recargá la página)'; end if;
end;
$$;

-- Guarda (o cambia) la miniatura de un plano. El archivo original no se toca.
create or replace function public.vista_plano(p_id uuid, p_ruta text, p_ancho integer, p_alto integer)
returns void language plpgsql security invoker set search_path = ''
as $$
begin
  if not public.es_admin() then raise exception 'Sin permiso' using errcode = '42501'; end if;
  if p_ruta is null or p_ruta !~ '^[a-z0-9][a-z0-9/_.-]*\.(webp|jpg|png)$' then raise exception 'Ruta de miniatura no válida'; end if;
  update public.medios
     set metadatos = metadatos || jsonb_build_object('vista', jsonb_build_object('ruta', p_ruta, 'ancho', p_ancho, 'alto', p_alto))
   where id = p_id and tipo = 'plano' and eliminado_en is null;
  if not found then raise exception 'Ese plano ya no está activo (recargá la página)'; end if;
end;
$$;

-- ---------------------------------------------------------------------
-- 5) Reemplazar un archivo conservando sus datos (tipología, nombre…). Igual que reemplazar_medio:
--    el registro anterior va a la papelera y el archivo anterior sigue en Storage.
--    La miniatura anterior NO se conserva (corresponde al archivo viejo); se puede mandar una nueva.
-- ---------------------------------------------------------------------
create or replace function public.reemplazar_medio_conservando(
  p_id uuid, p_ruta text, p_nombre text, p_ancho integer, p_alto integer, p_bytes bigint,
  p_sha256 text, p_formato text, p_mime text, p_metadatos jsonb default '{}'::jsonb)
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
          (v.metadatos - 'vista' - 'reemplaza_a') || coalesce(p_metadatos, '{}'::jsonb) || jsonb_build_object('reemplaza_a', p_id))
  returning id into v_nuevo;
  return v_nuevo;
end;
$$;

-- ---------------------------------------------------------------------
-- 6) Recuperar una versión: además, devuelve a cada plano los datos que tenía en esa versión.
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
  v_meta jsonb;
  v_inf  json;
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
    v_meta := v_m.metadatos;
    if v_t.tipo = 'plano' then
      v_inf := (v_c -> 'planosInfo') -> (v_t.n::integer - 1);
      -- Datos del plano tal como estaban en esa versión (si la versión no los tenía, quedan vacíos).
      v_meta := (v_meta - 'titulo' - 'tipologia' - 'variante' - 'vista')
        || jsonb_build_object('titulo', coalesce(v_inf ->> 'nombre', ''),
                              'tipologia', coalesce(v_inf ->> 'tipologia', ''),
                              'variante', coalesce(v_inf ->> 'variante', ''))
        || case when nullif(v_inf ->> 'vista', '') is not null
                then jsonb_build_object('vista', jsonb_build_object(
                       'ruta', regexp_replace(v_inf ->> 'vista', '^media/', ''),
                       'ancho', (v_inf ->> 'vistaAncho')::integer, 'alto', (v_inf ->> 'vistaAlto')::integer))
                else '{}'::jsonb end;
    end if;
    insert into public.medios (desarrollo_id, tipo, orden, bucket, ruta, nombre, ancho, alto, bytes, sha256, formato, mime, metadatos)
    values (v_id, v_t.tipo, v_t.n::integer, v_m.bucket, v_m.ruta, v_m.nombre, v_m.ancho, v_m.alto, v_m.bytes, v_m.sha256,
            v_m.formato, v_m.mime, v_meta);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------
-- 7) Permisos
-- ---------------------------------------------------------------------
revoke all on function public._planos_info_json(text), public._planos_con_datos(text) from public;
grant execute on function public._planos_info_json(text), public._planos_con_datos(text) to anon, authenticated, service_role;

revoke all on function public.editar_plano(uuid, text, text, text), public.vista_plano(uuid, text, integer, integer),
  public.reemplazar_medio_conservando(uuid, text, text, integer, integer, bigint, text, text, text, jsonb)
  from public, anon;
grant execute on function public.editar_plano(uuid, text, text, text), public.vista_plano(uuid, text, integer, integer),
  public.reemplazar_medio_conservando(uuid, text, text, integer, integer, bigint, text, text, text, jsonb)
  to authenticated;
