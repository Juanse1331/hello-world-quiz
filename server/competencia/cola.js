// Cola de evaluación: limita cuántos envíos se evalúan al mismo tiempo para no saturar el equipo.
// Los que esperan reciben su posición en la fila (1 = el siguiente en entrar).
// Prioridad: los ENVÍOS (prioridad 0) pasan antes que los "Probar" (prioridad 1), para que
// muchos estudiantes probando código no retrasen la calificación de quien ya envió.

class Cola {
  constructor(maxSimultaneos = 4) {
    this.max = Math.max(1, maxSimultaneos)
    this.activos = 0
    this.espera = [] // { tarea, resolve, reject, alCambiarPosicion, prioridad }
  }

  /**
   * Agrega una tarea (función async). Devuelve una promesa con su resultado.
   * alCambiarPosicion(posicion) se llama mientras espera; posicion 0 = ya se está evaluando.
   * prioridad: 0 = envío (primero), 1 = prueba.
   */
  agregar(tarea, alCambiarPosicion = () => {}, prioridad = 0) {
    return new Promise((resolve, reject) => {
      const nuevo = { tarea, resolve, reject, alCambiarPosicion, prioridad }
      // Se ubica detrás de los de su misma prioridad, pero delante de los de menor prioridad
      const i = this.espera.findIndex(x => x.prioridad > prioridad)
      if (i === -1) this.espera.push(nuevo)
      else this.espera.splice(i, 0, nuevo)
      this._avisarPosiciones()
      this._siguiente()
    })
  }

  estado() {
    return { activos: this.activos, enEspera: this.espera.length, max: this.max }
  }

  _avisarPosiciones() {
    this.espera.forEach((item, i) => {
      try { item.alCambiarPosicion(i + 1) } catch { /* el aviso nunca debe romper la cola */ }
    })
  }

  _siguiente() {
    while (this.activos < this.max && this.espera.length > 0) {
      const item = this.espera.shift()
      this.activos++
      try { item.alCambiarPosicion(0) } catch { /* ignorar */ }
      Promise.resolve()
        .then(() => item.tarea())
        .then(item.resolve, item.reject)
        .finally(() => {
          this.activos--
          this._siguiente()
        })
      this._avisarPosiciones()
    }
  }
}

module.exports = { Cola }
