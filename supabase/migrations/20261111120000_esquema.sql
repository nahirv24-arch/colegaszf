-- =====================================================================
-- Fase 4 · 1/4 · Esquema de datos de "Material para colegas"
-- Basado en el análisis de datos/desarrollos.json (11/11/2026):
--   17 desarrollos, 207 unidades, todos los valores de unidades son texto,
--   estados comerciales reales: "Disponible" (206) y "Reservada" (1).
-- Nada se convierte ni se redondea: precios, superficies y textos quedan como texto.
-- =====================================================================

-- ---------------------------------------------------------------------
-- DESARROLLOS
-- ---------------------------------------------------------------------
create table public.desarrollos (
  id                  text primary key
                      check (id ~ '^[a-z0-9][a-z0-9-]*$'),         -- id original (links /#reggia-6)
  posicion            integer not null,                             -- orden de carga original
  nombre              text not null check (length(btrim(nombre)) > 0),
  direccion           text not null default '',
  desarrollista       text not null default '',
  posesion            text not null default '',                     -- texto libre ("Julio 2029 (aprox.)")
  gastos              text not null default '',
  nota_tabla          text not null default '',
  links               jsonb not null
                      default '{"disponibles": "", "brochure": "", "planogeneral": ""}'::jsonb
                      check (jsonb_typeof(links) = 'object'),
  columnas            jsonb not null default '[]'::jsonb             -- [[clave, título], ...] en orden
                      check (jsonb_typeof(columnas) = 'array'),
  disponibles_ejemplo boolean not null default false,
  info_extra          jsonb not null default '{}'::jsonb             -- información complementaria futura
                      check (jsonb_typeof(info_extra) = 'object'),
  estado              text not null default 'borrador'
                      check (estado in ('borrador', 'publicado')),
  visible             boolean not null default true,
  creado_en           timestamptz not null default now(),
  modificado_en       timestamptz not null default now(),
  creado_por          uuid references auth.users (id) on delete set null,
  modificado_por      uuid references auth.users (id) on delete set null,
  eliminado_en        timestamptz,                                   -- papelera (borrado recuperable)
  eliminado_por       uuid references auth.users (id) on delete set null
);
comment on table public.desarrollos is 'Desarrollos inmobiliarios. Clave interna original: "emprendimientos".';
create index desarrollos_publicos_idx on public.desarrollos (posicion)
  where estado = 'publicado' and visible and eliminado_en is null;

-- ---------------------------------------------------------------------
-- UNIDADES
-- Cada desarrollo tiene columnas distintas (sup, total, suptotal, contado, c1, c2...).
-- "campos" guarda TODAS las claves de la fila tal cual; "orden_campos" conserva el orden
-- original de las claves (jsonb no lo guarda). Las columnas de abajo se calculan solas
-- a partir de "campos" para poder filtrar y contar sin duplicar datos.
-- ---------------------------------------------------------------------
create table public.unidades (
  id             uuid primary key default gen_random_uuid(),
  desarrollo_id  text not null references public.desarrollos (id) on update cascade on delete restrict,
  posicion       integer not null check (posicion > 0),              -- fila original (1, 2, 3...)
  campos         jsonb not null check (jsonb_typeof(campos) = 'object'),
  orden_campos   text[] not null default '{}',
  grupo          text generated always as (campos ->> 'grupo') stored,
  piso           text generated always as (campos ->> 'piso') stored,
  unidad         text generated always as (campos ->> 'unidad') stored,
  tipologia      text generated always as (campos ->> 'tipologia') stored,
  estado         text generated always as (campos ->> 'estado') stored,
  precio         text generated always as (campos ->> 'precio') stored,  -- TEXTO, sin convertir
  creado_en      timestamptz not null default now(),
  modificado_en  timestamptz not null default now(),
  creado_por     uuid references auth.users (id) on delete set null,
  modificado_por uuid references auth.users (id) on delete set null,
  constraint unidades_posicion_unica unique (desarrollo_id, posicion) deferrable initially immediate
);
comment on column public.unidades.campos is 'Todos los campos de la fila. Los valores son texto y no se convierten.';
create index unidades_desarrollo_idx on public.unidades (desarrollo_id, posicion);
create index unidades_estado_idx on public.unidades (estado);

-- ---------------------------------------------------------------------
-- MULTIMEDIA (portadas, fotos, renders, planos, páginas de brochure, portada general, logo)
-- ---------------------------------------------------------------------
create table public.medios (
  id             uuid primary key default gen_random_uuid(),
  desarrollo_id  text references public.desarrollos (id) on update cascade on delete restrict,
  tipo           text not null check (tipo in
                   ('portada', 'foto', 'render', 'plano', 'pagina_brochure', 'portada_general', 'logo')),
  orden          integer not null check (orden >= 0),                -- 1, 2, 3... (0 = portada/logo)
  bucket         text not null default 'media' check (bucket in ('media', 'privado')),
  ruta           text not null,                                      -- ruta dentro del bucket
  nombre         text not null default '',
  ancho          integer check (ancho > 0),
  alto           integer check (alto > 0),
  bytes          bigint check (bytes >= 0),
  sha256         text check (sha256 ~ '^[0-9a-f]{64}$'),
  formato        text check (formato in ('jpeg', 'png', 'webp')),
  mime           text,
  metadatos      jsonb not null default '{}'::jsonb,
  creado_en      timestamptz not null default now(),
  modificado_en  timestamptz not null default now(),
  creado_por     uuid references auth.users (id) on delete set null,
  modificado_por uuid references auth.users (id) on delete set null,
  eliminado_en   timestamptz,
  eliminado_por  uuid references auth.users (id) on delete set null,
  constraint medios_general_sin_desarrollo
    check ((desarrollo_id is null) = (tipo in ('portada_general', 'logo')))
);
-- Un solo archivo activo por posición: conserva el orden exacto (clave para el PDF del brochure).
create unique index medios_posicion_unica on public.medios
  (coalesce(desarrollo_id, '_general'), tipo, orden) where eliminado_en is null;
create index medios_desarrollo_idx on public.medios (desarrollo_id, tipo, orden);

-- ---------------------------------------------------------------------
-- CONFIGURACIÓN (fecha "actualizado" y otras opciones). "publica" = la ve cualquiera.
-- ---------------------------------------------------------------------
create table public.configuracion (
  clave          text primary key check (clave ~ '^[a-z0-9_]+$'),
  valor          jsonb not null,
  publica        boolean not null default false,
  modificado_en  timestamptz not null default now(),
  modificado_por uuid references auth.users (id) on delete set null
);

-- ---------------------------------------------------------------------
-- ROLES (administrador hoy; editor reservado para el futuro)
-- Solo se asignan desde el servidor (script con clave secreta o editor SQL de Supabase).
-- ---------------------------------------------------------------------
create table public.roles_usuario (
  user_id     uuid primary key references auth.users (id) on delete cascade,
  rol         text not null check (rol in ('administrador', 'editor')),
  asignado_en timestamptz not null default now(),
  nota        text not null default ''
);

-- ---------------------------------------------------------------------
-- HISTORIAL de cambios (lo llenan triggers; nadie lo escribe desde el navegador)
-- ---------------------------------------------------------------------
create table public.historial (
  id          bigint generated always as identity primary key,
  fecha       timestamptz not null default now(),
  usuario     uuid,                 -- auth.uid() de quien hizo el cambio (null = proceso del servidor)
  rol         text,                 -- 'administrador', 'service_role', etc.
  tabla       text not null,
  registro_id text not null,
  accion      text not null check (accion in ('crear', 'editar', 'eliminar', 'restaurar', 'borrar_definitivo')),
  antes       jsonb,
  despues     jsonb
);
create index historial_fecha_idx on public.historial (fecha desc);
create index historial_registro_idx on public.historial (tabla, registro_id, fecha desc);
