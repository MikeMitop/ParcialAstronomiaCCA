/**
 * Servicio Integrador
 *
 * Flujo:
 *   JSON → CuerpoMenor → Analizador → Autómata → Resultado
 */

const path = require("path");
const fs = require("fs");

const { analizar } = require("./analizador");
const { procesar, obtenerDefinicion } = require("./automata");
const CuerpoMenor = require("../modelo/CuerpoMenor");
const { generarDatosGraficas, analizarAvanzado } = require("./calculosAvanzados");

// ── Carga de datos ──────────────────────────────────────────────────────────

const RUTA_DATOS = path.join(__dirname, "..", "database", "datos.json");

/**
 * Lee y parsea el JSON
 */
function cargarDatos() {
  const contenido = fs.readFileSync(RUTA_DATOS, "utf-8");
  const datos = JSON.parse(contenido);
  return Array.isArray(datos) ? datos : datos.asteroides ?? [];
}

// 🔥 Cache en memoria (invalidable)
let ASTEROIDES = cargarDatos();

/**
 * Recarga los datos desde disco (se llama después de persistir datos NASA)
 */
function recargarDatos() {
  ASTEROIDES = cargarDatos();
  graficasLoaded = false;
  console.log(`[Servicio] Datos recargados: ${ASTEROIDES.length} asteroides`);
}

let graficasLoaded = false;

// ── Búsqueda ────────────────────────────────────────────────────────────────

function buscarCuerpo(criterio) {
  if (criterio == null || String(criterio).trim() === "") return null;

  const texto = String(criterio).trim().toLowerCase();

  return (
    ASTEROIDES.find((a) => {
      if (String(a.id).toLowerCase() === texto) return true;
      if (a.nombre && a.nombre.toLowerCase() === texto) return true;
      return false;
    }) ?? null
  );
}

// ── Flujo principal ─────────────────────────────────────────────────────────

function analizarCuerpo(criterio) {
  const cuerpoPlano = buscarCuerpo(criterio);
  const cuerpo = CuerpoMenor.desde(cuerpoPlano);

  // 🔥 Caso no encontrado o inválido
  if (!cuerpoPlano || !cuerpo) {
    return {
      cuerpo: null,
      analisis: {
        eventos: ["r"],
        detalle: { motivoRechazo: "Objeto no encontrado o inválido" },
      },
      automata: {
        estadoFinal: "Descartado",
        aceptado: false,
        historial: [],
        definicion: obtenerDefinicion(),
      },
      resumen: "El objeto no fue encontrado o tiene datos inválidos.",
    };
  }

  // 1. Analizador
  const resultadoAnalisis = analizar(cuerpo);

  // 2. Autómata
  const resultadoAutomata = procesar(resultadoAnalisis.eventos);

  // 3. Resumen
  const resumen = generarResumen(
    cuerpo,
    resultadoAnalisis,
    resultadoAutomata
  );

  return {
    cuerpo: cuerpo.toJSON(),
    analisis: resultadoAnalisis,
    automata: resultadoAutomata,
    resumen,
  };
}

// ── Análisis por lote ───────────────────────────────────────────────────────

function analizarTodos() {
  const resultados = ASTEROIDES.map((a) => {
    const cuerpo = CuerpoMenor.desde(a);
    if (!cuerpo) return null;

    const resultadoAnalisis = analizar(cuerpo);
    const resultadoAutomata = procesar(resultadoAnalisis.eventos);

    return {
      id: cuerpo.id,
      nombre: cuerpo.nombre,
      eventos: resultadoAnalisis.eventos,
      estadoFinal: resultadoAutomata.estadoFinal,
      aceptado: resultadoAutomata.aceptado,
      motivoRechazo:
        resultadoAnalisis?.detalle?.motivoRechazo ?? null,
    };
  }).filter(Boolean);

  const clasificados = resultados.filter((r) => r.aceptado).length;

  return {
    total: resultados.length,
    clasificados,
    descartados: resultados.length - clasificados,
    resultados,
  };
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function generarResumen(cuerpo, analisis, automata) {
  if (!cuerpo) {
    return "El objeto no fue encontrado en la base de datos.";
  }

  const nombre = cuerpo.nombre || `ID ${cuerpo.id}`;
  const eventos = analisis.eventos.join(" → ");
  const estado = automata.estadoFinal;
  const motivo = analisis?.detalle?.motivoRechazo ?? "Sin detalle";

  if (automata.aceptado) {
    return (
      ` "${nombre}" fue clasificado exitosamente.\n` +
      `   Secuencia: [${eventos}] → Estado final: ${estado}`
    );
  }

  return (
    ` "${nombre}" fue descartado.\n` +
    `   Secuencia: [${eventos}] → Estado final: ${estado}\n` +
    `   Motivo: ${motivo}`
  );
}

// ── Estadísticas para gráficas ──────────────────────────────────────────────

function obtenerEstadisticas() {
  return generarDatosGraficas(ASTEROIDES);
}

function obtenerAnalisisAvanzado(criterio) {
  const cuerpoPlano = buscarCuerpo(criterio);
  if (!cuerpoPlano) return null;
  return analizarAvanzado(cuerpoPlano);
}

// ── Exportación ─────────────────────────────────────────────────────────────

module.exports = {
  cargarDatos,
  buscarCuerpo,
  analizarCuerpo,
  analizarTodos,
  obtenerDefinicionAutomata: obtenerDefinicion,
  obtenerEstadisticas,
  obtenerAnalisisAvanzado,
  recargarDatos,
};