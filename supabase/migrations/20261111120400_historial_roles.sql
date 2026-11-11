-- =====================================================================
-- Fase 4 · corrección · El historial no podía registrar cambios de roles_usuario
-- (esa tabla se identifica por user_id, no por id ni clave). Lo detectaron las pruebas.
-- =====================================================================
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
    coalesce(v_despues ->> 'id', v_antes ->> 'id', v_despues ->> 'clave', v_antes ->> 'clave',
             v_despues ->> 'user_id', v_antes ->> 'user_id', '(sin id)'),
    v_accion, v_antes, v_despues);
  return coalesce(new, old);
end;
$$;
revoke all on function public.registrar_cambio() from public, anon, authenticated;
