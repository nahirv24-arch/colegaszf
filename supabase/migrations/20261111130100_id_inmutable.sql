-- =====================================================================
-- Fase 5 · El identificador de un desarrollo (el que va en los links /#reggia-6) no se puede
-- cambiar una vez creado. Lo detectaron las pruebas del panel: antes solo lo evitaba el formulario.
-- =====================================================================
create or replace function public.bloquear_cambio_id()
returns trigger language plpgsql set search_path = ''
as $$
begin
  if new.id is distinct from old.id then
    raise exception 'El identificador de un desarrollo no se puede cambiar (los links de los colegas dejarían de funcionar)'
      using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function public.bloquear_cambio_id() from public, anon, authenticated;

create trigger desarrollos_id_inmutable before update of id on public.desarrollos
  for each row execute function public.bloquear_cambio_id();
