/**
 * Rutas de Análisis
 *
 * Define los endpoints de la API REST y los conecta con el controlador.
 */

const { Router } = require("express");

// ── Servicios ───────────────────────────────────────────────────────────────
const {
  obtenerNEOHoy,
  obtenerNEORango,
  fusionarDatos,
  detectarAnomalias,
  compararConHistorico,
  persistirEnDatosJson,
  cache,
} = require("../servicio/nasaApi");
const { cargarDatos } = require("../servicio/servicio");

// ── Controlador ─────────────────────────────────────────────────────────────
const {
  analizar,
  analizarLote,
  listarAsteroides,
  obtenerAsteroide,
  definicionAutomata,
  estadisticas,
} = require("../controlador/analisisControlador");

const router = Router();

// ── Asteroides ──────────────────────────────────────────────────────────────

router.get("/asteroides", listarAsteroides);
router.get("/asteroides/:criterio", obtenerAsteroide);

// ── Análisis ────────────────────────────────────────────────────────────────

router.get("/analisis", analizarLote);
router.get("/analisis/:criterio", analizar);

// ── Autómata ────────────────────────────────────────────────────────────────

router.get("/automata/definicion", definicionAutomata);

// ── Estadísticas / Gráficas ─────────────────────────────────────────────────

router.get("/estadisticas", estadisticas);

// ════════════════════════════════════════════════════════════════════════════
// 🌍 Tiempo Real (NASA API) — Rate-limited, Cached
// ════════════════════════════════════════════════════════════════════════════

/**
 * GET /api/tiempo-real
 * NEOs de hoy (con cache + dedup)
 */
router.get("/tiempo-real", async (req, res) => {
  try {
    const result = await obtenerNEOHoy();

    if (!result.asteroides || result.asteroides.length === 0) {
      return res.status(204).json({
        mensaje: "No hay datos disponibles en este momento",
      });
    }

    return res.json(result);
  } catch (err) {
    console.error("Error NASA API:", err.message);
    return res.status(500).json({
      error: "Error al obtener datos en tiempo real",
      detalle: err.message,
    });
  }
});

/**
 * GET /api/tiempo-real/rango?inicio=YYYY-MM-DD&fin=YYYY-MM-DD
 * NEOs en un rango de fechas (multi-week, cached)
 */
router.get("/tiempo-real/rango", async (req, res) => {
  try {
    const { inicio, fin } = req.query;

    if (!inicio || !fin) {
      return res.status(400).json({
        error: "Parámetros 'inicio' y 'fin' requeridos (YYYY-MM-DD)",
      });
    }

    // Validar que el rango no sea > 30 días (seguridad)
    const startDate = new Date(inicio);
    const endDate = new Date(fin);
    const diffDays = (endDate - startDate) / (1000 * 60 * 60 * 24);

    if (diffDays < 0) {
      return res.status(400).json({ error: "La fecha inicio debe ser anterior a fin" });
    }
    if (diffDays > 30) {
      return res.status(400).json({
        error: "Rango máximo permitido: 30 días",
        sugerencia: "Usa rangos más cortos para evitar saturar la API",
      });
    }

    const result = await obtenerNEORango(inicio, fin);
    return res.json(result);
  } catch (err) {
    console.error("Error NASA rango:", err.message);
    return res.status(500).json({
      error: "Error al obtener datos por rango",
      detalle: err.message,
    });
  }
});

/**
 * GET /api/tiempo-real/fusion
 * Fusiona datos locales + NASA (hoy) con cálculos avanzados
 */
router.get("/tiempo-real/fusion", async (req, res) => {
  try {
    const datosLocales = cargarDatos();
    const resultNASA = await obtenerNEOHoy();
    const datosNASA = resultNASA.asteroides;

    const fusionados = fusionarDatos(datosLocales, datosNASA);

    return res.json({
      total: fusionados.length,
      locales: datosLocales.length,
      nasa: datosNASA.length,
      fusionados,
      fuente: resultNASA.fuente,
    });
  } catch (err) {
    console.error("Error fusión:", err.message);
    return res.status(500).json({
      error: "Error al fusionar datos",
      detalle: err.message,
    });
  }
});

/**
 * GET /api/tiempo-real/anomalias
 * Detecta outliers y asteroides peligrosos en datos de hoy vs histórico
 */
router.get("/tiempo-real/anomalias", async (req, res) => {
  try {
    const datosLocales = cargarDatos();
    const resultNASA = await obtenerNEOHoy();
    const datosNASA = resultNASA.asteroides;

    const anomalias = detectarAnomalias(datosNASA, datosLocales);

    return res.json({
      ...anomalias,
      fuente: resultNASA.fuente,
      fecha: resultNASA.fecha,
    });
  } catch (err) {
    console.error("Error anomalías:", err.message);
    return res.status(500).json({
      error: "Error al detectar anomalías",
      detalle: err.message,
    });
  }
});

/**
 * GET /api/tiempo-real/comparacion
 * Compara estadísticas de hoy vs dataset histórico local
 */
router.get("/tiempo-real/comparacion", async (req, res) => {
  try {
    const datosLocales = cargarDatos();
    const resultNASA = await obtenerNEOHoy();
    const datosNASA = resultNASA.asteroides;

    const comparacion = compararConHistorico(datosNASA, datosLocales);

    return res.json({
      ...comparacion,
      fuente: resultNASA.fuente,
      fecha: resultNASA.fecha,
    });
  } catch (err) {
    console.error("Error comparación:", err.message);
    return res.status(500).json({
      error: "Error al comparar datos",
      detalle: err.message,
    });
  }
});


/**
 * GET /api/tiempo-real/cache
 * Info del estado del cache (para debugging/monitoreo)
 */
router.get("/tiempo-real/cache", (req, res) => {
  return res.json(cache.getStats());
});

/**
 * POST /api/tiempo-real/persistir
 * Fuerza la persistencia de datos del cache de la NASA a datos.json
 */
router.post("/tiempo-real/persistir", async (req, res) => {
  try {
    // Si queremos persistir forzosamente todo lo que hay en cache
    // El cache puede tener keys de días/rangos, habría que extraer la data
    // Una forma simple es obtener lo de hoy y persistirlo
    const result = await obtenerNEOHoy();
    persistirEnDatosJson(result.asteroides);
    
    return res.json({
      mensaje: "Datos persistidos correctamente",
      total: result.asteroides.length
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});


// ── Export ──────────────────────────────────────────────────────────────────

module.exports = router;