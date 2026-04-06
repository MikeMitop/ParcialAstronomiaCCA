require("dotenv").config();

const express = require("express");
const cors = require("cors");
const path = require("path");
const analisisRutas = require("./rutas/analisisRutas");

const app = express();
const PORT = process.env.PORT || 3000;

// ── Middlewares ─────────────────────────────────────────

app.use(cors());
app.use(express.json());

// ── Frontend ───────────────────────────────────────────

const FRONTEND_PATH = path.join(__dirname, "..", "..", "frontend");
app.use(express.static(FRONTEND_PATH));

// Ruta raíz (opcional SPA)
app.get("/", (req, res) => {
  res.sendFile(path.join(FRONTEND_PATH, "index.html"));
});

// ── API ────────────────────────────────────────────────

app.use("/api", analisisRutas);

// Health check
app.get("/api", (req, res) => {
  res.json({
    proyecto: "ParcialAstronomiaCCA",
    estado: "activo", 
    version: "1.0.0",
    endpoints: {
      asteroides: "/api/asteroides",
      asteroide:  "/api/asteroides/:criterio",
      analisis:   "/api/analisis/:criterio",
      lote:       "/api/analisis",
      automata:   "/api/automata/definicion",
    },
  });
});

// ── 404 ────────────────────────────────────────────────

app.use((req, res) => {
  res.status(404).json({
    error: "Ruta no encontrada",
    ruta: req.originalUrl,
  });
});

// ── Errores ────────────────────────────────────────────

app.use((err, req, res, _next) => {
  console.error("Error:", err.message);
  res.status(500).json({
    error: "Error interno del servidor",
    detalle: err.message,
  });
});

// ── Start ──────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`Servidor activo en http://localhost:${PORT}`);
  console.log(`API disponible en http://localhost:${PORT}/api`);
  console.log(`Frontend servido desde: ${FRONTEND_PATH}`);
});

module.exports = app;