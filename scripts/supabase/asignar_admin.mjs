// Da el rol ADMINISTRADOR a una cuenta que YA EXISTE en Supabase Auth.
// La cuenta (email + contraseña) la crea Nahir en el panel de Supabase; este script nunca
// ve ni guarda contraseñas. Solo se puede ejecutar en esta computadora, con la clave secreta.
// Uso: npm run sb:admin -- correo@ejemplo.com
import { cargarEntorno, clienteServidor, limpiar, salir } from "./comun.mjs";

const email = (process.argv[2] ?? "").trim().toLowerCase();
if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) salir("Indicá el correo de la cuenta: npm run sb:admin -- correo@ejemplo.com");

const e = cargarEntorno();
const db = clienteServidor(e);

let usuario = null;
for (let pagina = 1; !usuario; pagina++) {
  const { data, error } = await db.auth.admin.listUsers({ page: pagina, perPage: 200 });
  if (error) salir(limpiar(error.message, e));
  usuario = data.users.find((u) => (u.email ?? "").toLowerCase() === email) ?? null;
  if (data.users.length < 200) break;
}
if (!usuario) salir("No existe una cuenta con ese correo en Authentication → Users. Creala primero.");
if (!usuario.email_confirmed_at) console.warn("Aviso: la cuenta todavía no tiene el correo confirmado.");

const { data: ya } = await db.from("roles_usuario").select("rol").eq("user_id", usuario.id).maybeSingle();
if (ya?.rol === "administrador") { console.log("Esa cuenta ya era administradora. No se cambió nada."); process.exit(0); }
const { error } = await db.from("roles_usuario").upsert({ user_id: usuario.id, rol: "administrador", nota: "asignado con scripts/supabase/asignar_admin.mjs" });
if (error) salir(limpiar(error.message, e));
console.log("Listo: la cuenta ahora es ADMINISTRADORA.");
