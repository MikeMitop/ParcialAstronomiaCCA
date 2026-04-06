/**
 * Controlador de Análisis
 *
 * Maneja las peticiones HTTP y delega la lógica al servicio integrador.
 * Cada método corresponde a un endpoint de la API REST.
 */

const {
  analizarCuerpo,
  analizarTodos,
  buscarCuerpo,
  cargarDatos,
  obtenerDefinicionAutomata,
  obtenerEstadisticas,
} = require("../servicio/servicio");

/**
 * GET /api/analisis/:criterio
 * Analiza un asteroide por ID o nombre.
 */
function analizar(req, res) {
  try {
    const { criterio } = req.params;

    // 🔥 Validación robusta
    if (criterio == null || String(criterio).trim() === "") {
      return res.status(400).json({
        error: "Debe proporcionar un criterio de búsqueda (ID o nombre)",
      });
    }

    const resultado = analizarCuerpo(criterio);

    // 🔥 Siempre devolver resultado (aunque sea descartado)
    return res.json(resultado);

  } catch (err) {
    return res.status(500).json({
      error: "Error interno al analizar el cuerpo menor",
      detalle: err.message,
    });
  }
}

/**
 * GET /api/analisis
 * Analiza todos los asteroides de la base de datos.
 */
function analizarLote(req, res) {
  try {
    const resultado = analizarTodos();
    return res.json(resultado);
  } catch (err) {
    return res.status(500).json({
      error: "Error interno al analizar los asteroides",
      detalle: err.message,
    });
  }
}

/**
 * GET /api/asteroides
 * Retorna la lista completa de asteroides (sin análisis).
 */
function listarAsteroides(req, res) {
  try {
    const datos = cargarDatos();
    return res.json({
      total: datos.length,
      asteroides: datos,
    });
  } catch (err) {
    return res.status(500).json({
      error: "Error al cargar los datos de asteroides",
      detalle: err.message,
    });
  }
}

/**
 * GET /api/asteroides/:criterio
 * Busca un asteroide por ID o nombre (sin ejecutar el análisis).
 */
function obtenerAsteroide(req, res) {
  try {
    const { criterio } = req.params;

    if (criterio == null || String(criterio).trim() === "") {
      return res.status(400).json({
        error: "Debe proporcionar un criterio de búsqueda",
      });
    }

    const cuerpo = buscarCuerpo(criterio);

    if (!cuerpo) {
      return res.status(404).json({
        error: `No se encontró un asteroide con criterio "${criterio}"`,
      });
    }

    return res.json(cuerpo);

  } catch (err) {
    return res.status(500).json({
      error: "Error al buscar el asteroide",
      detalle: err.message,
    });
  }
}

/**
 * GET /api/automata/definicion
 * Retorna la definición formal del autómata (Q, Σ, δ, q0, F).
 */
function definicionAutomata(req, res) {
  try {
    const definicion = obtenerDefinicionAutomata();
    return res.json(definicion);
  } catch (err) {
    return res.status(500).json({
      error: "Error al obtener la definición del autómata",
      detalle: err.message,
    });
  }
}

/**
 * GET /api/estadisticas
 * Retorna datos procesados para visualización en gráficas.
 */
function estadisticas(req, res) {
  try {
    const datos = obtenerEstadisticas();
    return res.json(datos);
  } catch (err) {
    return res.status(500).json({
      error: "Error al generar estadísticas",
      detalle: err.message,
    });
  }
}

module.exports = {
  analizar,
  analizarLote,
  listarAsteroides,
  obtenerAsteroide,
  definicionAutomata,
  estadisticas,
};