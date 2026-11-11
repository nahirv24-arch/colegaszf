/**
 * Gráficos del panel, sin librerías externas (son pocos datos y pocas categorías).
 * Paleta derivada de la marca y validada para daltonismo con el validador de dataviz
 * (azul, ámbar, violeta: todos los controles OK). El ámbar tiene bajo contraste contra blanco,
 * por eso TODOS los gráficos muestran etiquetas y números visibles (nunca solo color).
 * El rojo de marca queda reservado para "atención" (no se usa como serie).
 */
import { useId, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router";

export const COLOR = { azul: "#2F78A8", ambar: "#D08A1F", violeta: "#8A6FC0", gris: "#A7AFB6" } as const;

const fmt = (n: number) => n.toLocaleString("es-AR");
/** Porcentaje redondeado; si hay algo pero no llega al 1 %, dice "< 1 %" (nunca "0 %" para algo que existe). */
const pct = (v: number, t: number) => {
  if (!t || !v) return "0 %";
  const p = (v / t) * 100;
  return p < 1 ? "< 1 %" : p > 99 && v < t ? "> 99 %" : `${Math.round(p)} %`;
};

interface EstadoTip { x: number; y: number; texto: ReactNode }

/** Tooltip que sigue al mouse o al elemento enfocado con el teclado. */
function useTooltip() {
  const caja = useRef<HTMLDivElement>(null);
  const [tip, setTip] = useState<EstadoTip | null>(null);
  const mostrar = (el: Element, texto: ReactNode, ev?: { clientX: number; clientY: number }) => {
    const c = caja.current?.getBoundingClientRect();
    if (!c) return;
    const r = el.getBoundingClientRect();
    const x = (ev ? ev.clientX : r.left + r.width / 2) - c.left;
    const y = (ev ? ev.clientY : r.top) - c.top;
    setTip({ x: Math.min(Math.max(x, 70), c.width - 70), y, texto });
  };
  const nodo = tip ? <div className="adm-tip" role="tooltip" style={{ left: tip.x, top: tip.y }}>{tip.texto}</div> : null;
  return { caja, nodo, mostrar, ocultar: () => setTip(null) };
}

export interface Segmento { etiqueta: string; valor: number; color: string }

/** Barra 100 % segmentada (partes de un total) + leyenda con números. */
export function BarraSegmentada({ segmentos, unidad, vacio }: {
  readonly segmentos: readonly Segmento[]; readonly unidad: string; readonly vacio?: string;
}) {
  const total = segmentos.reduce((t, s) => t + s.valor, 0);
  const { caja, nodo, mostrar, ocultar } = useTooltip();
  if (!total) return <p className="adm-graf-vacio">{vacio ?? "Sin datos suficientes"}</p>;
  const visibles = segmentos.filter((s) => s.valor > 0);
  return (
    <div className="adm-graf" ref={caja} onMouseLeave={ocultar}>
      <div className="adm-seg" role="img" aria-label={segmentos.map((s) => `${s.etiqueta}: ${s.valor} ${unidad}`).join(", ")}>
        {visibles.map((s) => (
          <span key={s.etiqueta} className="adm-seg-parte" tabIndex={0}
                style={{ flexGrow: s.valor, background: s.color, minWidth: 6 }}
                aria-label={`${s.etiqueta}: ${fmt(s.valor)} ${unidad} (${pct(s.valor, total)})`}
                onMouseMove={(e) => mostrar(e.currentTarget, <><b>{s.etiqueta}</b><br />{fmt(s.valor)} {unidad} · {pct(s.valor, total)}</>, e)}
                onFocus={(e) => mostrar(e.currentTarget, <><b>{s.etiqueta}</b><br />{fmt(s.valor)} {unidad} · {pct(s.valor, total)}</>)}
                onBlur={ocultar} />
        ))}
      </div>
      <ul className="adm-leyenda">
        {segmentos.map((s) => (
          <li key={s.etiqueta} className={s.valor ? undefined : "cero"}>
            <i style={{ background: s.color }} aria-hidden="true" />{s.etiqueta} <b>{fmt(s.valor)}</b>
            <span>{pct(s.valor, total)}</span>
          </li>
        ))}
      </ul>
      {nodo}
    </div>
  );
}

export interface Barra { etiqueta: string; valor: number; a?: string; detalle?: string }

/** Barras horizontales de una sola serie (magnitud por categoría). */
export function BarrasHorizontales({ barras, unidad, color = COLOR.azul, vacio }: {
  readonly barras: readonly Barra[]; readonly unidad: string; readonly color?: string; readonly vacio?: string;
}) {
  const max = Math.max(0, ...barras.map((b) => b.valor));
  const { caja, nodo, mostrar, ocultar } = useTooltip();
  if (!barras.length || !max) return <p className="adm-graf-vacio">{vacio ?? "Sin datos suficientes"}</p>;
  return (
    <div className="adm-graf" ref={caja} onMouseLeave={ocultar}>
      <ul className="adm-barras">
        {barras.map((b) => {
          const texto = <><b>{b.etiqueta}</b><br />{fmt(b.valor)} {unidad}{b.detalle ? <><br />{b.detalle}</> : null}</>;
          const etiqueta = b.a ? <Link to={b.a}>{b.etiqueta}</Link> : <span>{b.etiqueta}</span>;
          return (
            <li key={b.etiqueta}>
              {etiqueta}
              <span className="adm-barra-pista" tabIndex={0} aria-label={`${b.etiqueta}: ${fmt(b.valor)} ${unidad}`}
                    onMouseMove={(e) => mostrar(e.currentTarget, texto, e)} onFocus={(e) => mostrar(e.currentTarget, texto)} onBlur={ocultar}>
                <span className="adm-barra" style={{ width: `${(b.valor / max) * 100}%`, background: color }} />
              </span>
              <b className="adm-barra-num">{fmt(b.valor)}</b>
            </li>
          );
        })}
      </ul>
      {nodo}
    </div>
  );
}

/** Columnas por día (actividad). Solo se dibuja con suficientes días; si no, lo explica. */
export function ColumnasPorDia({ datos, minimoDias = 7, unidad }: {
  readonly datos: readonly { dia: string; n: number }[]; readonly minimoDias?: number; readonly unidad: string;
}) {
  const id = useId();
  const { caja, nodo, mostrar, ocultar } = useTooltip();
  if (datos.length < minimoDias) {
    return (
      <p className="adm-graf-vacio">
        <b>Sin datos suficientes</b><br />
        Hay {datos.length} {datos.length === 1 ? "día" : "días"} con actividad registrada. El gráfico aparece
        cuando haya al menos {minimoDias}, para no sacar conclusiones de un solo día.
      </p>
    );
  }
  const max = Math.max(...datos.map((d) => d.n));
  const fecha = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString("es-AR", { day: "numeric", month: "short" });
  return (
    <div className="adm-graf" ref={caja} onMouseLeave={ocultar}>
      <div className="adm-columnas-dia" role="img" aria-labelledby={id}>
        {datos.map((d) => (
          <span key={d.dia} className="adm-col-dia" tabIndex={0} aria-label={`${fecha(d.dia)}: ${d.n} ${unidad}`}
                onMouseMove={(e) => mostrar(e.currentTarget, <><b>{fecha(d.dia)}</b><br />{fmt(d.n)} {unidad}</>, e)}
                onFocus={(e) => mostrar(e.currentTarget, <><b>{fecha(d.dia)}</b><br />{fmt(d.n)} {unidad}</>)} onBlur={ocultar}>
            <span style={{ height: `${Math.max(4, (d.n / max) * 100)}%`, background: COLOR.azul }} />
          </span>
        ))}
      </div>
      <div className="adm-ejes" id={id}><span>{fecha(datos[0]!.dia)}</span><span>{fecha(datos[datos.length - 1]!.dia)}</span></div>
      {nodo}
    </div>
  );
}
