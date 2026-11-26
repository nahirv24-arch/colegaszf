-- «Página cerrada»: la pantalla de ingreso muestra el logo, así que estado_pagina() también lo devuelve
-- (el logo es lo único que se agrega; el material sigue bloqueado sin cuenta). Solo reemplaza esa función.
create or replace function public.estado_pagina()
returns json language sql stable security definer set search_path = ''
as $$
  select json_build_object(
    'cerrada', public.pagina_cerrada(),
    'admin', public.es_admin(),
    'cuenta', (select json_build_object('nombre', c.nombre_apellido, 'usuario', c.usuario,
                                        'clave_provisoria', c.clave_provisoria, 'activa', c.acceso_activo)
               from public.colegas c where c.user_id = (select auth.uid()) and auth.uid() is not null limit 1),
    'logo', coalesce((select public._ruta_publica(m.bucket, m.ruta) from public.medios m
                      where m.tipo = 'logo' and m.eliminado_en is null order by m.orden limit 1), ''));
$$;

revoke all on function public.estado_pagina() from public;
grant execute on function public.estado_pagina() to anon, authenticated;
