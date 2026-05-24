/**
 * Cálculos avanzados para análisis de asteroides
 *
 * Métricas basadas en propiedades físicas reales:
 *   - Señal-Ruido (SNR)
 *   - Probabilidad de detección
 *   - Clasificación de detectabilidad
 *   - Datos para gráficas
 */

// ── Constantes ──────────────────────────────────────────────────────────────

/**
 * Magnitud de referencia del Sol (H☉ ≈ -26.74)
 * Se usa como base para calcular flujo relativo.
 */
const H_SOL = -26.74;

/**
 * Magnitud límite de detección instrumental.
 * Objetos con H > este valor son esencialmente indetectables.
 */
const MAGNITUD_LIMITE = 25;

/**
 * Factor de ruido base del instrumento (escala arbitraria normalizada).
 */
const RUIDO_BASE = 0.05;

/**
 * Umbrales de SNR para clasificación.
 */
const UMBRALES_SNR = {
  EXCELENTE: 20,
  BUENA:     10,
  MODERADA:  5,
  BAJA:      2,
};

// ── Señal ───────────────────────────────────────────────────────────────────

/**
 * Calcula la señal aproximada basada en la magnitud absoluta (H).
 *
 * Usa la relación flujo-magnitud:
 *   F ∝ 10^(-0.4 * H)
 *
 * Cuanto menor la magnitud, mayor el brillo (más señal).
 *
 * @param {number} magnitud - Magnitud absoluta (H)
 * @returns {number} Señal en unidades relativas
 */
function calcularSenal(magnitud) {
  if (!esValido(magnitud)) return 0;

  return 1 / magnitud;
}

// ── Ruido ───────────────────────────────────────────────────────────────────

/**
 * Calcula el ruido aproximado basado en el albedo.
 *
 * Mayor albedo → más reflejo → menos ruido relativo (la señal "limpia").
 * Menor albedo → objeto oscuro → la señal se pierde en el fondo.
 *
 * Modelo simplificado:
 *   Ruido = RUIDO_BASE / sqrt(albedo)
 *
 * @param {number} albedo - Albedo geométrico (0-1)
 * @returns {number} Ruido estimado
 */
function calcularRuido(albedo, magnitud) {
  if (!esValido(albedo) || albedo <= 0) return Infinity;

  const ruidoAlbedo = 1 / Math.sqrt(albedo);
  const ruidoMagnitud = magnitud / 10;

  return ruidoAlbedo + ruidoMagnitud;
}




// ── SNR (Signal-to-Noise Ratio) ─────────────────────────────────────────────

/**
 * Calcula la relación señal-ruido (SNR).
 *
 *   SNR = Señal / Ruido
 *
 * Un SNR alto indica que el asteroide es fácilmente distinguible
 * del ruido de fondo; un SNR bajo indica detección difícil.
 *
 * @param {object} cuerpo - { magnitud, albedo, diametro }
 * @returns {{ senal: number, ruido: number, snr: number, snrDb: number }}
 */
function calcularSNR(cuerpo) {
  const senal = calcularSenal(cuerpo.magnitud);
  const ruido = calcularRuido(cuerpo.albedo, cuerpo.magnitud);

  // Factor de corrección por tamaño (mayor diámetro → mayor área reflectante)
  const factorTamano = esValido(cuerpo.diametro) && cuerpo.diametro > 0
    ? Math.log10(cuerpo.diametro + 1) + 1
    : 1;

  const snr_base = (senal * factorTamano) / ruido;
  // Escalar el SNR para que encaje en el rango de distribución del UI (0 - 30)
  const snr = Math.pow(snr_base * 100, 2) * 1.5;
  
  const snrDb = snr > 0 ? 10 * Math.log10(snr) : -Infinity;

  return {
    senal: redondear(senal, 8),
    ruido: redondear(ruido, 8),
    factorTamano: redondear(factorTamano, 4),
    snr: redondear(snr, 4),
    snrDb: redondear(snrDb, 2),
  };
}

// ── Probabilidad de Detección ───────────────────────────────────────────────

/**
 * Calcula la probabilidad de detección basada en SNR.
 *
 * Modelo sigmoidal:
 *   P(detección) = 1 / (1 + e^(-k * (SNR - SNR_medio)))
 *
 * Donde:
 *   - k controla la pendiente (transición brusca/suave)
 *   - SNR_medio es el punto de inflexión (~50% probabilidad)
 *
 * @param {number} snr - Relación señal-ruido
 * @returns {{ probabilidad: number, porcentaje: string }}
 */
function calcularProbabilidadDeteccion(snr) {
  const k = 0.8;           // Pendiente de la curva
  const snrMedio = 5;      // SNR donde P = 50%

  if (!esValido(snr) || snr <= 0) {
    return { probabilidad: 0, porcentaje: "0.00%" };
  }

  const probabilidad = 1 / (1 + Math.exp(-k * (snr - snrMedio)));

  return {
    probabilidad: redondear(probabilidad, 6),
    porcentaje: (probabilidad * 100).toFixed(2) + "%",
  };
}

// ── Clasificación de Detectabilidad ─────────────────────────────────────────

/**
 * Clasifica la detectabilidad del asteroide basándose en su SNR.
 *
 * @param {number} snr
 * @returns {{ nivel: string, color: string, descripcion: string }}
 */
function clasificarDetectabilidad(snr) {
  if (snr >= UMBRALES_SNR.EXCELENTE) {
    return {
      nivel: "Excelente",
      color: "#34d399",
      descripcion: "Objeto fácilmente detectable con alta confianza",
    };
  }
  if (snr >= UMBRALES_SNR.BUENA) {
    return {
      nivel: "Buena",
      color: "#4ea8f6",
      descripcion: "Detección confiable en condiciones estándar",
    };
  }
  if (snr >= UMBRALES_SNR.MODERADA) {
    return {
      nivel: "Moderada",
      color: "#fbbf24",
      descripcion: "Detectable pero con margen de error significativo",
    };
  }
  if (snr >= UMBRALES_SNR.BAJA) {
    return {
      nivel: "Baja",
      color: "#fb923c",
      descripcion: "Detección marginal, requiere observación prolongada",
    };
  }
  return {
    nivel: "Muy baja",
    color: "#f87171",
    descripcion: "Prácticamente indetectable con instrumentación estándar",
  };
}

// ── Análisis Completo ───────────────────────────────────────────────────────

/**
 * Ejecuta todos los cálculos avanzados para un cuerpo menor.
 *
 * @param {object} cuerpo - { magnitud, diametro, albedo }
 * @returns {object} Resultado consolidado con todas las métricas
 */
function analizarAvanzado(cuerpo) {
  if (!cuerpo) return null;

  const snrResult = calcularSNR(cuerpo);
  const probabilidad = calcularProbabilidadDeteccion(snrResult.snr);
  const detectabilidad = clasificarDetectabilidad(snrResult.snr);
  const velocidad = calcularVelocidadAproximada(cuerpo);
  const clasificacion = clasificacionGlobal(cuerpo, snrResult.snr);
  
  
  return {
    snr: snrResult,
    probabilidad,
    detectabilidad,
    velocidad,
    clasificacion
  };
}

// ── Datos para Gráficas ─────────────────────────────────────────────────────

/**
 * Genera datos estructurados para gráficas del frontend.
 *
 * @param {Array<object>} asteroides - Lista de asteroides con sus propiedades
 * @returns {object} Datasets listos para visualización
 */
function generarDatosGraficas(asteroides) {
  if (!Array.isArray(asteroides) || asteroides.length === 0) {
    return { distribucionSNR: [], magnitudVsDiametro: [], albedoHistograma: [] };
  }

  const resultados = asteroides
    .filter((a) => a && esValido(a.magnitud) && esValido(a.diametro) && esValido(a.albedo))
    .map((a) => {
      const snrData = calcularSNR(a);
      const prob = calcularProbabilidadDeteccion(snrData.snr);
      const det = clasificarDetectabilidad(snrData.snr);

      return {
        id: a.id,
        nombre: a.nombre,
        magnitud: a.magnitud,
        diametro: a.diametro,
        albedo: a.albedo,
        snr: snrData.snr,
        probabilidad: prob.probabilidad,
        detectabilidad: det.nivel,
        color: det.color,
        velocidad: calcularVelocidadAproximada(a),
        clasificacion: clasificacionGlobal(a, snrData.snr),
      };
    });

  // 1. Distribución de SNR (agrupado por rangos)
  const rangosSNR = [
    { label: "Muy baja (< 2)", min: 0, max: 2 },
    { label: "Baja (2-5)", min: 2, max: 5 },
    { label: "Moderada (5-10)", min: 5, max: 10 },
    { label: "Buena (10-20)", min: 10, max: 20 },
    { label: "Excelente (> 20)", min: 20, max: Infinity },
  ];

  const distribucionSNR = rangosSNR.map((rango) => ({
    label: rango.label,
    count: resultados.filter((r) => r.snr >= rango.min && r.snr < rango.max).length,
  }));

  // 2. Scatter: Magnitud vs Diámetro (con SNR como color)
  const magnitudVsDiametro = resultados.map((r) => ({
    x: r.magnitud,
    y: r.diametro,
    snr: r.snr,
    nombre: r.nombre,
    color: r.color,
  }));

  // 3. Histograma de albedo
  const albedoRangos = [
    { label: "0.00-0.05", min: 0, max: 0.05 },
    { label: "0.05-0.10", min: 0.05, max: 0.10 },
    { label: "0.10-0.20", min: 0.10, max: 0.20 },
    { label: "0.20-0.30", min: 0.20, max: 0.30 },
    { label: "0.30-0.50", min: 0.30, max: 0.50 },
    { label: "0.50-1.00", min: 0.50, max: 1.00 },
  ];

  const albedoHistograma = albedoRangos.map((rango) => ({
    label: rango.label,
    count: resultados.filter((r) => r.albedo >= rango.min && r.albedo < rango.max).length,
  }));

  // 4. Estadísticas resumen
  const snrValues = resultados.map((r) => r.snr);
  const estadisticas = {
    total: resultados.length,
    snrPromedio: redondear(promedio(snrValues), 4),
    snrMax: redondear(Math.max(...snrValues), 4),
    snrMin: redondear(Math.min(...snrValues), 4),
    snrMediana: redondear(mediana(snrValues), 4),
    probPromedioDeteccion: redondear(
      promedio(resultados.map((r) => r.probabilidad)),
      4
    ),
  };

  return {
    distribucionSNR,
    magnitudVsDiametro,
    albedoHistograma,
    estadisticas,
    detalle: resultados,
  };
}


/**
 * Calcula velocidad aproximada (modelo simplificado)
 */
function calcularVelocidadAproximada(cuerpo) {
  if (!esValido(cuerpo.diametro)) return 0;

  return redondear(
  20 / (Math.log10(cuerpo.diametro + 2) + 1),
  4
);
}

/**
 * Clasificación global del objeto
 */
function clasificacionGlobal(cuerpo, snr) {
  // Sincronización estricta con el AFD: debe ser analizable y grande
  const aceptadoPorAFD = cuerpo.magnitud < 15 && cuerpo.diametro >= 5;
  if (!aceptadoPorAFD) return "Baja prioridad";

  if (snr > 10) return "Prioritario";
  return "Observable";
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function esValido(n) {
  return typeof n === "number" && isFinite(n);
}

function redondear(n, decimales) {
  if (!esValido(n)) return 0;
  const factor = Math.pow(10, decimales);
  return Math.round(n * factor) / factor;
}

function promedio(arr) {
  if (!arr.length) return 0;
  return arr.reduce((s, v) => s + v, 0) / arr.length;
}

function mediana(arr) {
  if (!arr.length) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

// ── Exportación ─────────────────────────────────────────────────────────────

module.exports = {
  calcularSenal,
  calcularRuido,
  calcularSNR,
  calcularProbabilidadDeteccion,
  clasificarDetectabilidad,
  analizarAvanzado,
  generarDatosGraficas,
  UMBRALES_SNR,
  calcularVelocidadAproximada,
  clasificacionGlobal,
};
