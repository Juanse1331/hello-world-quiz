// Cola de evaluación: limita cuántos envíos se evalúan al mismo tiempo para no saturar el equipo.
// Los que esperan reciben su posición en la fila (1 = el siguiente en entrar).

class Cola {
  constructor(maxSimultaneos = 4) {
    this.max = Math.max(1, maxSimultaneos)
    this.activos = 0
    this.espera = [] // { tarea, resolve, reject, alCambiarPosicion }
  }

  /**
   * Agrega una tarea (función async). Devuelve una promesa con su resultado.
   * alCambiarPosicion(posicion) se llama mientras espera; posicion 0 = ya se está evaluando.
   */
  agregar(tarea, alCambiarPosicion = () => {}) {
    return new Promise((resolve, reject) => {
      this.espera.push({ tarea, resolve, reject, alCambiarPosicion })
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
