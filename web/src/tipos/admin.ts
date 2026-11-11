/**
 * Tipos reservados para el futuro panel de administración (fase 4 en adelante).
 * Solo definiciones: no hay inicio de sesión, permisos ni formularios implementados.
 */

export type Rol = "administrador";

export type EstadoPublicacion = "publicado" | "borrador";

/** Números del dashboard. Se calculan con utilidades/estadisticas.ts a partir de los datos reales. */
export interface Estadisticas {
  readonly desarrollos: number;
  readonly publicados: number;
  readonly borradores: number;
  readonly unidades: number;
  readonly fotos: number;
  readonly renders: number;
  readonly planos: number;
  readonly paginasBrochure: number;
  readonly desarrollosConBrochure: number;
  readonly portadas: number;
}

/** Un registro del historial de cambios (para "historial" y "recuperar lo borrado"). */
export interface CambioRegistrado {
  readonly id: string;
  readonly fecha: string;
  readonly usuario: string;
  readonly accion: "crear" | "editar" | "publicar" | "ocultar" | "eliminar" | "restaurar";
  readonly desarrolloId: string;
  readonly antes: unknown;
  readonly despues: unknown;
}
