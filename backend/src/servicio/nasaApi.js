/**
 * NASA NeoWs API Service — Rate-Limited, Cached, Scalable
 *
 * Arquitectura:
 *   Frontend → Backend (este servicio) → NASA API
 *   ⚠️ NUNCA se llama directo desde el frontend
 *
 * Rate Limiting:
 *   - TTL cache de 10 segundos mínimo entre requests
 *   - Deduplicación: 10 usuarios simultáneos = 1 sola llamada a NASA
 *   - Detección de 429 (Too Many Requests) con fallback a cache
 *
 * Cache:
 *   - In-memory Map (migrable a Redis)
 *   - TTL configurable por clave
 *   - Formato: { data, timestamp, ttl }
 *
 * Multi-week fetch:
 *   - NASA NeoWs solo permite rangos de 7 días
 *   - Para rangos mayores, se hace loop de peticiones secuenciales
 *   - Delay entre requests para no saturar la API
 */

const fs = require("fs");
const path = require("path");

const API_KEY = process.env.NASA_API_KEY || "DEMO_KEY";
const NASA_BASE = "https://api.nasa.gov/neo/rest/v1/feed";

// ═══════════════════════════════════════════════════════════
// Cache System — Persistente a disco (nasa_cache.json)
// ═══════════════════════════════════════════════════════════

const DEFAULT_TTL = 10_000;            // 10 segundos (in-memory rápido)
const TTL_HOY = 60 * 60 * 1000;        // 1 hora (datos de hoy, cambian en el día)
const PERSIST_TTL = Number.MAX_SAFE_INTEGER; // Cache permanente (nunca expira, para el pasado)
const DELAY_BETWEEN_REQUESTS = 1500;   // 1.5s entre requests a NASA

const CACHE_FILE = path.join(__dirname, "..", "database", "nasa_cache.json");

class PersistentCache {
  constructor(filePath) {
    this._filePath = filePath;
    this._store = new Map();
    this._pendingRequests = new Map();
    this._loadFromDisk();
  }

  // ── Lectura desde disco ─────────────────────────────────

  _loadFromDisk() {
    try {
      if (!fs.existsSync(this._filePath)) {
        this._saveToDisk();
        return;
      }

      const raw = fs.readFileSync(this._filePath, "utf-8").trim();
      if (!raw || raw === "") {
        this._saveToDisk();
        return;
      }

      const parsed = JSON.parse(raw);

      // parsed es { entries: { key: { data, timestamp, ttl } } }
      if (parsed && parsed.entries) {
        const now = Date.now();
        let loaded = 0;
        let expired = 0;

        for (const [key, entry] of Object.entries(parsed.entries)) {
          const age = now - entry.timestamp;
          if (age <= entry.ttl) {
            this._store.set(key, entry);
            loaded++;
          } else {
            expired++;
          }
        }

        console.log(`[Cache] Cargados ${loaded} registros desde disco (${expired} expirados descartados)`);
      }
    } catch (err) {
      console.warn("[Cache] Error al leer cache de disco:", err.message);
      this._store.clear();
    }
  }

  // ── Escritura a disco ───────────────────────────────────

  _saveToDisk() {
    try {
      const obj = { entries: {} };

      for (const [key, entry] of this._store) {
        obj.entries[key] = entry;
      }

      obj.meta = {
        lastSaved: new Date().toISOString(),
        totalEntries: this._store.size,
      };

      fs.writeFileSync(this._filePath, JSON.stringify(obj, null, 2), "utf-8");
    } catch (err) {
      console.warn("[Cache] Error al guardar cache a disco:", err.message);
    }
  }

  // ── Operaciones de cache ────────────────────────────────

  get(key) {
    const entry = this._store.get(key);
    if (!entry) return null;

    const age = Date.now() - entry.timestamp;
    if (age > entry.ttl) {
      this._store.delete(key);
      return null;
    }

    return entry.data;
  }

  set(key, data, ttl = DEFAULT_TTL) {
    this._store.set(key, {
      data,
      timestamp: Date.now(),
      ttl,
    });

    // Persistir archivos de NASA y de alto valor (como hoy o históricos) a disco
    if (ttl >= TTL_HOY) {
      this._saveToDisk();
    }
  }

  has(key) {
    return this.get(key) !== null;
  }

  clear() {
    this._store.clear();
    this._pendingRequests.clear();
    this._saveToDisk();
  }

  /**
   * Deduplicación: si ya hay un request en vuelo, esperar ese.
   * Usa persistedTTL para guardar en disco automáticamente.
   */
  async dedup(key, fetchFn, ttl = DEFAULT_TTL) {
    // 1. Revisar cache (memoria + datos cargados de disco)
    const cached = this.get(key);
    if (cached !== null) {
      return { data: cached, source: "cache" };
    }

    // 2. Si hay un request pendiente, esperar
    if (this._pendingRequests.has(key)) {
      const data = await this._pendingRequests.get(key);
      return { data, source: "dedup" };
    }

    // 3. Fetch y registrar como pendiente
    const promise = fetchFn();
    this._pendingRequests.set(key, promise);

    try {
      const data = await promise;
      this.set(key, data, ttl);
      return { data, source: "api" };
    } finally {
      this._pendingRequests.delete(key);
    }
  }

  getStats() {
    return {
      entries: this._store.size,
      pending: this._pendingRequests.size,
      filePath: this._filePath,
    };
  }
}

const cache = new PersistentCache(CACHE_FILE);

// ═══════════════════════════════════════════════════════════
// NASA API — Core Fetch (single 7-day window)
// ═══════════════════════════════════════════════════════════

async function fetchNASA7Dias(startDate, endDate) {
  const url = `${NASA_BASE}?start_date=${startDate}&end_date=${endDate}&api_key=${API_KEY}`;

  const res = await fetch(url);

  // Rate limit detectado
  if (res.status === 429) {
    const cached = cache.get(`range:${startDate}:${endDate}`);
    if (cached) return cached;
    throw new Error("NASA API rate limit alcanzado (429). Intenta más tarde.");
  }

  if (!res.ok) {
    throw new Error(`NASA API error: ${res.status} ${res.statusText}`);
  }

  const data = await res.json();
  return transformarDatos(data);
}

// ═══════════════════════════════════════════════════════════
// Obtener NEOs de Hoy (con cache + dedup)
// ═══════════════════════════════════════════════════════════

async function obtenerNEOHoy() {
  const hoy = formatDate(new Date());
  const key = `neo:today:${hoy}`;

  const result = await cache.dedup(
    key,
    () => fetchNASA7Dias(hoy, hoy),
    TTL_HOY
  );

  return {
    asteroides: result.data,
    fuente: result.source,
    fecha: hoy,
    total: result.data.length,
    cacheStats: cache.getStats(),
  };
}

// ═══════════════════════════════════════════════════════════
// Obtener NEOs por Rango (loop de 7 días, con cache)
// ═══════════════════════════════════════════════════════════

async function obtenerNEORango(fechaInicio, fechaFin) {
  const windows = generarVentanas7Dias(fechaInicio, fechaFin);
  const todos = [];
  let fromCache = 0;
  let fromApi = 0;

  for (const [start, end] of windows) {
    const key = `range:${start}:${end}`;

    // 🧠 CACHE INTELIGENTE:
    // Si la ventana toca hoy o el futuro -> TTL de 1 hora
    // Si la ventana es puramente del pasado -> TTL infinito (permanente)
    const hoy = formatDate(new Date());
    const ttl = (end >= hoy) ? TTL_HOY : PERSIST_TTL;

    const result = await cache.dedup(
      key,
      () => fetchNASA7Dias(start, end),
      ttl
    );

    todos.push(...result.data);

    if (result.source === "cache" || result.source === "dedup") {
      fromCache++;
    } else {
      fromApi++;
      // Delay para no saturar la API
      if (windows.indexOf([start, end]) < windows.length - 1) {
        await sleep(DELAY_BETWEEN_REQUESTS);
      }
    }
  }

  // Deduplicar por ID
  const unicos = deduplicarPorId(todos);

  return {
    asteroides: unicos,
    total: unicos.length,
    rango: { inicio: fechaInicio, fin: fechaFin },
    ventanas: windows.length,
    fromCache,
    fromApi,
    cacheStats: cache.getStats(),
  };
}

// ═══════════════════════════════════════════════════════════
// Fusión de Datos (local + NASA)
// ═══════════════════════════════════════════════════════════

function fusionarDatos(datosLocales, datosNASA) {
  const combinados = [...datosLocales, ...datosNASA];
  const unicos = deduplicarPorId(combinados);

  // Clasificar fuente
  const idsLocales = new Set(datosLocales.map((d) => d.id));
  const idsNASA = new Set(datosNASA.map((d) => d.id));

  return unicos.map((item) => ({
    ...item,
    fuente: idsLocales.has(item.id) && idsNASA.has(item.id)
      ? "ambos"
      : idsLocales.has(item.id)
        ? "local"
        : "nasa",
  }));
}

// ═══════════════════════════════════════════════════════════
// Detección de Anomalías + Alertas
// ═══════════════════════════════════════════════════════════

function detectarAnomalias(datosNASA, datosLocales) {
  const alertas = [];

  // Estadísticas del dataset local (baseline)
  const localMagAvg = promedio(datosLocales.map((d) => d.magnitud).filter(Boolean));
  const localDiamAvg = promedio(datosLocales.map((d) => d.diametro).filter(Boolean));
  const localMagStd = desviacionEstandar(datosLocales.map((d) => d.magnitud).filter(Boolean));
  const localDiamStd = desviacionEstandar(datosLocales.map((d) => d.diametro).filter(Boolean));

  for (const neo of datosNASA) {
    const flags = [];

    // 🚨 Asteroide de gran tamaño (> 1km)
    if (neo.diametro >= 1) {
      flags.push({
        tipo: "peligro",
        nivel: "alto",
        mensaje: `⚠️ Diámetro ${neo.diametro.toFixed(3)} km — potencialmente peligroso`,
      });
    }

    // 🔥 Alta velocidad (> 20 km/s)
    if (neo.velocidad && neo.velocidad > 20) {
      flags.push({
        tipo: "velocidad",
        nivel: "medio",
        mensaje: `🚀 Velocidad ${neo.velocidad.toFixed(1)} km/s — muy rápido`,
      });
    }

    // 📊 Outlier en magnitud (> 2σ del baseline)
    if (localMagStd > 0 && Math.abs(neo.magnitud - localMagAvg) > 2 * localMagStd) {
      flags.push({
        tipo: "outlier",
        nivel: "info",
        mensaje: `📊 Magnitud ${neo.magnitud.toFixed(2)} es un outlier (μ=${localMagAvg.toFixed(2)}, σ=${localMagStd.toFixed(2)})`,
      });
    }

    // 📊 Outlier en diámetro
    if (localDiamStd > 0 && neo.diametro > localDiamAvg + 2 * localDiamStd) {
      flags.push({
        tipo: "outlier",
        nivel: "medio",
        mensaje: `📊 Diámetro ${neo.diametro.toFixed(4)} km es un outlier vs dataset local`,
      });
    }

    if (flags.length > 0) {
      alertas.push({
        id: neo.id,
        nombre: neo.nombre,
        magnitud: neo.magnitud,
        diametro: neo.diametro,
        velocidad: neo.velocidad,
        alertas: flags,
        nivelMax: flags.some((f) => f.nivel === "alto") ? "alto"
                : flags.some((f) => f.nivel === "medio") ? "medio" : "info",
      });
    }
  }

  // Ordenar por nivel de peligro
  const orden = { alto: 0, medio: 1, info: 2 };
  alertas.sort((a, b) => orden[a.nivelMax] - orden[b.nivelMax]);

  return {
    total: alertas.length,
    peligrosos: alertas.filter((a) => a.nivelMax === "alto").length,
    outliers: alertas.filter((a) => a.alertas.some((f) => f.tipo === "outlier")).length,
    alertas,
  };
}

// ═══════════════════════════════════════════════════════════
// Comparación: Hoy vs Histórico
// ═══════════════════════════════════════════════════════════

function compararConHistorico(datosNASA, datosLocales) {
  const nasaStats = calcStats(datosNASA);
  const localStats = calcStats(datosLocales);

  return {
    hoy: { ...nasaStats, total: datosNASA.length },
    historico: { ...localStats, total: datosLocales.length },
    diferencias: {
      magnitudPromDiff: redondear(nasaStats.magnitudProm - localStats.magnitudProm, 4),
      diametroProm: redondear(nasaStats.diametroProm - localStats.diametroProm, 6),
      velocidadProm: redondear(
        (nasaStats.velocidadProm || 0) - (localStats.velocidadProm || 0), 4
      ),
    },
  };
}

function calcStats(data) {
  if (!data.length) return { magnitudProm: 0, diametroProm: 0, velocidadProm: 0 };
  return {
    magnitudProm: redondear(promedio(data.map((d) => d.magnitud).filter(Boolean)), 4),
    diametroProm: redondear(promedio(data.map((d) => d.diametro).filter(Boolean)), 6),
    velocidadProm: redondear(promedio(data.map((d) => d.velocidad).filter(Boolean)), 4),
    magnitudMax: redondear(Math.max(...data.map((d) => d.magnitud || 0)), 4),
    magnitudMin: redondear(Math.min(...data.filter((d) => d.magnitud > 0).map((d) => d.magnitud)), 4),
    diametroMax: redondear(Math.max(...data.map((d) => d.diametro || 0)), 6),
  };
}

// ═══════════════════════════════════════════════════════════
// Transformación NASA → Formato interno
// ═══════════════════════════════════════════════════════════

function transformarDatos(data) {
  const resultado = [];

  const fechas = data.near_earth_objects;
  if (!fechas) return resultado;

  for (const fecha in fechas) {
    for (const obj of fechas[fecha]) {
      const diamMin = obj.estimated_diameter?.kilometers?.estimated_diameter_min || 0;
      const diamMax = obj.estimated_diameter?.kilometers?.estimated_diameter_max || 0;
      const diametro = (diamMin + diamMax) / 2;

      const velocidad = parseFloat(
        obj.close_approach_data?.[0]?.relative_velocity?.kilometers_per_second || 0
      );

      const distancia = parseFloat(
        obj.close_approach_data?.[0]?.miss_distance?.kilometers || 0
      );

      if (obj.absolute_magnitude_h < 25) {
        resultado.push({
          id: Number(obj.id),
          nombre: obj.name,
          magnitud: obj.absolute_magnitude_h,
          diametro,
          albedo: 0.15,
          velocidad,
          distancia,
          peligroso: obj.is_potentially_hazardous_asteroid || false,
          fecha: obj.close_approach_data?.[0]?.close_approach_date || fecha,
        });
      }
    }
  }

  return resultado;
}

// ═══════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════

function formatDate(d) {
  return d.toISOString().split("T")[0];
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function deduplicarPorId(arr) {
  const map = new Map();
  for (const item of arr) {
    if (!map.has(item.id)) map.set(item.id, item);
  }
  return [...map.values()];
}

/**
 * Genera ventanas de max 7 días para cubrir un rango completo
 */
function generarVentanas7Dias(inicio, fin) {
  const ventanas = [];
  let current = new Date(inicio);
  const end = new Date(fin);

  while (current <= end) {
    const windowEnd = new Date(current);
    windowEnd.setDate(windowEnd.getDate() + 6); // 7 días

    const actualEnd = windowEnd > end ? end : windowEnd;

    ventanas.push([formatDate(current), formatDate(actualEnd)]);

    current = new Date(actualEnd);
    current.setDate(current.getDate() + 1);
  }

  return ventanas;
}

function promedio(arr) {
  if (!arr.length) return 0;
  return arr.reduce((s, v) => s + v, 0) / arr.length;
}

function desviacionEstandar(arr) {
  if (arr.length < 2) return 0;
  const avg = promedio(arr);
  const variance = arr.reduce((s, v) => s + Math.pow(v - avg, 2), 0) / arr.length;
  return Math.sqrt(variance);
}

function redondear(n, d) {
  if (!isFinite(n)) return 0;
  const f = Math.pow(10, d);
  return Math.round(n * f) / f;
}

// ═══════════════════════════════════════════════════════════
// Exportación
// ═══════════════════════════════════════════════════════════

module.exports = {
  obtenerNEOHoy,
  obtenerNEORango,
  fusionarDatos,
  detectarAnomalias,
  compararConHistorico,
  cache,
};