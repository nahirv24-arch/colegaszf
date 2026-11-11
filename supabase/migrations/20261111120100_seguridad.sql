-- =====================================================================
-- Fase 4 · 2/4 · Roles, sellos de fecha/usuario, historial y Row Level Security
-- Principio: el navegador solo usa la clave pública (anon). Todo permiso se decide
-- AQUÍ, en la base de datos. Estar logueado NO alcanza: hace falta el rol administrador.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Funciones de rol. SECURITY DEFINER para poder leer roles_usuario sin exponerla.
-- ---------------------------------------------------------------------
create or replace function public.rol_actual()
returns text
language sql stable security definer
set search_path = ''
as $$
  select r.rol from public.roles_usuario r where r.user_id = (select auth.uid());
$$;

create or replace function public.es_admin()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select coalesce(
    (select r.rol = 'administrador' from public.roles_usuario r where r.user_id = (select auth.uid())),
    false);
$$;

-- Reservada para cuando existan editores (hoy solo el administrador puede editar).
create or replace function public.puede_editar()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select public.es_admin();
$$;

revoke all on function public.rol_actual(), public.es_admin(), public.puede_editar() from public;
grant execute on function public.rol_actual(), public.es_admin(), public.puede_editar() to anon, authenticated;

-- ---------------------------------------------------------------------
-- Sellos automáticos: quién y cuándo creó / modificó. No se pueden falsificar desde el navegador.
-- ---------------------------------------------------------------------
create or replace function public.sellar_cambios()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if to_jsonb(new) ? 'creado_en' then
      new.creado_en := now();
      new.creado_por := auth.uid();
    end if;
  else
    if to_jsonb(new) ? 'creado_en' then
      new.creado_en := old.creado_en;       -- la fecha de creación no se puede cambiar
      new.creado_por := old.creado_por;
    end if;
  end if;
  new.modificado_en := now();
  new.modificado_por := auth.uid();
  if to_jsonb(new) ? 'eliminado_en' then
    if new.eliminado_en is not null and (tg_op = 'INSERT' or old.eliminado_en is null) then
      new.eliminado_en := now();
      new.eliminado_por := auth.uid();
    elsif new.eliminado_en is null then
      new.eliminado_por := null;
    elsif tg_op = 'UPDATE' then
      new.eliminado_en := old.eliminado_en;
      new.eliminado_por := old.eliminado_por;
    end if;
  end if;
  return new;
end;
$$;

create trigger desarrollos_sellar before insert or update on public.desarrollos
  for each row execute function public.sellar_cambios();
create trigger unidades_sellar before insert or update on public.unidades
  for each row execute function public.sellar_cambios();
create trigger medios_sellar before insert or update on public.medios
  for each row execute function public.sellar_cambios();
create trigger configuracion_sellar before insert or update on public.configuracion
  for each row execute function public.sellar_cambios();

-- ---------------------------------------------------------------------
-- Historial: copia de "antes" y "después" de cada cambio. Las tablas no guardan
-- contraseñas ni credenciales, así que el historial tampoco.
-- ---------------------------------------------------------------------
create or replace function public.registrar_cambio()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  v_antes   jsonb := case when tg_op <> 'INSERT' then to_jsonb(old) end;
  v_despues jsonb := case when tg_op <> 'DELETE' then to_jsonb(new) end;
  v_accion  text;
begin
  if tg_op = 'INSERT' then
    v_accion := 'crear';
  elsif tg_op = 'DELETE' then
    v_accion := 'borrar_definitivo';
  else
    -- No registrar "cambios" que no cambian nada (solo la fecha de modificación).
    if (v_antes - 'modificado_en' - 'modificado_por') = (v_despues - 'modificado_en' - 'modificado_por') then
      return new;
    end if;
    if (v_antes ->> 'eliminado_en') is null and (v_despues ->> 'eliminado_en') is not null then
      v_accion := 'eliminar';
    elsif (v_antes ->> 'eliminado_en') is not null and (v_despues ->> 'eliminado_en') is null then
      v_accion := 'restaurar';
    else
      v_accion := 'editar';
    end if;
  end if;
  insert into public.historial (usuario, rol, tabla, registro_id, accion, antes, despues)
  values (
    auth.uid(),
    coalesce(public.rol_actual(), auth.role()),
    tg_table_name,
    coalesce(v_despues ->> 'id', v_antes ->> 'id', v_despues ->> 'clave', v_antes ->> 'clave'),
    v_accion, v_antes, v_despues);
  return coalesce(new, old);
end;
$$;
revoke all on function public.registrar_cambio() from public, anon, authenticated;

create trigger desarrollos_historial after insert or update or delete on public.desarrollos
  for each row execute function public.registrar_cambio();
create trigger unidades_historial after insert or update or delete on public.unidades
  for each row execute function public.registrar_cambio();
create trigger medios_historial after insert or update or delete on public.medios
  for each row execute function public.registrar_cambio();
create trigger configuracion_historial after insert or update or delete on public.configuracion
  for each row execute function public.registrar_cambio();
create trigger roles_historial after insert or update or delete on public.roles_usuario
  for each row execute function public.registrar_cambio();

-- ---------------------------------------------------------------------
-- Privilegios SQL explícitos (se quitan los que Supabase da por defecto y se dan solo los necesarios)
-- ---------------------------------------------------------------------
revoke all on public.desarrollos, public.unidades, public.medios, public.configuracion,
              public.roles_usuario, public.historial from anon, authenticated;

grant select on public.desarrollos, public.unidades, public.medios, public.configuracion to anon, authenticated;
grant insert, update on public.desarrollos, public.medios, public.configuracion to authenticated;
grant insert, update, delete on public.unidades to authenticated;  -- quitar una fila de la tabla de precios
grant select on public.roles_usuario, public.historial to authenticated;
-- Nadie (fuera del servidor) puede: borrar desarrollos/medios/configuración definitivamente,
-- escribir roles ni escribir el historial.

-- ---------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------
alter table public.desarrollos   enable row level security;
alter table public.unidades      enable row level security;
alter table public.medios        enable row level security;
alter table public.configuracion enable row level security;
alter table public.roles_usuario enable row level security;
alter table public.historial     enable row level security;

-- ¿El desarrollo está a la vista del público?
create or replace function public.desarrollo_es_publico(p_id text)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.desarrollos d
    where d.id = p_id and d.estado = 'publicado' and d.visible and d.eliminado_en is null);
$$;
revoke all on function public.desarrollo_es_publico(text) from public;
grant execute on function public.desarrollo_es_publico(text) to anon, authenticated;

-- DESARROLLOS
create policy "desarrollos: público ve los publicados; admin ve todo"
  on public.desarrollos for select to anon, authenticated
  using ((estado = 'publicado' and visible and eliminado_en is null) or (select public.es_admin()));
create policy "desarrollos: solo admin crea"
  on public.desarrollos for insert to authenticated
  with check ((select public.es_admin()));
create policy "desarrollos: solo admin modifica"
  on public.desarrollos for update to authenticated
  using ((select public.es_admin())) with check ((select public.es_admin()));

-- UNIDADES
create policy "unidades: público ve las de desarrollos publicados; admin ve todo"
  on public.unidades for select to anon, authenticated
  using (public.desarrollo_es_publico(desarrollo_id) or (select public.es_admin()));
create policy "unidades: solo admin crea"
  on public.unidades for insert to authenticated with check ((select public.es_admin()));
create policy "unidades: solo admin modifica"
  on public.unidades for update to authenticated
  using ((select public.es_admin())) with check ((select public.es_admin()));
create policy "unidades: solo admin quita filas"
  on public.unidades for delete to authenticated using ((select public.es_admin()));

-- MEDIOS
create policy "medios: público ve los activos de desarrollos publicados; admin ve todo"
  on public.medios for select to anon, authenticated
  using (
    (eliminado_en is null and bucket = 'media'
      and (desarrollo_id is null or public.desarrollo_es_publico(desarrollo_id)))
    or (select public.es_admin()));
create policy "medios: solo admin crea"
  on public.medios for insert to authenticated with check ((select public.es_admin()));
create policy "medios: solo admin modifica"
  on public.medios for update to authenticated
  using ((select public.es_admin())) with check ((select public.es_admin()));

-- CONFIGURACIÓN
create policy "configuracion: público ve la pública; admin ve todo"
  on public.configuracion for select to anon, authenticated
  using (publica or (select public.es_admin()));
create policy "configuracion: solo admin crea"
  on public.configuracion for insert to authenticated with check ((select public.es_admin()));
create policy "configuracion: solo admin modifica"
  on public.configuracion for update to authenticated
  using ((select public.es_admin())) with check ((select public.es_admin()));

-- ROLES: cada usuario ve solo su propio rol; el admin ve todos. Sin políticas de escritura:
-- NADIE puede asignarse ni asignar roles desde el navegador.
create policy "roles: ver el propio; admin ve todos"
  on public.roles_usuario for select to authenticated
  using (user_id = (select auth.uid()) or (select public.es_admin()));

-- HISTORIAL: solo el admin lo lee. Sin políticas de escritura (lo escriben los triggers).
create policy "historial: solo admin lee"
  on public.historial for select to authenticated using ((select public.es_admin()));
