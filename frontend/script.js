/**
 * AstroAFD — Frontend Application
 *
 * Conecta con la API REST del backend para:
 *  - Analizar asteroides individualmente
 *  - Ejecutar análisis por lote
 *  - Mostrar la definición formal del autómata
 *  - Listar el catálogo de asteroides
 */

const API_BASE = "/api";

// ═══════════════════════════════════════════════════════════
// Starfield Animation
// ═══════════════════════════════════════════════════════════

(function initStarfield() {
  const canvas = document.getElementById("starfield-canvas");
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  let stars = [];
  const STAR_COUNT = 180;

  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }

  function createStars() {
    stars = [];
    for (let i = 0; i < STAR_COUNT; i++) {
      stars.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        radius: Math.random() * 1.5 + 0.3,
        alpha: Math.random() * 0.7 + 0.3,
        speed: Math.random() * 0.3 + 0.05,
        drift: (Math.random() - 0.5) * 0.15,
        twinkleSpeed: Math.random() * 0.02 + 0.005,
        twinklePhase: Math.random() * Math.PI * 2,
      });
    }
  }

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (const s of stars) {
      s.twinklePhase += s.twinkleSpeed;
      const flicker = 0.5 + 0.5 * Math.sin(s.twinklePhase);
      const alpha = s.alpha * flicker;

      ctx.beginPath();
      ctx.arc(s.x, s.y, s.radius, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(200, 220, 255, ${alpha})`;
      ctx.fill();

      // Subtle movement
      s.y -= s.speed;
      s.x += s.drift;

      // Wrap around
      if (s.y < -5) { s.y = canvas.height + 5; s.x = Math.random() * canvas.width; }
      if (s.x < -5) s.x = canvas.width + 5;
      if (s.x > canvas.width + 5) s.x = -5;
    }

    requestAnimationFrame(draw);
  }

  resize();
  createStars();
  draw();
  window.addEventListener("resize", () => { resize(); createStars(); });
})();

// ═══════════════════════════════════════════════════════════
// Tab Navigation
// ═══════════════════════════════════════════════════════════

document.addEventListener("DOMContentLoaded", () => {
  const tabs = document.querySelectorAll(".nav-tab");
  const panels = document.querySelectorAll(".panel");

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      const targetId = tab.dataset.panel;

      tabs.forEach((t) => t.classList.remove("active"));
      panels.forEach((p) => p.classList.remove("active"));

      tab.classList.add("active");
      document.getElementById(targetId).classList.add("active");

      // Lazy-load data on first visit
      if (targetId === "panel-automata") loadAutomataDefinicion();
      if (targetId === "panel-catalogo") loadCatalogo();
      if (targetId === "panel-graficas") loadGraficas();

      // Stop live mode when leaving panel
      if (targetId !== "panel-live" && liveIntervalId) {
        stopLiveMode();
      }
    });
  });

  // Search handlers
  const searchInput = document.getElementById("search-input");
  const btnAnalizar = document.getElementById("btn-analizar");

  btnAnalizar.addEventListener("click", () => ejecutarAnalisis());
  searchInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") ejecutarAnalisis();
  });

  // Batch handler
  document.getElementById("btn-lote").addEventListener("click", () => ejecutarLote());

  // Chart controls
  const chartSelector = document.getElementById("chart-selector");
  const chartFilter = document.getElementById("chart-filter");

  if (chartSelector) {
    chartSelector.addEventListener("change", () => {
      if (graficasData) renderSelectedChart();
    });
  }
  if (chartFilter) {
    chartFilter.addEventListener("change", () => {
      if (graficasData) renderSelectedChart();
    });
  }

  // Live mode handlers
  const btnLiveFetch = document.getElementById("btn-live-fetch");
  const btnLiveToggle = document.getElementById("btn-live-toggle");

  if (btnLiveFetch) {
    btnLiveFetch.addEventListener("click", () => fetchLiveData());
  }
  if (btnLiveToggle) {
    btnLiveToggle.addEventListener("click", () => toggleLiveMode());
  }
});

// ═══════════════════════════════════════════════════════════
// API Helpers
// ═══════════════════════════════════════════════════════════

async function apiFetch(endpoint) {
  try {
    const response = await fetch(`${API_BASE}${endpoint}`);

    let data;
    try {
      data = await response.json();
    } catch {
      throw new Error("Respuesta inválida del servidor");
    }

    if (!response.ok) {
      throw new Error(data.error || "Error del servidor");
    }

    return data;

  } catch (error) {
    throw new Error(error.message || "Error de conexión");
  }
}
// ═══════════════════════════════════════════════════════════
// Individual Analysis
// ═══════════════════════════════════════════════════════════

async function ejecutarAnalisis() {
  const input = document.getElementById("search-input");
  const criterio = input.value.trim();
  const area = document.getElementById("result-area");

  if (!criterio) {
    area.innerHTML = renderError("Ingresa un ID o nombre de asteroide");
    return;
  }

  area.innerHTML = renderSpinner("Analizando asteroide...");

  try {
    const data = await apiFetch(`/analisis/${encodeURIComponent(criterio)}`);
    area.innerHTML = renderAnalisisResult(data);
  } catch (err) {
    area.innerHTML = renderError(err.message);
  }
}

function renderAnalisisResult(data) {
  const { cuerpo, analisis, automata, resumen } = data;
  const isAccepted = automata.aceptado;
  const statusClass = isAccepted ? "accepted" : "rejected";

  let html = "";

  // Status badge
  html += `
    <div class="card" style="text-align:center;">
      <div class="status-badge ${statusClass}" style="display:inline-flex; margin-bottom:12px;">
        <span>${isAccepted ? "✅" : "❌"}</span>
        Estado Final: ${automata.estadoFinal}
      </div>
      <div class="result-summary ${statusClass}">${escapeHtml(resumen)}</div>
    </div>
  `;

  // Asteroid properties
  if (cuerpo) {
    html += `
      <div class="card">
        <div class="card-header">
          <div class="card-icon blue">🪨</div>
          <div>
            <div class="card-title">${escapeHtml(cuerpo.nombre || `ID ${cuerpo.id}`)}</div>
            <div class="card-description">Propiedades físicas del cuerpo menor</div>
          </div>
        </div>
        <div class="props-grid">
          <div class="prop-item">
            <div class="prop-label">ID</div>
            <div class="prop-value blue">${cuerpo.id}</div>
          </div>
          <div class="prop-item">
            <div class="prop-label">Magnitud (H)</div>
            <div class="prop-value cyan">${formatNum(cuerpo.magnitud)}</div>
          </div>
          <div class="prop-item">
            <div class="prop-label">Diámetro</div>
            <div class="prop-value purple">${formatNum(cuerpo.diametro)} km</div>
          </div>
          <div class="prop-item">
            <div class="prop-label">Albedo</div>
            <div class="prop-value orange">${formatNum(cuerpo.albedo)}</div>
          </div>
        </div>
      </div>
    `;
  }

  // Event sequence
  html += `
    <div class="card">
      <div class="card-header">
        <div class="card-icon cyan">📡</div>
        <div>
          <div class="card-title">Secuencia de Eventos</div>
          <div class="card-description">Alfabeto generado por el analizador</div>
        </div>
      </div>
      <div class="event-sequence">
        ${renderEventSequence(analisis.eventos)}
      </div>
    </div>
  `;

  // Transition history
  if (automata.historial && automata.historial.length > 0) {
    html += `
      <div class="card">
        <div class="card-header">
          <div class="card-icon purple">🔄</div>
          <div>
            <div class="card-title">Historial de Transiciones</div>
            <div class="card-description">Recorrido paso a paso del autómata</div>
          </div>
        </div>
        <div class="history-list">
          ${automata.historial
            .map(
              (h, i) => `
              <div class="history-item" style="animation-delay: ${i * 0.08}s">
                <div class="history-step">${i + 1}</div>
                <span class="history-from">${h.desde}</span>
                <span class="history-arrow">→</span>
                <span class="history-event ${h.evento}">${eventLabel(h.evento)}</span>
                <span class="history-arrow">→</span>
                <span class="history-to">${h.hacia}</span>
              </div>`
            )
            .join("")}
        </div>
      </div>
    `;
  }

  // Analysis detail
  if (analisis.detalle) {
    const d = analisis.detalle;
    html += `
      <div class="card">
        <div class="card-header">
          <div class="card-icon green">📋</div>
          <div>
            <div class="card-title">Detalle del Análisis</div>
            <div class="card-description">Resultado de cada etapa de validación</div>
          </div>
        </div>
        <div class="props-grid">
          ${renderCheckItem("Encontrado", d.encontrado)}
          ${renderCheckItem("Datos Válidos", d.valido)}
          ${renderCheckItem("Analizable", d.analizable)}
          ${renderCheckItem("Clasificado", d.clasificado)}
        </div>
        ${d.motivoRechazo ? `<div style="margin-top:16px;" class="error-message"><span class="error-icon">⚠️</span> ${escapeHtml(d.motivoRechazo)}</div>` : ""}
      </div>
    `;
  }

  return html;
}

function renderCheckItem(label, value) {
  const icon = value ? "✅" : "⬜";
  const color = value ? "green" : "";
  return `
    <div class="prop-item">
      <div class="prop-label">${label}</div>
      <div class="prop-value ${color}">${icon}</div>
    </div>
  `;
}

function renderEventSequence(eventos) {
  return eventos
    .map((e, i) => {
      const arrow = i < eventos.length - 1 ? `<span class="event-arrow">→</span>` : "";
      return `<span class="event-badge ${e}" style="animation-delay: ${i * 0.1}s">${e}</span>${arrow}`;
    })
    .join("");
}

// ═══════════════════════════════════════════════════════════
// Batch Analysis
// ═══════════════════════════════════════════════════════════

async function ejecutarLote() {
  const area = document.getElementById("lote-result-area");
  area.innerHTML = renderSpinner("Procesando todos los asteroides...");

  try {
    const data = await apiFetch("/analisis");
    area.innerHTML = renderLoteResult(data);
  } catch (err) {
    area.innerHTML = renderError(err.message);
  }
}

function renderLoteResult(data) {
  const { total, clasificados, descartados, resultados } = data;

  let html = `
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-value total">${total}</div>
        <div class="stat-label">Total</div>
      </div>
      <div class="stat-card">
        <div class="stat-value accepted">${clasificados}</div>
        <div class="stat-label">Clasificados</div>
      </div>
      <div class="stat-card">
        <div class="stat-value rejected">${descartados}</div>
        <div class="stat-label">Descartados</div>
      </div>
    </div>
  `;

  if (resultados && resultados.length > 0) {
    html += `
      <div class="card" style="overflow-x:auto;">
        <table class="batch-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Nombre</th>
              <th>Eventos</th>
              <th>Estado</th>
              <th>Resultado</th>
            </tr>
          </thead>
          <tbody>
            ${resultados
              .map(
                (r) => `
                <tr>
                  <td>${r.id}</td>
                  <td class="name-cell">${escapeHtml(r.nombre || "—")}</td>
                  <td class="events-cell">${r.eventos.join(" → ")}</td>
                  <td>${r.estadoFinal}</td>
                  <td>
                    <span class="mini-badge ${r.aceptado ? "accepted" : "rejected"}">
                      ${r.aceptado ? "Clasificado" : "Descartado"}
                    </span>
                  </td>
                </tr>`
              )
              .join("")}
          </tbody>
        </table>
      </div>
    `;
  }

  return html;
}

// ═══════════════════════════════════════════════════════════
// Automata Definition
// ═══════════════════════════════════════════════════════════

let automataLoaded = false;

async function loadAutomataDefinicion() {
  if (automataLoaded) return;

  try {
    const def = await apiFetch("/automata/definicion");
    automataLoaded = true;

    renderFormalDefinition(def);
    renderStateDiagram(def);
    renderTransitionMatrix(def);
  } catch (err) {
    document.getElementById("automata-def-area").innerHTML = renderError(err.message);
  }
}

function renderFormalDefinition(def) {
  const area = document.getElementById("automata-def-area");
  area.innerHTML = `
    <table class="formal-table">
      <tr>
        <th>Componente</th>
        <th>Valor</th>
      </tr>
      <tr>
        <td style="font-family: var(--font-sans); color: var(--text-secondary);">Q (Estados)</td>
        <td>{ ${def.estados.join(", ")} }</td>
      </tr>
      <tr>
        <td style="font-family: var(--font-sans); color: var(--text-secondary);">Σ (Alfabeto)</td>
        <td>{ ${def.alfabeto.join(", ")} }</td>
      </tr>
      <tr>
        <td style="font-family: var(--font-sans); color: var(--text-secondary);">q₀ (Inicial)</td>
        <td>${def.estadoInicial}</td>
      </tr>
      <tr>
        <td style="font-family: var(--font-sans); color: var(--text-secondary);">F (Aceptación)</td>
        <td>{ ${def.estadosAceptacion.join(", ")} }</td>
      </tr>
    </table>
  `;
}

function renderStateDiagram(def) {
  const container = document.getElementById("state-diagram");

  // Build SVG state diagram
  const states = def.estados;
  const transitions = def.transiciones;
  const initial = def.estadoInicial;
  const acceptance = new Set(def.estadosAceptacion);

  // State positions (manually placed for clarity)
  const positions = {
    Inicio:      { x: 80,  y: 150 },
    Consultado:  { x: 230, y: 150 },
    Verificados: { x: 380, y: 150 },
    // Handle both with and without accent
    Análisis:    { x: 530, y: 150 },
    Analisis:    { x: 530, y: 150 },
    Clasificado: { x: 680, y: 80  },
    Descartado:  { x: 680, y: 220 },
  };

  const svgW = 780;
  const svgH = 300;

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${svgW} ${svgH}" style="font-family: Inter, sans-serif;">`;

  // Defs (arrow marker)
  svg += `
    <defs>
      <marker id="arrowhead" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
        <polygon points="0 0, 8 3, 0 6" fill="#4ea8f6" />
      </marker>
      <marker id="arrowhead-red" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
        <polygon points="0 0, 8 3, 0 6" fill="#f87171" />
      </marker>
    </defs>
  `;

  // Initial arrow
  const initPos = positions[initial];
  if (initPos) {
    svg += `<line x1="${initPos.x - 45}" y1="${initPos.y}" x2="${initPos.x - 22}" y2="${initPos.y}"
              stroke="#4ea8f6" stroke-width="2" marker-end="url(#arrowhead)" />`;
  }

  // Draw transitions
  for (const [fromState, trans] of Object.entries(transitions)) {
    for (const [event, toState] of Object.entries(trans)) {
      const from = positions[fromState];
      const to = positions[toState];
      if (!from || !to) continue;

      const isReject = event === "r";
      const marker = isReject ? "url(#arrowhead-red)" : "url(#arrowhead)";
      const color = isReject ? "#f87171" : "#4ea8f6";

      if (toState === "Descartado" && fromState !== "Analisis" && fromState !== "Análisis") {
        // Curved arrows to Descartado
        const midX = (from.x + to.x) / 2;
        const midY = from.y + 50 + (from.x > 300 ? 10 : 30);
        svg += `<path d="M ${from.x} ${from.y + 20} Q ${midX} ${midY} ${to.x - 20} ${to.y}"
                  fill="none" stroke="${color}" stroke-width="1.5" stroke-dasharray="${isReject ? "4,4" : "none"}"
                  marker-end="${marker}" opacity="0.7" />`;
        // Label
        const labelX = midX - 10;
        const labelY = midY - 6;
        svg += `<text x="${labelX}" y="${labelY}" fill="${color}" font-size="11" font-weight="600" font-family="JetBrains Mono, monospace">${event}</text>`;
      } else {
        // Straight or slightly offset arrows
        const dx = to.x - from.x;
        const dy = to.y - from.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const nx = dx / dist;
        const ny = dy / dist;

        const startX = from.x + nx * 22;
        const startY = from.y + ny * 22;
        const endX = to.x - nx * 22;
        const endY = to.y - ny * 22;

        svg += `<line x1="${startX}" y1="${startY}" x2="${endX}" y2="${endY}"
                  stroke="${color}" stroke-width="1.5" marker-end="${marker}"
                  ${isReject ? 'stroke-dasharray="4,4" opacity="0.7"' : ""} />`;

        // Label
        const labelX = (startX + endX) / 2 + (dy !== 0 ? -14 : 0);
        const labelY = (startY + endY) / 2 + (dy !== 0 ? 4 : -10);
        svg += `<text x="${labelX}" y="${labelY}" fill="${color}" font-size="11" font-weight="600" font-family="JetBrains Mono, monospace">${event}</text>`;
      }
    }
  }

  // Draw states
  for (const state of states) {
    const pos = positions[state];
    if (!pos) continue;

    const isAcceptance = acceptance.has(state);
    const isFinal = state === "Descartado";
    const isInit = state === initial;

    let fillColor = "rgba(15, 20, 40, 0.9)";
    let strokeColor = "#4ea8f6";
    let textColor = "#e8eaf0";

    if (isAcceptance) {
      fillColor = "rgba(52, 211, 153, 0.12)";
      strokeColor = "#34d399";
      textColor = "#34d399";
    } else if (isFinal) {
      fillColor = "rgba(248, 113, 113, 0.12)";
      strokeColor = "#f87171";
      textColor = "#f87171";
    }

    // Double circle for acceptance states
    if (isAcceptance) {
      svg += `<circle cx="${pos.x}" cy="${pos.y}" r="24" fill="none" stroke="${strokeColor}" stroke-width="1" opacity="0.5" />`;
    }

    svg += `<circle cx="${pos.x}" cy="${pos.y}" r="20" fill="${fillColor}" stroke="${strokeColor}" stroke-width="2" />`;
    svg += `<text x="${pos.x}" y="${pos.y + 30}" fill="${textColor}" font-size="10" font-weight="600" text-anchor="middle">${state}</text>`;

    // Short label inside circle
    const shortLabel = state === "Inicio" ? "q₀" :
                       state === "Consultado" ? "q₁" :
                       state === "Verificados" ? "q₂" :
                       (state === "Análisis" || state === "Analisis") ? "q₃" :
                       state === "Clasificado" ? "q₄" : "q₅";
    svg += `<text x="${pos.x}" y="${pos.y + 4}" fill="${textColor}" font-size="10" font-weight="700" text-anchor="middle" font-family="JetBrains Mono, monospace">${shortLabel}</text>`;
  }

  svg += "</svg>";
  container.innerHTML = svg;
}

function renderTransitionMatrix(def) {
  const container = document.getElementById("transition-matrix");
  const { estados, alfabeto, transiciones } = def;

  let html = `<table class="matrix-table"><thead><tr><th>δ(q, σ)</th>`;
  for (const sym of alfabeto) {
    html += `<th>${sym}</th>`;
  }
  html += `</tr></thead><tbody>`;

  for (const state of estados) {
    html += `<tr><td>${state}</td>`;
    for (const sym of alfabeto) {
      const target = transiciones[state]?.[sym];
      if (target) {
        html += `<td class="has-transition">${target}</td>`;
      } else {
        html += `<td class="empty-cell">—</td>`;
      }
    }
    html += `</tr>`;
  }

  html += `</tbody></table>`;
  container.innerHTML = html;
}

// ═══════════════════════════════════════════════════════════
// Catalog
// ═══════════════════════════════════════════════════════════

let catalogoLoaded = false;

async function loadCatalogo() {
  if (catalogoLoaded) return;

  const area = document.getElementById("catalogo-area");

  try {
    const data = await apiFetch("/asteroides");
    catalogoLoaded = true;

    if (!data.asteroides || data.asteroides.length === 0) {
      area.innerHTML = `<div class="result-empty"><div class="empty-icon">📭</div><p>No hay asteroides en la base de datos</p></div>`;
      return;
    }

    let html = `
      <p style="color: var(--text-secondary); margin-bottom: 16px; font-size: 0.9rem;">
        ${data.total} asteroides registrados
      </p>
      <div style="overflow-x:auto;">
        <table class="batch-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Nombre</th>
              <th>Magnitud (H)</th>
              <th>Diámetro (km)</th>
              <th>Albedo</th>
              <th>Acción</th>
            </tr>
          </thead>
          <tbody>
            ${data.asteroides
              .map(
                (a) => `
                <tr>
                  <td>${a.id}</td>
                  <td class="name-cell">${escapeHtml(a.nombre || "—")}</td>
                  <td>${formatNum(a.magnitud)}</td>
                  <td>${formatNum(a.diametro)}</td>
                  <td>${formatNum(a.albedo)}</td>
                  <td>
                    <button class="btn btn-secondary" style="padding:6px 14px; font-size:0.8rem;"
                            onclick="analizarDesde('${escapeAttr(String(a.id))}')">
                      🔍 Analizar
                    </button>
                  </td>
                </tr>`
              )
              .join("")}
          </tbody>
        </table>
      </div>
    `;

    area.innerHTML = html;
  } catch (err) {
    area.innerHTML = renderError(err.message);
  }
}

/** Quick analysis from catalog */
function analizarDesde(id) {
  // Switch to analysis tab
  const tabs = document.querySelectorAll(".nav-tab");
  const panels = document.querySelectorAll(".panel");

  tabs.forEach((t) => t.classList.remove("active"));
  panels.forEach((p) => p.classList.remove("active"));

  tabs[0].classList.add("active");
  document.getElementById("panel-analisis").classList.add("active");

  // Set value and trigger analysis
  document.getElementById("search-input").value = id;
  ejecutarAnalisis();
}

// ═══════════════════════════════════════════════════════════
// Utility Functions
// ═══════════════════════════════════════════════════════════

function eventLabel(e) {
  const labels = {
    d: "d (detectado)",
    v: "v (válido)",
    a: "a (analizable)",
    c: "c (clasificado)",
    r: "r (rechazado)",
  };
  return labels[e] || e;
}

function formatNum(n) {
  if (n == null || isNaN(n)) return "—";
  return Number(n).toFixed(4);
}

function escapeHtml(str) {
  if (!str) return "";
  const el = document.createElement("span");
  el.textContent = str;
  return el.innerHTML;
}

function escapeAttr(str) {
  return str.replace(/'/g, "\\'").replace(/"/g, "&quot;");
}

function renderSpinner(text = "Cargando...") {
  return `
    <div class="spinner-wrapper">
      <div class="spinner"></div>
      <span class="spinner-text">${text}</span>
    </div>
  `;
}

function renderError(message) {
  return `
    <div class="error-message">
      <span class="error-icon">⚠️</span>
      <span>${escapeHtml(message)}</span>
    </div>
  `;
}

// ═══════════════════════════════════════════════════════════
// Charts / Visualización Module
// ═══════════════════════════════════════════════════════════

let graficasData = null;
let graficasLoaded = false;
let activeChart = null;
let trajectoryAnimationId = null;

// Chart.js global config
if (typeof Chart !== "undefined") {
  Chart.defaults.color = "#8b92a8";
  Chart.defaults.borderColor = "rgba(255,255,255,0.06)";
  Chart.defaults.font.family = "'Inter', sans-serif";
  Chart.defaults.plugins.legend.labels.usePointStyle = true;
  Chart.defaults.plugins.tooltip.backgroundColor = "rgba(10,14,26,0.95)";
  Chart.defaults.plugins.tooltip.borderColor = "rgba(78,168,246,0.25)";
  Chart.defaults.plugins.tooltip.borderWidth = 1;
  Chart.defaults.plugins.tooltip.cornerRadius = 8;
  Chart.defaults.plugins.tooltip.padding = 12;
}

const CHART_META = {
  "snr-dist":           { title: "Distribución de SNR",        desc: "Cantidad de asteroides por nivel de detectabilidad" },
  "mag-diam":           { title: "Magnitud vs Diámetro",       desc: "Relación tamaño-brillo coloreada por detectabilidad" },
  "albedo-hist":        { title: "Histograma de Albedo",       desc: "Distribución de reflectividad de los asteroides" },
  "snr-prob":           { title: "SNR vs Probabilidad",        desc: "Modelo sigmoidal de probabilidad de detección" },
  "vel-diam":           { title: "Velocidad vs Diámetro",      desc: "Relación tamaño-velocidad aproximada" },
  "clasif-pie":         { title: "Clasificación Global",       desc: "Distribución: Prioritario, Observable, Baja prioridad" },
  "detectabilidad-evo": { title: "Evolución de Detectabilidad", desc: "SNR simulado a lo largo de observaciones" },
  "trayectoria":        { title: "Trayectoria Aproximada",     desc: "Simulación visual del movimiento de un asteroide" },
};

async function loadGraficas() {
  if (graficasLoaded) return;

  try {
    graficasData = await apiFetch("/estadisticas");
    graficasLoaded = true;
    renderSelectedChart();
  } catch (err) {
    document.getElementById("chart-card").innerHTML = renderError(err.message);
  }
}

function getFilteredData() {
  if (!graficasData || !graficasData.detalle) return [];
  const filter = document.getElementById("chart-filter").value;
  const data = graficasData.detalle;

  if (filter === "detectables") return data.filter((d) => d.snr >= 5);
  if (filter === "prioritarios") return data.filter((d) => d.clasificacion === "Prioritario");
  return data;
}

function renderSelectedChart() {
  const type = document.getElementById("chart-selector").value;
  const meta = CHART_META[type] || {};

  // Update header
  document.getElementById("chart-title").textContent = meta.title || "";
  document.getElementById("chart-description").textContent = meta.desc || "";

  // Show/hide canvas elements
  const chartWrapper = document.querySelector(".chart-wrapper");
  const trajCanvas = document.getElementById("trajectory-canvas");
  const pointCard = document.getElementById("point-detail-card");

  chartWrapper.style.display = (type === "trayectoria") ? "none" : "block";
  trajCanvas.style.display = (type === "trayectoria") ? "block" : "none";
  pointCard.style.display = "none";

  // Cancel trajectory animation
  if (trajectoryAnimationId) {
    cancelAnimationFrame(trajectoryAnimationId);
    trajectoryAnimationId = null;
  }

  // Render stats
  renderChartStats();

  // Destroy previous chart
  if (activeChart) {
    activeChart.destroy();
    activeChart = null;
  }

  const filtered = getFilteredData();

  switch (type) {
    case "snr-dist":           renderSNRDistribution(filtered); break;
    case "mag-diam":           renderMagVsDiam(filtered); break;
    case "albedo-hist":        renderAlbedoHist(filtered); break;
    case "snr-prob":           renderSNRvsProb(filtered); break;
    case "vel-diam":           renderVelVsDiam(filtered); break;
    case "clasif-pie":         renderClasifPie(filtered); break;
    case "detectabilidad-evo": renderDetectEvo(filtered); break;
    case "trayectoria":        renderTrajectory(filtered); break;
  }
}

function renderChartStats() {
  const statsEl = document.getElementById("chart-stats");
  if (!graficasData || !graficasData.estadisticas) {
    statsEl.style.display = "none";
    return;
  }

  const s = graficasData.estadisticas;
  statsEl.style.display = "grid";
  statsEl.innerHTML = `
    <div class="stat-card">
      <div class="stat-value total">${s.total}</div>
      <div class="stat-label">Total analizado</div>
    </div>
    <div class="stat-card">
      <div class="stat-value accepted">${s.snrPromedio.toFixed(2)}</div>
      <div class="stat-label">SNR Promedio</div>
    </div>
    <div class="stat-card">
      <div class="stat-value rejected">${(s.probPromedioDeteccion * 100).toFixed(1)}%</div>
      <div class="stat-label">Prob. Detección Prom.</div>
    </div>
  `;
}

function getChartCanvas() {
  return document.getElementById("main-chart");
}

// ── 1. SNR Distribution (Bar) ───────────────────────────────────────────────

function renderSNRDistribution(data) {
  const ranges = [
    { label: "Muy baja (<2)", min: 0, max: 2, color: "#f87171" },
    { label: "Baja (2-5)", min: 2, max: 5, color: "#fb923c" },
    { label: "Moderada (5-10)", min: 5, max: 10, color: "#fbbf24" },
    { label: "Buena (10-20)", min: 10, max: 20, color: "#4ea8f6" },
    { label: "Excelente (>20)", min: 20, max: Infinity, color: "#34d399" },
  ];

  const counts = ranges.map((r) => data.filter((d) => d.snr >= r.min && d.snr < r.max).length);

  activeChart = new Chart(getChartCanvas(), {
    type: "bar",
    data: {
      labels: ranges.map((r) => r.label),
      datasets: [{
        label: "Asteroides",
        data: counts,
        backgroundColor: ranges.map((r) => r.color + "40"),
        borderColor: ranges.map((r) => r.color),
        borderWidth: 2,
        borderRadius: 8,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            afterLabel: (ctx) => {
              const total = data.length;
              const pct = total > 0 ? ((ctx.raw / total) * 100).toFixed(1) : 0;
              return `${pct}% del total`;
            },
          },
        },
      },
      scales: {
        y: { beginAtZero: true, ticks: { stepSize: 1 } },
      },
    },
  });
}

// ── 2. Magnitud vs Diámetro (Scatter) ───────────────────────────────────────

function renderMagVsDiam(data) {
  activeChart = new Chart(getChartCanvas(), {
    type: "scatter",
    data: {
      datasets: [{
        label: "Asteroides",
        data: data.map((d) => ({ x: d.magnitud, y: d.diametro, nombre: d.nombre, snr: d.snr, det: d.detectabilidad })),
        backgroundColor: data.map((d) => d.color + "99"),
        borderColor: data.map((d) => d.color),
        borderWidth: 1,
        pointRadius: 6,
        pointHoverRadius: 10,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const p = ctx.raw;
              return [
                `${p.nombre || "Sin nombre"}`,
                `Magnitud: ${p.x.toFixed(2)}`,
                `Diámetro: ${p.y.toFixed(2)} km`,
                `SNR: ${p.snr.toFixed(2)}`,
                `Detectabilidad: ${p.det}`,
              ];
            },
          },
        },
      },
      scales: {
        x: { title: { display: true, text: "Magnitud (H)" } },
        y: { title: { display: true, text: "Diámetro (km)" } },
      },
      onClick: (evt, elements) => {
        if (elements.length > 0) {
          const idx = elements[0].index;
          showPointDetail(data[idx]);
        }
      },
    },
  });
}

// ── 3. Albedo Histogram (Bar) ───────────────────────────────────────────────

function renderAlbedoHist(data) {
  const ranges = [
    { label: "0-0.05", min: 0, max: 0.05 },
    { label: "0.05-0.1", min: 0.05, max: 0.1 },
    { label: "0.1-0.2", min: 0.1, max: 0.2 },
    { label: "0.2-0.3", min: 0.2, max: 0.3 },
    { label: "0.3-0.5", min: 0.3, max: 0.5 },
    { label: "0.5-1.0", min: 0.5, max: 1.0 },
  ];

  const counts = ranges.map((r) => data.filter((d) => d.albedo >= r.min && d.albedo < r.max).length);
  const maxCount = Math.max(...counts, 1);

  activeChart = new Chart(getChartCanvas(), {
    type: "bar",
    data: {
      labels: ranges.map((r) => r.label),
      datasets: [{
        label: "Asteroides",
        data: counts,
        backgroundColor: counts.map((c) => {
          const intensity = c / maxCount;
          return `rgba(167, 139, 250, ${0.2 + intensity * 0.6})`;
        }),
        borderColor: "#a78bfa",
        borderWidth: 2,
        borderRadius: 8,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { title: { display: true, text: "Albedo" } },
        y: { beginAtZero: true, ticks: { stepSize: 1 } },
      },
    },
  });
}

// ── 4. SNR vs Probabilidad (Line) ───────────────────────────────────────────

function renderSNRvsProb(data) {
  const sorted = [...data].sort((a, b) => a.snr - b.snr);

  // Also generate theoretical curve
  const theoreticalX = [];
  const theoreticalY = [];
  for (let snr = 0; snr <= 30; snr += 0.5) {
    theoreticalX.push(snr);
    theoreticalY.push(1 / (1 + Math.exp(-0.8 * (snr - 5))));
  }

  activeChart = new Chart(getChartCanvas(), {
    type: "scatter",
    data: {
      datasets: [
        {
          label: "Curva teórica (sigmoidal)",
          data: theoreticalX.map((x, i) => ({ x, y: theoreticalY[i] })),
          type: "line",
          borderColor: "#a78bfa",
          backgroundColor: "rgba(167, 139, 250, 0.1)",
          borderWidth: 2,
          pointRadius: 0,
          fill: true,
          tension: 0.4,
        },
        {
          label: "Asteroides (datos reales)",
          data: sorted.map((d) => ({ x: d.snr, y: d.probabilidad, nombre: d.nombre })),
          backgroundColor: sorted.map((d) => d.color + "99"),
          borderColor: sorted.map((d) => d.color),
          pointRadius: 5,
          pointHoverRadius: 8,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        tooltip: {
          callbacks: {
            label: (ctx) => {
              if (ctx.datasetIndex === 0) return `P = ${(ctx.raw.y * 100).toFixed(1)}%`;
              const p = ctx.raw;
              return [`${p.nombre}`, `SNR: ${p.x.toFixed(2)}`, `P: ${(p.y * 100).toFixed(1)}%`];
            },
          },
        },
      },
      scales: {
        x: { title: { display: true, text: "SNR" } },
        y: { title: { display: true, text: "Probabilidad" }, min: 0, max: 1 },
      },
    },
  });
}

// ── 5. Velocidad vs Diámetro (Scatter) ──────────────────────────────────────

function renderVelVsDiam(data) {
  activeChart = new Chart(getChartCanvas(), {
    type: "scatter",
    data: {
      datasets: [{
        label: "Asteroides",
        data: data.map((d) => ({ x: d.diametro, y: d.velocidad, nombre: d.nombre })),
        backgroundColor: data.map((d) => d.color + "99"),
        borderColor: data.map((d) => d.color),
        pointRadius: 6,
        pointHoverRadius: 10,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const p = ctx.raw;
              return [`${p.nombre}`, `Diámetro: ${p.x.toFixed(2)} km`, `Vel: ${p.y.toFixed(2)} km/s`];
            },
          },
        },
      },
      scales: {
        x: { title: { display: true, text: "Diámetro (km)" } },
        y: { title: { display: true, text: "Velocidad aprox. (km/s)" } },
      },
      onClick: (evt, elements) => {
        if (elements.length > 0) showPointDetail(data[elements[0].index]);
      },
    },
  });
}

// ── 6. Clasificación Global (Doughnut) ──────────────────────────────────────

function renderClasifPie(data) {
  const groups = { Prioritario: 0, Observable: 0, "Baja prioridad": 0 };
  data.forEach((d) => { if (d.clasificacion in groups) groups[d.clasificacion]++; });

  activeChart = new Chart(getChartCanvas(), {
    type: "doughnut",
    data: {
      labels: Object.keys(groups),
      datasets: [{
        data: Object.values(groups),
        backgroundColor: ["#34d39960", "#4ea8f660", "#f8717160"],
        borderColor: ["#34d399", "#4ea8f6", "#f87171"],
        borderWidth: 2,
        hoverOffset: 8,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: "60%",
      plugins: {
        legend: { position: "bottom" },
        tooltip: {
          callbacks: {
            afterLabel: (ctx) => {
              const total = data.length;
              return `${((ctx.raw / total) * 100).toFixed(1)}% del total`;
            },
          },
        },
      },
    },
  });
}

// ── 7. Evolución de Detectabilidad (Line animated) ──────────────────────────

function renderDetectEvo(data) {
  // Simulate detectability over 10 "observation sessions"
  const sessions = 10;
  const selectedSample = data.slice(0, Math.min(data.length, 8));

  const datasets = selectedSample.map((d, i) => {
    const snrValues = [];
    for (let t = 0; t < sessions; t++) {
      const noise = (Math.random() - 0.5) * d.snr * 0.3;
      snrValues.push(Math.max(0, d.snr + noise * Math.sin(t * 0.5)));
    }
    return {
      label: d.nombre || `ID ${d.id}`,
      data: snrValues,
      borderColor: d.color,
      backgroundColor: d.color + "20",
      borderWidth: 2,
      pointRadius: 4,
      tension: 0.3,
      fill: false,
    };
  });

  activeChart = new Chart(getChartCanvas(), {
    type: "line",
    data: {
      labels: Array.from({ length: sessions }, (_, i) => `T${i + 1}`),
      datasets,
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: "bottom", labels: { boxWidth: 12 } },
      },
      scales: {
        x: { title: { display: true, text: "Sesión de observación" } },
        y: { title: { display: true, text: "SNR" }, beginAtZero: true },
      },
      animation: { duration: 1500, easing: "easeInOutQuart" },
    },
  });
}

// ── 8. Trayectoria Aproximada (Canvas 2D) ───────────────────────────────────

function renderTrajectory(data) {
  const canvas = document.getElementById("trajectory-canvas");
  canvas.width = canvas.parentElement.clientWidth - 56;
  canvas.height = 400;
  const ctx = canvas.getContext("2d");

  const sample = data.slice(0, Math.min(data.length, 5));
  const asteroids = sample.map((d, i) => ({
    name: d.nombre || `ID ${d.id}`,
    color: d.color,
    radius: Math.max(3, Math.min(12, d.diametro * 2)),
    orbitRadius: 60 + i * 45,
    speed: 0.002 + (d.velocidad || 10) * 0.001,
    angle: Math.random() * Math.PI * 2,
  }));

  const centerX = canvas.width / 2;
  const centerY = canvas.height / 2;

  function drawFrame() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Sun
    const sunGrad = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, 20);
    sunGrad.addColorStop(0, "#fbbf24");
    sunGrad.addColorStop(1, "rgba(251,191,36,0)");
    ctx.beginPath();
    ctx.arc(centerX, centerY, 20, 0, Math.PI * 2);
    ctx.fillStyle = sunGrad;
    ctx.fill();

    ctx.beginPath();
    ctx.arc(centerX, centerY, 6, 0, Math.PI * 2);
    ctx.fillStyle = "#fbbf24";
    ctx.fill();

    // Orbits and asteroids
    for (const a of asteroids) {
      // Orbit path
      ctx.beginPath();
      ctx.arc(centerX, centerY, a.orbitRadius, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(255,255,255,0.06)";
      ctx.lineWidth = 1;
      ctx.stroke();

      // Asteroid
      const x = centerX + Math.cos(a.angle) * a.orbitRadius;
      const y = centerY + Math.sin(a.angle) * a.orbitRadius;

      // Trail
      for (let t = 1; t <= 8; t++) {
        const trailAngle = a.angle - a.speed * t * 3;
        const tx = centerX + Math.cos(trailAngle) * a.orbitRadius;
        const ty = centerY + Math.sin(trailAngle) * a.orbitRadius;
        ctx.beginPath();
        ctx.arc(tx, ty, a.radius * (1 - t * 0.1), 0, Math.PI * 2);
        ctx.fillStyle = a.color + Math.round(20 - t * 2).toString(16).padStart(2, "0");
        ctx.fill();
      }

      // Body
      ctx.beginPath();
      ctx.arc(x, y, a.radius, 0, Math.PI * 2);
      ctx.fillStyle = a.color;
      ctx.fill();
      ctx.strokeStyle = a.color;
      ctx.lineWidth = 1;
      ctx.stroke();

      // Label
      ctx.font = "11px Inter, sans-serif";
      ctx.fillStyle = "#8b92a8";
      ctx.textAlign = "center";
      ctx.fillText(a.name, x, y - a.radius - 6);

      a.angle += a.speed;
    }

    trajectoryAnimationId = requestAnimationFrame(drawFrame);
  }

  drawFrame();
}

// ── Point Detail (click interaction) ────────────────────────────────────────

function showPointDetail(item) {
  const card = document.getElementById("point-detail-card");
  const nameEl = document.getElementById("point-detail-name");
  const contentEl = document.getElementById("point-detail-content");

  card.style.display = "block";
  nameEl.textContent = item.nombre || `ID ${item.id}`;

  contentEl.innerHTML = `
    <div class="props-grid">
      <div class="prop-item">
        <div class="prop-label">Magnitud (H)</div>
        <div class="prop-value cyan">${item.magnitud?.toFixed(4) ?? "—"}</div>
      </div>
      <div class="prop-item">
        <div class="prop-label">Diámetro</div>
        <div class="prop-value purple">${item.diametro?.toFixed(4) ?? "—"} km</div>
      </div>
      <div class="prop-item">
        <div class="prop-label">Albedo</div>
        <div class="prop-value orange">${item.albedo?.toFixed(4) ?? "—"}</div>
      </div>
      <div class="prop-item">
        <div class="prop-label">SNR</div>
        <div class="prop-value blue">${item.snr?.toFixed(4) ?? "—"}</div>
      </div>
      <div class="prop-item">
        <div class="prop-label">Probabilidad</div>
        <div class="prop-value green">${item.probabilidad ? (item.probabilidad * 100).toFixed(1) + "%" : "—"}</div>
      </div>
      <div class="prop-item">
        <div class="prop-label">Detectabilidad</div>
        <div class="prop-value" style="color: ${item.color}">${item.detectabilidad ?? "—"}</div>
      </div>
      <div class="prop-item">
        <div class="prop-label">Clasificación</div>
        <div class="prop-value blue">${item.clasificacion ?? "—"}</div>
      </div>
      <div class="prop-item">
        <div class="prop-label">Velocidad</div>
        <div class="prop-value cyan">${item.velocidad?.toFixed(2) ?? "—"} km/s</div>
      </div>
    </div>
    <div style="margin-top:16px; text-align:center;">
      <button class="btn btn-secondary" onclick="analizarDesde('${item.id}')">🔍 Analizar en detalle</button>
    </div>
  `;

  card.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

// ═══════════════════════════════════════════════════════════
// Tiempo Real / Live Mode
// ═══════════════════════════════════════════════════════════

let liveIntervalId = null;
let liveChart = null;
let timelineChart = null;
let liveData = null;
let liveUpdateCount = 0;

// Metricas Inteligentes Globales
let cacheLlamadasEvitadas = 0;
let cacheLlamadasNasa = 0;
let totalAsteroidesTratados = 0;
let totalAnomaliasGlobales = 0;
let cacheStatusText = "Inactivo";

const LIVE_INTERVAL_MS = 5000;

// ── Helper Badges ───────────────────────────────────────────────────────────

function getSourceBadgeHTML(fuente) {
  if (!fuente) return `<span class="badge-source api">🟢 API</span>`;
  const f = fuente.toLowerCase();
  if (f === "cache") return `<span class="badge-source cache">🟡 Cache</span>`;
  if (f === "dedup") return `<span class="badge-source cache">🟡 Dedup</span>`;
  if (f === "local") return `<span class="badge-source local">🔵 Local</span>`;
  if (f === "ambos") return `<span class="badge-source ambos">🟣 Fusión</span>`;
  return `<span class="badge-source api">🟢 API</span>`;
}

// ── Fetch Live Data ─────────────────────────────────────────────────────────

async function fetchLiveData() {
  const tableArea = document.getElementById("live-table-area");
  setLiveStatus("fetching", "📡 Consultando NASA API...");

  try {
    const t0 = performance.now();
    const response = await fetch(`${API_BASE}/tiempo-real`);
    
    if (response.status === 204) {
      setLiveStatus("error", "Sin datos disponibles hoy");
      tableArea.innerHTML = renderError("NASA no reporta NEOs para hoy");
      return;
    }

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.error || `Error HTTP ${response.status}`);
    }

    const result = await response.json();
    const t1 = performance.now();
    const latency = (t1 - t0).toFixed(0);

    // New format: { asteroides, fuente, fecha, total, cacheStats }
    const asteroides = result.asteroides || result;
    liveData = Array.isArray(asteroides) ? asteroides : [];
    liveUpdateCount++;

    // Métricas Inteligentes
    if (result.fuente === "api") {
      cacheLlamadasNasa++;
    } else {
      cacheLlamadasEvitadas++;
    }
    totalAsteroidesTratados += liveData.length;
    
    updateMasterDashboard();
    renderCacheIntelligence(result.fuente, latency);

    const btnToggle = document.getElementById("btn-live-toggle");
    if (btnToggle) btnToggle.disabled = false;

    // Enable advanced buttons
    document.querySelectorAll(".btn-live-advanced").forEach((b) => b.disabled = false);

    const sourceTag = result.fuente === "cache" ? " (cache)" : result.fuente === "dedup" ? " (dedup)" : " (API)";
    setLiveStatus("active", `✅ ${liveData.length} NEOs obtenidos${sourceTag}`);
    
    // Al renderizar, pasamos la fuente global de este request
    renderLiveResults(liveData, result.fuente || "api");
    renderLiveChart(liveData);
    renderTimelineChart(liveData);
    renderLiveStats(liveData);
    
    addLiveLog(`Datos obtenidos: ${liveData.length} asteroides [${result.fuente || "api"}]`, liveData.length);

  } catch (err) {
    setLiveStatus("error", `❌ ${err.message}`);
    tableArea.innerHTML = renderError(err.message);
    addLiveLog(`Error: ${err.message}`, 0);
  }
}

// ── Atualizar Master Dashboard ──────────────────────────────────────────────
function updateMasterDashboard() {
  const md = document.getElementById("master-dashboard");
  if (md) md.style.display = "grid";
  
  const mdTotal = document.getElementById("md-total");
  const mdAnomalias = document.getElementById("md-anomalias");
  const mdLiveStatus = document.getElementById("md-live-status");
  const mdCacheRatio = document.getElementById("md-cache-ratio");

  if (mdTotal) mdTotal.textContent = totalAsteroidesTratados;
  if (mdAnomalias) mdAnomalias.textContent = totalAnomaliasGlobales;
  if (mdLiveStatus) {
    mdLiveStatus.textContent = cacheStatusText;
    mdLiveStatus.className = "stat-value " + (cacheStatusText.includes("ACTIVO") ? "cyan" : "accepted");
  }
  
  if (mdCacheRatio) {
    const totalRequests = cacheLlamadasNasa + cacheLlamadasEvitadas;
    const ratio = totalRequests === 0 ? 100 : Math.round((cacheLlamadasEvitadas / totalRequests) * 100);
    mdCacheRatio.textContent = ratio + "%";
    
    if (ratio < 50) mdCacheRatio.className = "stat-value rejected";
    else if (ratio < 80) mdCacheRatio.className = "stat-value";
    else mdCacheRatio.className = "stat-value accepted";
  }
}

// ── Render Inteligencia Caché ───────────────────────────────────────────────
function renderCacheIntelligence(fuente, ms) {
  const card = document.getElementById("cache-intel-card");
  if (!card) return;
  card.style.display = "block";
  
  document.getElementById("intel-evitados").textContent = cacheLlamadasEvitadas;
  document.getElementById("intel-reales").textContent = cacheLlamadasNasa;
  document.getElementById("intel-ms").textContent = ms + " ms";
  
  // Agregar una pequeña animación de pulso si se acierta en caché
  if (fuente === "cache" || fuente === "dedup") {
    card.classList.remove("animate-update");
    void card.offsetWidth; // trigger reflow
    card.classList.add("animate-update");
  }
}

// ── Toggle Live Mode ────────────────────────────────────────────────────────

function toggleLiveMode() {
  if (liveIntervalId) {
    stopLiveMode();
  } else {
    startLiveMode();
  }
}

function startLiveMode() {
  const btn = document.getElementById("btn-live-toggle");
  const badge = document.getElementById("live-badge");

  liveIntervalId = setInterval(() => fetchLiveData(), LIVE_INTERVAL_MS);

  btn.innerHTML = "<span>⏹️</span> Detener Modo LIVE";
  btn.classList.add("btn-live-active");
  badge.style.display = "inline-flex";

  setLiveStatus("active", `🔴 LIVE — actualización cada ${LIVE_INTERVAL_MS / 1000}s`);
  addLiveLog("Modo LIVE activado", null);

  cacheStatusText = "📡 LIVE ACTIVO";
  updateMasterDashboard();

  fetchLiveData();
}

function stopLiveMode() {
  clearInterval(liveIntervalId);
  liveIntervalId = null;

  const btn = document.getElementById("btn-live-toggle");
  const badge = document.getElementById("live-badge");

  if (btn) {
    btn.innerHTML = "<span>⏱️</span> Activar Modo LIVE";
    btn.classList.remove("btn-live-active");
  }
  if (badge) badge.style.display = "none";

  setLiveStatus("", "⏸️ Modo LIVE detenido");
  addLiveLog("Modo LIVE detenido", null);

  cacheStatusText = "⏸️ Pausado";
  updateMasterDashboard();
}

// ── Render Live Results ─────────────────────────────────────────────────────

function renderLiveResults(data, globalFuente = "api") {
  const area = document.getElementById("live-table-area");

  if (!data || data.length === 0) {
    area.innerHTML = `<div class="result-empty"><div class="empty-icon">📭</div><p>No se encontraron NEOs para hoy</p></div>`;
    return;
  }

  // Agregamos animate-update al card principal en cada update
  area.innerHTML = `
    <div class="card animate-update" style="overflow-x:auto;">
      <table class="batch-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Nombre</th>
            <th>Fuente</th>
            <th>Magnitud (H)</th>
            <th>Diámetro (km)</th>
            <th>Velocidad (km/s)</th>
            <th>Peligroso</th>
          </tr>
        </thead>
        <tbody>
          ${data.map((a) => `
            <tr class="${a.peligroso ? 'danger-row highlight-row' : ''}">
              <td>${a.id}</td>
              <td class="name-cell">${escapeHtml(a.nombre || "—")}</td>
              <td>${getSourceBadgeHTML(a.origen || globalFuente)}</td>
              <td>${a.magnitud?.toFixed(2) ?? "—"}</td>
              <td>${a.diametro?.toFixed(4) ?? "—"}</td>
              <td>${a.velocidad?.toFixed(2) ?? "—"}</td>
              <td>${a.peligroso ? '<span class="mini-badge rejected">⚠️ Sí</span>' : '<span class="mini-badge accepted">No</span>'}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

// ── Render Live Chart ───────────────────────────────────────────────────────

function renderLiveChart(data) {
  const card = document.getElementById("live-chart-card");
  card.style.display = "block";

  if (liveChart) liveChart.destroy();

  liveChart = new Chart(document.getElementById("live-chart"), {
    type: "scatter",
    data: {
      datasets: [{
        label: "NEOs de hoy",
        data: data.map((d) => ({
          x: d.magnitud,
          y: d.diametro,
          nombre: d.nombre,
          vel: d.velocidad,
          peligroso: d.peligroso,
        })),
        backgroundColor: data.map((d) => {
          if (d.peligroso) return "#f8717199"; // Rojo transparente (peligro)
          if (d.diametro >= 0.1) return "#fbbf2499"; // Naranja transparente (medio)
          return "#34d39999"; // Verde (normal)
        }),
        borderColor: data.map((d) => {
          if (d.peligroso) return "#f87171";
          if (d.diametro >= 0.1) return "#fbbf24";
          return "#34d399";
        }),
        pointRadius: data.map((d) => Math.max(4, Math.min(14, d.diametro * 20))),
        pointHoverRadius: 12,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const p = ctx.raw;
              return [
                p.nombre,
                `Magnitud: ${p.x.toFixed(2)}`,
                `Diámetro: ${p.y.toFixed(4)} km`,
                `Velocidad: ${p.vel?.toFixed(2) ?? "—"} km/s`,
                p.peligroso ? "⚠️ POTENCIALMENTE PELIGROSO" : "",
              ].filter(Boolean);
            },
          },
        },
      },
      scales: {
        x: { title: { display: true, text: "Magnitud (H)" }, reverse: true },
        y: { title: { display: true, text: "Diámetro (km)" } },
      },
      animation: {
        duration: 800,
        easing: 'easeOutQuart'
      }
    },
  });
}

function renderTimelineChart(data) {
  const card = document.getElementById("timeline-chart-card");
  card.style.display = "block";

  if (timelineChart) timelineChart.destroy();
  
  // Fake historical timeline distribution using asteroid velocities for demonstration
  const sortedByVel = [...data].sort((a,b) => (a.velocidad || 0) - (b.velocidad || 0));
  const counts = [0,0,0,0,0];
  const labels = ["T-4h", "T-3h", "T-2h", "T-1h", "Ahora"];
  
  for (let i = 0; i < sortedByVel.length; i++) {
    counts[i % 5]++;
  }

  timelineChart = new Chart(document.getElementById("timeline-chart"), {
    type: "line",
    data: {
      labels: labels,
      datasets: [{
        label: "Detecciones",
        data: counts,
        borderColor: "#a78bfa",
        backgroundColor: "rgba(167, 139, 250, 0.2)",
        fill: true,
        tension: 0.4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: { beginAtZero: true, suggestedMax: Math.max(...counts) + 5 }
      },
      animation: {
        duration: 1000,
        easing: 'easeOutBounce'
      }
    }
  });
}

// ── Live Stats ──────────────────────────────────────────────────────────────

function renderLiveStats(data) {
  const statsEl = document.getElementById("live-stats");
  statsEl.style.display = "grid";

  const total = data.length;
  const peligrosos = data.filter((d) => d.peligroso).length;
  const avgMag = total > 0 ? (data.reduce((s, d) => s + (d.magnitud || 0), 0) / total).toFixed(2) : "—";
  const maxDiam = total > 0 ? Math.max(...data.map((d) => d.diametro || 0)).toFixed(4) : "—";

  statsEl.innerHTML = `
    <div class="stat-card">
      <div class="stat-value total">${total}</div>
      <div class="stat-label">NEOs Hoy</div>
    </div>
    <div class="stat-card">
      <div class="stat-value accepted">${avgMag}</div>
      <div class="stat-label">Magnitud Prom.</div>
    </div>
    <div class="stat-card">
      <div class="stat-value rejected">${maxDiam} km</div>
      <div class="stat-label">Mayor Diámetro</div>
    </div>
    <div class="stat-card">
      <div class="stat-value ${peligrosos > 0 ? 'rejected' : 'accepted'}">${peligrosos}</div>
      <div class="stat-label">⚠️ Peligrosos</div>
    </div>
  `;
}

// ═══════════════════════════════════════════════════════════
// Fusión / Anomalías / Comparación
// ═══════════════════════════════════════════════════════════

async function fetchFusion() {
  setLiveStatus("fetching", "🔗 Fusionando datos local + NASA...");
  addLiveLog("Solicitando fusión de datos...", null);

  try {
    const res = await fetch(`${API_BASE}/tiempo-real/fusion`);
    if (!res.ok) throw new Error(`Error HTTP ${res.status}`);
    const data = await res.json();

    setLiveStatus("active", `✅ Fusión: ${data.total} asteroides (${data.locales} local + ${data.nasa} NASA)`);
    addLiveLog(`Fusión completada: ${data.total} totales`, data.total);

    renderFusionResult(data);
  } catch (err) {
    setLiveStatus("error", `❌ ${err.message}`);
    addLiveLog(`Error fusión: ${err.message}`, 0);
  }
}

async function fetchAnomalias() {
  setLiveStatus("fetching", "🔍 Detectando anomalías...");
  addLiveLog("Analizando outliers y peligros...", null);

  try {
    const res = await fetch(`${API_BASE}/tiempo-real/anomalias`);
    if (!res.ok) throw new Error(`Error HTTP ${res.status}`);
    const data = await res.json();

    setLiveStatus("active", `✅ ${data.total} anomalías detectadas (${data.peligrosos} peligrosos)`);
    addLiveLog(`Anomalías: ${data.total} (${data.peligrosos} peligrosos, ${data.outliers} outliers)`, data.total);
    
    totalAnomaliasGlobales += data.total;
    updateMasterDashboard();

    renderAnomalias(data);
  } catch (err) {
    setLiveStatus("error", `❌ ${err.message}`);
    addLiveLog(`Error anomalías: ${err.message}`, 0);
  }
}

async function fetchComparacion() {
  setLiveStatus("fetching", "📊 Comparando hoy vs histórico...");
  addLiveLog("Calculando comparación temporal...", null);

  try {
    const res = await fetch(`${API_BASE}/tiempo-real/comparacion`);
    if (!res.ok) throw new Error(`Error HTTP ${res.status}`);
    const data = await res.json();

    setLiveStatus("active", "✅ Comparación calculada");
    addLiveLog("Comparación hoy vs histórico completada", null);

    renderComparacion(data);
  } catch (err) {
    setLiveStatus("error", `❌ ${err.message}`);
    addLiveLog(`Error comparación: ${err.message}`, 0);
  }
}

// ── Render Fusion ───────────────────────────────────────────────────────────

function renderFusionResult(data) {
  const area = document.getElementById("live-table-area");

  const locales = data.fusionados.filter((f) => f.fuente === "local").length;
  const nasa = data.fusionados.filter((f) => f.fuente === "nasa").length;
  const ambos = data.fusionados.filter((f) => f.fuente === "ambos").length;

  area.innerHTML = `
    <div class="card">
      <div class="card-header">
        <div class="card-icon cyan">🔗</div>
        <div>
          <div class="card-title">Datos Fusionados</div>
          <div class="card-description">${data.total} asteroides — ${locales} local, ${nasa} NASA, ${ambos} en ambos</div>
        </div>
      </div>
      <div style="overflow-x:auto;">
        <table class="batch-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Nombre</th>
              <th>Magnitud (H)</th>
              <th>Diámetro (km)</th>
              <th>Fuente</th>
            </tr>
          </thead>
          <tbody>
            ${data.fusionados.slice(0, 50).map((a) => `
              <tr>
                <td>${a.id}</td>
                <td class="name-cell">${escapeHtml(a.nombre || "—")}</td>
                <td>${a.magnitud?.toFixed(2) ?? "—"}</td>
                <td>${a.diametro?.toFixed(4) ?? "—"}</td>
                <td>${getSourceBadgeHTML(a.fuente)}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
      ${data.fusionados.length > 50 ? `<p style="text-align:center; color:var(--text-muted); padding: 12px 0;">Mostrando 50 de ${data.fusionados.length}</p>` : ""}
    </div>
  `;
}

// ── Render Anomalías ────────────────────────────────────────────────────────

function renderAnomalias(data) {
  const area = document.getElementById("live-table-area");

  if (data.total === 0) {
    area.innerHTML = `
      <div class="card">
        <div class="result-empty">
          <div class="empty-icon">✅</div>
          <p>No se detectaron anomalías significativas en los NEOs de hoy</p>
        </div>
      </div>`;
    return;
  }

  const nivelColor = { alto: "#f87171", medio: "#fbbf24", info: "#4ea8f6" };
  const nivelIcon = { alto: "🚨", medio: "⚠️", info: "📊" };

  area.innerHTML = `
    <div class="card">
      <div class="card-header">
        <div class="card-icon red">🚨</div>
        <div>
          <div class="card-title">Anomalías Detectadas</div>
          <div class="card-description">${data.total} asteroides con alertas — ${data.peligrosos} peligrosos, ${data.outliers} outliers</div>
        </div>
      </div>
      <div class="anomaly-list">
        ${data.alertas.map((a) => `
          <div class="anomaly-item" data-nivel="${a.nivelMax === 'alto' ? 'alta' : a.nivelMax}" style="border-left: 3px solid ${nivelColor[a.nivelMax]}">
            <div class="anomaly-header">
              <strong>${nivelIcon[a.nivelMax]} ${escapeHtml(a.nombre)}</strong>
              <span class="mini-badge ${a.nivelMax === 'alto' ? 'rejected' : ''}">${a.nivelMax.toUpperCase()}</span>
            </div>
            <div class="anomaly-meta">
              Mag: ${a.magnitud?.toFixed(2)} · Diám: ${a.diametro?.toFixed(4)} km · Vel: ${a.velocidad?.toFixed(2)} km/s
            </div>
            <ul class="anomaly-flags">
              ${a.alertas.map((f) => `<li style="color: ${nivelColor[f.nivel]}">${f.mensaje}</li>`).join("")}
            </ul>
          </div>
        `).join("")}
      </div>
    </div>
  `;
}

// ── Render Comparación ──────────────────────────────────────────────────────

function renderComparacion(data) {
  const area = document.getElementById("live-table-area");

  const diffSign = (v) => v > 0 ? `+${v}` : `${v}`;
  const diffColor = (v) => v > 0 ? "var(--accent-green)" : v < 0 ? "var(--accent-red)" : "var(--text-secondary)";

  area.innerHTML = `
    <div class="card">
      <div class="card-header">
        <div class="card-icon orange">📊</div>
        <div>
          <div class="card-title">Comparación: Hoy vs Histórico</div>
          <div class="card-description">NEOs de hoy (${data.hoy.total}) comparados con dataset local (${data.historico.total})</div>
        </div>
      </div>
      <table class="batch-table">
        <thead>
          <tr>
            <th>Métrica</th>
            <th>🕐 Hoy (NASA)</th>
            <th>📁 Histórico (Local)</th>
            <th>Δ Diferencia</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><strong>Total asteroides</strong></td>
            <td>${data.hoy.total}</td>
            <td>${data.historico.total}</td>
            <td style="color: ${diffColor(data.hoy.total - data.historico.total)}">${diffSign(data.hoy.total - data.historico.total)}</td>
          </tr>
          <tr>
            <td><strong>Magnitud promedio</strong></td>
            <td>${data.hoy.magnitudProm}</td>
            <td>${data.historico.magnitudProm}</td>
            <td style="color: ${diffColor(data.diferencias.magnitudPromDiff)}">${diffSign(data.diferencias.magnitudPromDiff)}</td>
          </tr>
          <tr>
            <td><strong>Diámetro promedio</strong></td>
            <td>${data.hoy.diametroProm} km</td>
            <td>${data.historico.diametroProm} km</td>
            <td style="color: ${diffColor(data.diferencias.diametroProm)}">${diffSign(data.diferencias.diametroProm)} km</td>
          </tr>
          <tr>
            <td><strong>Velocidad promedio</strong></td>
            <td>${data.hoy.velocidadProm} km/s</td>
            <td>${data.historico.velocidadProm} km/s</td>
            <td style="color: ${diffColor(data.diferencias.velocidadProm)}">${diffSign(data.diferencias.velocidadProm)} km/s</td>
          </tr>
          <tr>
            <td><strong>Magnitud máxima</strong></td>
            <td>${data.hoy.magnitudMax ?? "—"}</td>
            <td>${data.historico.magnitudMax ?? "—"}</td>
            <td>—</td>
          </tr>
          <tr>
            <td><strong>Diámetro máximo</strong></td>
            <td>${data.hoy.diametroMax ?? "—"} km</td>
            <td>${data.historico.diametroMax ?? "—"} km</td>
            <td>—</td>
          </tr>
        </tbody>
      </table>
    </div>
  `;
}

// ── Live Log ────────────────────────────────────────────────────────────────

function addLiveLog(message, count) {
  const logCard = document.getElementById("live-log-card");
  const logEl = document.getElementById("live-log");
  logCard.style.display = "block";

  const now = new Date().toLocaleTimeString();
  const countHtml = count !== null ? `<span class="live-log-count">${count}</span>` : "";

  const entry = document.createElement("div");
  entry.className = "live-log-entry";
  entry.innerHTML = `
    <span class="live-log-time">${now}</span>
    <span class="live-log-msg">${escapeHtml(message)}</span>
    ${countHtml}
  `;

  logEl.insertBefore(entry, logEl.firstChild);

  while (logEl.children.length > 20) {
    logEl.removeChild(logEl.lastChild);
  }
}

// ── Status Helper ───────────────────────────────────────────────────────────

function setLiveStatus(state, text) {
  const el = document.getElementById("live-status");
  el.className = "live-status" + (state ? " " + state : "");
  el.innerHTML = `<span class="live-status-text">${text}</span>`;
}

