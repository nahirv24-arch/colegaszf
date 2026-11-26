-- =====================================================================
-- Registro de colegas SIN aprobación (26/11/2026, pedido de Nahir).
--
-- SOLO cambia la función registrar_colega: la cuenta nueva queda activa al instante
-- (pendiente = false, acceso_activo = true). No borra datos.
-- Si quedara alguien pendiente de antes, se lo habilita (es lo que se pidió: que entren solos).
-- La administradora puede seguir pausando o quitando una cuenta desde el panel (Colegas).
-- =====================================================================

create or replace function public.registrar_colega(p_nombre text, p_usuario text, p_clave text)
returns void language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_nombre text := regexp_replace(btrim(coalesce(p_nombre, '')), '\s+', ' ', 'g');
  v_usuario text := lower(btrim(coalesce(p_usuario, '')));
  v_user uuid;
begin
  if length(v_nombre) < 3 or length(v_nombre) > 120 then
    raise exception 'Escribí tu nombre y apellido.';
  end if;
  if v_usuario !~ '^[a-z0-9][a-z0-9._-]{2,39}$' then
    raise exception 'El usuario tiene que tener entre 3 y 40 letras sin acentos, números o puntos (ej.: juan.perez).';
  end if;
  if length(coalesce(p_clave, '')) < 8 then raise exception 'La contraseña tiene que tener al menos 8 caracteres.'; end if;
  if length(p_clave) > 72 then raise exception 'La contraseña es demasiado larga (máximo 72 caracteres).'; end if;
  -- Freno contra registros masivos (alguien creando cuentas en cadena).
  if (select count(*) from public.colegas where origen = 'registro' and creado_en > now() - interval '1 hour') >= 20
     or (select count(*) from public.colegas where origen = 'registro' and creado_en > now() - interval '1 day') >= 100 then
    raise exception 'Por ahora no podemos tomar más registros. Escribinos por WhatsApp y te damos acceso.';
  end if;
  if exists (select 1 from public.colegas where usuario = v_usuario)
     or exists (select 1 from auth.users where lower(email) = public._correo_colega(v_usuario)) then
    raise exception 'El usuario «%» ya existe. Probá con otro (por ejemplo, agregando la inicial del segundo nombre).', v_usuario;
  end if;

  v_user := public._crear_usuario_colega(v_usuario, p_clave, v_nombre);
  insert into public.colegas (nombre_apellido, usuario, user_id, origen, pendiente, acceso_activo, clave_provisoria)
  values (v_nombre, v_usuario, v_user, 'registro', false, true, false);
end;
$$;

update public.colegas set pendiente = false, acceso_activo = true where pendiente;

revoke all on function public.registrar_colega(text, text, text) from public;
grant execute on function public.registrar_colega(text, text, text) to anon, authenticated;
