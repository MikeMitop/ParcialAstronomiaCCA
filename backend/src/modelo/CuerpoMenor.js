/**
 * Modelo: CuerpoMenor (Asteroide)
 *
 * Representa un cuerpo menor del sistema solar con propiedades físicas
 * utilizadas en el análisis mediante un autómata finito.
 *
 * Fuente de datos: NEOWISE (NASA)
 */

class CuerpoMenor {
  /**
   * @param {object} datos
   * @param {number|string} datos.id
   * @param {string} datos.nombre
   * @param {number} datos.magnitud
   * @param {number} datos.diametro
   * @param {number} datos.albedo
   */
  constructor({ id, nombre, magnitud, diametro, albedo }) {
    // Aceptar IDs numéricos y strings (ej: "NA001")
    this.id = (typeof id === "string" || typeof id === "number") ? id : null;
    this.nombre = nombre || `Asteroide-${id}`;

    this.magnitud = Number(magnitud);
    this.diametro = Number(diametro);
    this.albedo = Number(albedo);

    // 🔥 Validación fuerte
    if (
      this.id == null ||
      !CuerpoMenor.esNumeroValido(this.magnitud) ||
      !CuerpoMenor.esNumeroValido(this.diametro) ||
      !CuerpoMenor.esNumeroValido(this.albedo)
    ) {
      throw new Error(
        `Datos inválidos en CuerpoMenor (id: ${id})`
      );
    }

    // 🔒 Inmutabilidad
    Object.freeze(this);
  }

  // ── Métodos estáticos ─────────────────────────────────────────────────────

  static esNumeroValido(valor) {
    return typeof valor === "number" && isFinite(valor);
  }

  /**
   * Crea una instancia desde JSON plano.
   */
  static desde(obj) {
    if (!obj) return null;

    try {
      return new CuerpoMenor({
        id: obj.id,
        nombre: obj.nombre,
        magnitud: obj.magnitud,
        diametro: obj.diametro,
        albedo: obj.albedo,
      });
    } catch (error) {
      return null; // evita romper el flujo del sistema
    }
  }

  // ── Métodos del dominio ───────────────────────────────────────────────────

  /**
   * Verifica si los datos son válidos para análisis.
   */
  esValido() {
    return this.diametro > 0 && this.magnitud > 0 && this.albedo > 0;
  }

  /**
   * Determina si el objeto es apto para análisis (visibilidad).
   */
  esAnalizable() {
    return this.magnitud < 15;
  }

  /**
   * Clasificación basada en tamaño.
   */
  esGrande() {
    return this.diametro >= 5;
  }

  // ── Serialización ─────────────────────────────────────────────────────────

  toJSON() {
    return {
      id: this.id,
      nombre: this.nombre,
      magnitud: this.magnitud,
      diametro: this.diametro,
      albedo: this.albedo,
    };
  }

  toString() {
    return `CuerpoMenor {
      id: ${this.id},
      nombre: "${this.nombre}",
      magnitud: ${this.magnitud},
      diametro: ${this.diametro} km,
      albedo: ${this.albedo}
    }`;
  }
}

module.exports = CuerpoMenor;