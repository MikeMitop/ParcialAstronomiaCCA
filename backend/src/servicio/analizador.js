/**
 * Analizador de CuerpoMenor
 *
 * Entrada: instancia de CuerpoMenor
 * Salida: { eventos: string[], detalle: object }
 */

function analizar(cuerpo) {
  const eventos = [];
  const detalle = {
    encontrado: false,
    valido: false,
    analizable: false,
    clasificado: false,
    motivoRechazo: null
  };

  // 1) d → encontrado
  if (!cuerpo) {
    eventos.push("r");
    detalle.motivoRechazo = "Objeto no encontrado";
    return { eventos, detalle };
  }

  eventos.push("d");
  detalle.encontrado = true;

  // 2) v → datos válidos
  if (!cuerpo.esValido()) {
    eventos.push("r");
    detalle.motivoRechazo = "Datos inválidos (campos <= 0)";
    return { eventos, detalle };
  }

  eventos.push("v");
  detalle.valido = true;

  // 3) a → análisis
  if (!cuerpo.esAnalizable()) {
    eventos.push("r");
    detalle.motivoRechazo = "Magnitud no apta para análisis (>= 15)";
    return { eventos, detalle };
  }

  eventos.push("a");
  detalle.analizable = true;

  // 4) c / r → clasificación
  if (cuerpo.esGrande()) {
    eventos.push("c");
    detalle.clasificado = true;
  } else {
    eventos.push("r");
    detalle.motivoRechazo = "Diámetro insuficiente (< 5 km)";
  }

  return { eventos, detalle };
}

module.exports = { analizar };