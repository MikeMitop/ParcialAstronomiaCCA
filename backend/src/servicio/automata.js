/**
 * Autómata Finito Determinista (AFD)
 */

// --- Estados ---
const ESTADOS = {
  INICIO:      "Inicio",
  CONSULTADO:  "Consultado",
  VERIFICADOS: "Verificados",
  ANALISIS:    "Analisis",
  CLASIFICADO: "Clasificado",
  DESCARTADO:  "Descartado",
};

// --- Alfabeto ---
const ALFABETO = new Set(["d", "v", "a", "c", "r"]);

// --- Estado inicial ---
const ESTADO_INICIAL = ESTADOS.INICIO;

// --- Estados de aceptación ---
const ESTADOS_ACEPTACION = new Set([ESTADOS.CLASIFICADO]);

// --- Transiciones ---
const TRANSICIONES = {
  [ESTADOS.INICIO]: {
    d: ESTADOS.CONSULTADO,
    r: ESTADOS.DESCARTADO,
  },
  [ESTADOS.CONSULTADO]: {
    v: ESTADOS.VERIFICADOS,
    r: ESTADOS.DESCARTADO,
  },
  [ESTADOS.VERIFICADOS]: {
    a: ESTADOS.ANALISIS,
    r: ESTADOS.DESCARTADO,
  },
  [ESTADOS.ANALISIS]: {
    c: ESTADOS.CLASIFICADO,
    r: ESTADOS.DESCARTADO,
  },
};

// --- Procesamiento ---
function procesar(eventos) {
  if (!Array.isArray(eventos) || eventos.length === 0) {
    return {
      estadoFinal: ESTADO_INICIAL,
      aceptado: false,
      historial: [],
      definicion: obtenerDefinicion(),
      error: "No se proporcionaron eventos",
    };
  }

  let estadoActual = ESTADO_INICIAL;
  const historial = [];

  for (const evento of eventos) {

    if (!ALFABETO.has(evento)) {
      return {
        estadoFinal: estadoActual,
        aceptado: false,
        historial,
        definicion: obtenerDefinicion(),
        error: `Evento "${evento}" no pertenece a Σ`,
      };
    }

    const transiciones = TRANSICIONES[estadoActual];

    if (!transiciones || !(evento in transiciones)) {
      return {
        estadoFinal: estadoActual,
        aceptado: ESTADOS_ACEPTACION.has(estadoActual),
        historial,
        definicion: obtenerDefinicion(),
        error: `No existe δ(${estadoActual}, ${evento})`,
      };
    }

    const siguiente = transiciones[evento];

    historial.push({
      desde: estadoActual,
      evento,
      hacia: siguiente,
    });

    estadoActual = siguiente;
  }

  return {
    estadoFinal: estadoActual,
    aceptado: ESTADOS_ACEPTACION.has(estadoActual),
    historial,
    definicion: obtenerDefinicion(),
  };
}

// --- Definición ---
function obtenerDefinicion() {
  return {
    estados: Object.values(ESTADOS),
    alfabeto: [...ALFABETO],
    estadoInicial: ESTADO_INICIAL,
    estadosAceptacion: [...ESTADOS_ACEPTACION],
    transiciones: TRANSICIONES,
  };
}

module.exports = { procesar, obtenerDefinicion, ESTADOS };