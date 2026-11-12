// Cuenta administradora TEMPORAL para probar el panel en el navegador (solo proyecto de PRUEBA).
//   --crear   crea la cuenta (contraseña al azar) y guarda los datos en privado/cuenta-navegador.json (no se sube a Git)
//   --borrar  borra esa cuenta y el archivo
// La contraseña nunca se muestra en pantalla.
import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { cargarEntorno, clienteServidor, limpiar, RAIZ, salir, soloEnPrueba } from "./comun.mjs";

const e = cargarEntorno();
soloEnPrueba("cuenta_navegador.mjs");
const srv = clienteServidor(e);
const archivo = join(RAIZ, "privado", "cuenta-navegador.json");

if (process.argv.includes("--crear")) {
  if (existsSync(archivo)) salir("Ya hay una cuenta temporal creada. Borrala primero con --borrar.");
  const email = `zf-prueba-navegador-${randomBytes(3).toString("hex")}@example.com`;
  const clave = randomBytes(18).toString("base64url");
  const u = await srv.auth.admin.createUser({ email, password: clave, email_confirm: true });
  if (u.error) salir(limpiar(u.error.message, e));
  const r = await srv.from("roles_usuario").insert({ user_id: u.data.user.id, rol: "administrador", nota: "temporal: prueba del panel en el navegador" });
  if (r.error) { await srv.auth.admin.deleteUser(u.data.user.id); salir(limpiar(r.error.message, e)); }
  mkdirSync(join(RAIZ, "privado"), { recursive: true });
  writeFileSync(archivo, JSON.stringify({ id: u.data.user.id, email, clave }, null, 2));
  console.log(`Cuenta temporal creada: ${email} (datos en privado/cuenta-navegador.json)`);
} else if (process.argv.includes("--borrar")) {
  if (!existsSync(archivo)) salir("No hay cuenta temporal para borrar.");
  const { id, email } = JSON.parse(readFileSync(archivo, "utf8"));
  const r = await srv.auth.admin.deleteUser(id);
  if (r.error) salir(limpiar(r.error.message, e));
  rmSync(archivo);
  console.log(`Cuenta temporal ${email} borrada.`);
} else salir("Usá --crear o --borrar.");
