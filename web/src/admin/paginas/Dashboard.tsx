import { Link } from "react-router";
import { leerEstadisticas, type Estadisticas } from "../servicio";
import { Cargando, ErrorCaja, fechaHora, useCarga } from "../ui";

const ACCION: Record<string, string> = { crear: "Creó", editar: "Editó", eliminar: "Mandó a la papelera", restaurar: "Recuperó", borrar_definitivo: "Borró definitivamente" };
const TABLA: Record<string, string> = { desarrollos: "desarrollo", unidades: "unidad", medios: "archivo", configuracion: "configuración", publicaciones: "publicación", roles_usuario: "rol de usuario" };
const FALTA: Record<string, string> = { portada: "portada", disponibles: "lista de disponibles", brochure: "brochure", fotos: "fotos", renders: "renders", planos: "planos", posesion: "fecha de posesión", direccion: "dirección" };

export function quien(email: string | null, rol: string | null): string {
  if (email) return email;
  if (rol === "service_role") return "Sistema (importación o script)";
  return "Sistema";
}

function Tarjeta({ n, texto, nota, acento, a }: { readonly n: number; readonly texto: string; readonly nota?: string; readonly acento?: boolean; readonly a?: string }) {
  const cuerpo = (<><span className="adm-num">{n.toLocaleString("es-AR")}</span><span className="adm-tarjeta-txt">{texto}</span>{nota ? <span className="adm-tarjeta-nota">{nota}</span> : null}</>);
  return a ? <Link to={a} className={acento ? "adm-tarjeta acento" : "adm-tarjeta"}>{cuerpo}</Link>
           : <div className={acento ? "adm-tarjeta acento" : "adm-tarjeta"}>{cuerpo}</div>;
}

export function Dashboard() {
  const { datos: s, cargando, error, recargar } = useCarga<Estadisticas>(leerEstadisticas, []);
  if (cargando && !s) return <Cargando texto="Calculando el resumen…" />;
  if (error) return <ErrorCaja texto={error} reintentar={recargar} />;
  if (!s) return null;
  const otrosEstados = Object.entries(s.unidades_por_estado).filter(([k]) => !/^\s*(disponible|libre|reservad|vendid)/i.test(k));

  return (
    <div className="adm-pagina">
      <p className="adm-intro">Resumen calculado en este momento desde la base de datos. Las cifras cambian solas cuando editás o publicás.</p>

      <section aria-labelledby="t-des">
        <h2 id="t-des" className="adm-subtitulo">Desarrollos</h2>
        <div className="adm-tarjetas">
          <Tarjeta n={s.desarrollos} texto="Desarrollos en total" a="/admin/desarrollos" />
          <Tarjeta n={s.publicados} texto="Publicados" />
          <Tarjeta n={s.borradores} texto="En borrador" />
          <Tarjeta n={s.con_material_incompleto} texto="Con material incompleto" acento={s.con_material_incompleto > 0} />
          {s.con_cambios_sin_publicar ? <Tarjeta n={s.con_cambios_sin_publicar} texto="Con cambios sin publicar" acento a="/admin/desarrollos?filtro=cambios" /> : null}
          {s.ocultos ? <Tarjeta n={s.ocultos} texto="Ocultos" /> : null}
        </div>
      </section>

      <section aria-labelledby="t-uni">
        <h2 id="t-uni" className="adm-subtitulo">Unidades</h2>
        <div className="adm-tarjetas">
          <Tarjeta n={s.unidades} texto="Unidades registradas" />
          <Tarjeta n={s.unidades_disponibles} texto="Disponibles" />
          <Tarjeta n={s.unidades_reservadas} texto="Reservadas" />
          {s.existe_estado_vendida ? <Tarjeta n={s.unidades_vendidas} texto="Vendidas" /> : null}
          {otrosEstados.map(([k, n]) => <Tarjeta key={k} n={n} texto={`Estado "${k}"`} />)}
        </div>
        {!s.existe_estado_vendida ? <p className="adm-nota">No hay unidades con estado "Vendida" en los datos, por eso no se muestra esa cifra.</p> : null}
      </section>

      <section aria-labelledby="t-mat">
        <h2 id="t-mat" className="adm-subtitulo">Material</h2>
        <div className="adm-tarjetas">
          <Tarjeta n={s.fotos} texto="Fotografías reales" />
          <Tarjeta n={s.renders} texto="Renders" />
          <Tarjeta n={s.planos} texto="Planos" />
          <Tarjeta n={s.paginas_brochure} texto="Páginas de brochure" />
        </div>
      </section>

      <div className="adm-dos-col">
        <section className="adm-panel" aria-labelledby="t-inc">
          <h2 id="t-inc" className="adm-subtitulo">Material incompleto</h2>
          {s.detalle_incompletos.length === 0 ? <p className="adm-nota">Todos los desarrollos tienen su material completo.</p> : (
            <ul className="adm-lista">
              {s.detalle_incompletos.map((d) => (
                <li key={d.id}><Link to={`/admin/desarrollos/${d.id}`}><b>{d.nombre}</b></Link>
                  <span className="adm-lista-sec">Falta: {d.falta.map((f) => FALTA[f] ?? f).join(", ")}</span></li>
              ))}
            </ul>
          )}
        </section>
        <section className="adm-panel" aria-labelledby="t-ult">
          <h2 id="t-ult" className="adm-subtitulo">Últimas modificaciones</h2>
          {s.ultimas_modificaciones.length === 0 ? <p className="adm-nota">Todavía no hay cambios registrados.</p> : (
            <ul className="adm-lista">
              {s.ultimas_modificaciones.map((h, i) => (
                <li key={i}>
                  <span>{ACCION[h.accion] ?? h.accion} {TABLA[h.tabla] ?? h.tabla}
                    {h.desarrollo_id ? <> de <Link to={`/admin/desarrollos/${h.desarrollo_id}`}>{h.desarrollo_id}</Link></> : null}</span>
                  <span className="adm-lista-sec">{fechaHora(h.fecha)} · {quien(h.usuario_email, h.rol)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
