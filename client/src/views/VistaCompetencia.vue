<template>
  <div class="comp-page">
    <header class="app-header">
      <img src="../assets/logo-aceis.png" alt="ACEIS" class="logo" />
      <h1>Hello World · ACEIS</h1>
      <div v-if="comp" class="header-derecha">
        <span v-if="item" class="chip-header">{{ item.numero }} / {{ comp.totalItems }}</span>
        <div class="chip-header"><Icon name="trophy" :size="16" /> {{ comp.misPuntos }} pts</div>
        <span class="chip-header nombre">{{ comp.nombre }}</span>
      </div>
    </header>

    <!-- Cargando o error al reconectar -->
    <div v-if="!comp" class="container-sm centrado">
      <div v-if="errorInicio" class="card fade-in">
        <div class="alert alert-error">{{ errorInicio }}</div>
        <button class="btn btn-primary btn-block" @click="volverInicio"><Icon name="arrow-left" :size="16" /> Volver al inicio</button>
      </div>
      <div v-else class="cargando">
        <div class="spinner"></div>
        <p>Conectando con la competencia...</p>
      </div>
    </div>

    <!-- Abierto en otra pestaña -->
    <div v-else-if="estado.reemplazada" class="container-sm centrado">
      <div class="card fade-in texto-centro">
        <Icon name="alert-triangle" :size="36" class="icono-aviso" />
        <h2>Abriste la competencia en otra pestaña</h2>
        <p class="texto-suave">Solo una pestaña puede estar activa a la vez.</p>
        <button class="btn btn-primary btn-block" style="margin-top: 16px;" @click="reingresar">Continuar en esta pestaña</button>
      </div>
    </div>

    <!-- Sala de espera -->
    <div v-else-if="comp.estado === 'esperando'" class="container-sm" style="padding-top: 40px;">
      <div class="card fade-in">
        <div class="texto-centro">
          <h2>¡Ya estás dentro, {{ comp.nombre }}!</h2>
          <p class="texto-suave">Espera a que el profesor inicie la competencia. Empezará automáticamente.</p>
        </div>
        <ul class="reglas">
          <li><Icon name="book" :size="16" /> Te saldrán <strong>{{ comp.totalPreguntas }} preguntas</strong><template v-if="comp.totalProblemas"> y <strong>{{ comp.totalProblemas }} retos de programación</strong></template>, mezclados en un orden distinto para cada estudiante.</li>
          <li><Icon name="clock" :size="16" /> Cada pregunta y cada reto tiene <strong>su propio tiempo</strong>. Cuando se acaba, pasas automáticamente al siguiente.</li>
          <li><Icon name="arrow-right" :size="16" /> <strong>No puedes volver atrás.</strong> Al responder una pregunta pasas a la siguiente.</li>
          <li v-if="comp.totalProblemas"><Icon name="skip-forward" :size="16" /> Si un reto se te complica, puedes <strong>saltarlo</strong>: al terminar los demás ítems podrás volver a él con el tiempo que le quedaba.</li>
          <li><Icon name="target" :size="16" /> Bonus por tiempo: cada segundo que te sobre al acertar una pregunta o resolver un reto al 100 % suma <strong>0,1 puntos</strong> (ej.: resolver en 5 min un reto de 10 min = +30 pts). Sabrás al instante si acertaste; cuál era la opción correcta se revela al final.</li>
          <template v-if="comp.totalProblemas">
            <li><Icon name="code" :size="16" /> Retos en <strong>{{ comp.lenguajes.map(lenguajeLabel).join(' o ') }}</strong>. <strong>Probar</strong> usa los ejemplos (ilimitado); <strong>Enviar</strong> califica con pruebas ocultas.</li>
            <li><Icon name="check-circle" :size="16" /> Un reto termina cuando lo resuelves al 100 %<template v-if="comp.intentosMax > 0">, cuando gastas tus <strong>{{ comp.intentosMax }} intentos fallidos</strong></template> o cuando se acaba su tiempo.</li>
          </template>
          <li><Icon name="trophy" :size="16" /> Si hay empate en puntos, gana quien lo logró en <strong>menos tiempo</strong>.</li>
        </ul>
      </div>
    </div>

    <!-- Terminó su recorrido pero dejó retos saltados: elige a cuál volver -->
    <div v-else-if="comp.estado === 'en-curso' && !item && comp.enPendientes" class="container-sm" style="padding-top: 40px;">
      <div class="card fade-in">
        <div class="texto-centro">
          <h2>Te faltan {{ comp.pendientes.length === 1 ? '1 reto' : comp.pendientes.length + ' retos' }}</h2>
          <p class="texto-suave">Terminaste los demás ítems. Puedes volver a los retos que saltaste: cada uno conserva el tiempo que le quedaba y lo que ya enviaste.</p>
        </div>
        <div class="pendientes-lista">
          <div v-for="pend in comp.pendientes" :key="pend.id" class="pendiente">
            <div class="pendiente-info">
              <strong>{{ pend.titulo }}</strong>
              <span class="texto-suave">
                <Icon name="clock" :size="13" /> Le quedan {{ formatoReloj(pend.restanteMs) }}
                · {{ pend.puntos }} pts
                <template v-if="pend.misPuntos"> · llevas {{ pend.misPuntos }}</template>
                <template v-if="comp.intentosMax > 0"> · intentos fallidos {{ pend.intentosFallidos }}/{{ comp.intentosMax }}</template>
              </span>
            </div>
            <button class="btn btn-primary btn-sm" :disabled="!!pidiendo" @click="retomar(pend.id)">
              Resolver ahora <Icon name="arrow-right" :size="14" />
            </button>
          </div>
        </div>
        <div v-if="mensajeError" class="alert alert-error" style="margin-top: 12px;">{{ mensajeError }}</div>
        <div class="texto-centro" style="margin-top: 16px;">
          <button class="btn btn-secondary btn-sm" :disabled="!!pidiendo" @click="finalizar">Terminar sin resolverlos</button>
        </div>
      </div>
    </div>

    <!-- Terminó su recorrido, los demás siguen -->
    <div v-else-if="comp.estado === 'en-curso' && !item" class="container-sm" style="padding-top: 40px;">
      <div class="card fade-in texto-centro">
        <h2>¡Terminaste!</h2>
        <p class="texto-suave">Llevas <strong>{{ comp.misPuntos }} puntos</strong>. Espera a que terminen los demás para ver el ranking y las respuestas correctas.</p>
      </div>
    </div>

    <!-- Ítem actual -->
    <template v-else-if="comp.estado === 'en-curso'">
      <div class="barra-item">
        <div class="barra-item-texto">
          <strong>{{ item.tipo === 'pregunta' ? 'Pregunta' : 'Reto de programación' }}</strong>
          <span class="texto-suave">· ítem {{ item.numero }} de {{ comp.totalItems }}</span>
          <span v-if="item.retomado" class="badge badge-retomado">Retomado</span>
        </div>
        <div class="reloj-item" :class="{ urgente: urgente }">
          <div class="timer-bar"><div class="timer-fill" :style="{ width: porcentajeTiempo + '%' }"></div></div>
          <span><Icon name="clock" :size="16" /> {{ formatoReloj(restanteMs) }}</span>
        </div>
      </div>

      <transition name="slide-up">
        <div v-if="aviso" class="container aviso" :class="aviso.clase">
          <Icon :name="aviso.icono" :size="18" /> {{ aviso.texto }}
        </div>
      </transition>

      <!-- Pregunta -->
      <div v-if="item.tipo === 'pregunta'" :key="'q' + item.clave" class="container fade-in" style="padding-top: 16px;">
        <div class="badges" style="margin-bottom: 12px;">
          <span class="badge badge-tipo">{{ tipoLabel(item.pregunta.tipo) }}</span>
          <span class="badge badge-puntos">{{ item.pregunta.puntos }} pts + bonus por tiempo</span>
        </div>
        <div class="card pregunta-card">
          <pre v-if="['IMP', 'ERR', 'COMP', 'DF'].includes(item.pregunta.tipo)" class="enunciado-codigo"><template v-for="(seg, i) in segmentosEnunciado(item.pregunta.tipo, item.pregunta.enunciado)" :key="i"><span v-if="seg.espacio" class="espacio" :class="'espacio-' + colorEspacio(seg.espacio)">{{ seg.texto }}</span><template v-else>{{ seg.texto }}</template></template></pre>
          <p v-else class="enunciado-texto">{{ item.pregunta.enunciado }}</p>
        </div>
        <p v-if="hayCompletar" class="texto-suave ayuda-completar">Cada color corresponde a un espacio del código.</p>
        <div class="opciones-grid">
          <button
            v-for="(opcion, idx) in opcionesPregunta"
            :key="idx"
            class="opcion-btn"
            :class="{ elegida: elegida === idx }"
            :disabled="elegida !== null || restanteMs <= 0"
            @click="responder(idx)"
          >
            <span class="opcion-letra">{{ 'ABCDEF'[idx] }}</span>
            <span v-if="opcion.partes" class="opcion-texto opcion-partes">
              <span v-for="parte in opcion.partes" :key="parte.n" class="ficha" :class="'espacio-' + colorEspacio(parte.n)"><b>{{ parte.n }}</b>{{ parte.valor }}</span>
            </span>
            <span v-else class="opcion-texto">{{ opcion.texto }}</span>
          </button>
        </div>
        <div v-if="mensajeError" class="alert alert-error">{{ mensajeError }}</div>
      </div>

      <!-- Reto de programación -->
      <div v-else :key="'p' + item.clave" class="reto-layout">
        <div class="reto-grid">
          <section class="card panel-enunciado">
            <div class="enunciado-cabecera">
              <h2>{{ problema.titulo }}</h2>
              <div class="badges">
                <span class="badge badge-tipo">{{ problema.puntos }} pts + bonus por tiempo</span>
                <span class="badge badge-tipo">{{ problema.totalPruebas }} pruebas ocultas</span>
              </div>
            </div>

            <p class="enunciado">{{ problema.enunciado }}</p>
            <h4>Entrada</h4>
            <p class="enunciado">{{ problema.formato_entrada }}</p>
            <div v-if="lineasEjemplo.length" class="lectura-entrada">
              <div class="lectura-titulo"><Icon name="terminal" :size="15" /> Así llega la entrada del ejemplo a tu programa</div>
              <div class="lectura-lineas">
                <div v-for="l in lineasEjemplo.slice(0, 8)" :key="l.n" class="lectura-linea">
                  <span class="lectura-num">Línea {{ l.n }}</span>
                  <code class="lectura-texto">{{ l.texto || ' ' }}</code>
                  <span class="lectura-valores">{{ l.valores === 1 ? '1 valor' : l.valores + ' valores' }}</span>
                </div>
                <div v-if="lineasEjemplo.length > 8" class="texto-suave lectura-mas">… y {{ lineasEjemplo.length - 8 }} líneas más</div>
              </div>
              <p class="lectura-ayuda"><strong>En {{ lenguajeLabel(lenguaje) }}:</strong> {{ ayudaEntrada }}</p>
            </div>
            <h4>Salida</h4>
            <p class="enunciado">{{ problema.formato_salida }}</p>

            <h4>Ejemplos</h4>
            <div v-for="(ej, i) in problema.ejemplos" :key="i" class="ejemplo">
              <div><div class="ejemplo-label">Entrada</div><pre>{{ ej.entrada }}</pre></div>
              <div><div class="ejemplo-label">Salida esperada</div><pre>{{ ej.salida }}</pre></div>
            </div>

            <div class="nota-pruebas">
              <Icon name="eye-off" :size="16" />
              <span>Los ejemplos sirven para <strong>Probar</strong>, pero <strong>no dan puntos</strong>. Al <strong>Enviar</strong> ganas puntos según las {{ problema.totalPruebas }} pruebas ocultas que pases: imprimir fijo el resultado del ejemplo da 0.</span>
            </div>
            <div class="nota-pruebas">
              <Icon name="terminal" :size="16" />
              <span>Lee la entrada <strong>exactamente</strong> como dice el formato e imprime <strong>solo</strong> la respuesta, sin mensajes como "El resultado es". En Python el texto dentro de <code>input("...")</code> se ignora.</span>
            </div>
          </section>

          <section class="panel-trabajo">
            <div class="card editor-card">
              <div class="editor-toolbar">
                <select v-if="comp.lenguajes.length > 1" v-model="lenguaje" class="form-control select-lenguaje">
                  <option v-for="l in comp.lenguajes" :key="l" :value="l">{{ lenguajeLabel(l) }}</option>
                </select>
                <span v-else class="badge badge-tipo">{{ lenguajeLabel(lenguaje) }}</span>

                <span class="estado-problema">
                  <template v-if="comp.intentosMax > 0">Intentos fallidos: {{ miEstado.intentosFallidos }} / {{ comp.intentosMax }}</template>
                  <template v-if="miEstado.puntos > 0"> · Mejor: {{ miEstado.puntos }} pts</template>
                </span>

                <button class="btn btn-sm btn-secondary btn-plantilla" @click="restaurarPlantilla" title="Volver al código inicial">
                  <Icon name="rotate-ccw" :size="14" /> Plantilla
                </button>
              </div>

              <div class="editor-wrap">
                <EditorCodigo v-model="codigoActual" :lenguaje="lenguaje" />
              </div>

              <div class="editor-acciones">
                <button class="btn btn-sm btn-saltar" :disabled="!!ocupado || restanteMs <= 0" @click="saltar" title="Pasar al siguiente ítem y volver a este reto al final">
                  <Icon name="skip-forward" :size="14" /> Saltar reto
                </button>
                <span class="texto-suave ayuda-acciones">Probar no gasta intentos. Al resolverlo pasas al siguiente ítem.</span>
                <button class="btn btn-secondary" :disabled="!!ocupado || restanteMs <= 0" @click="probar(false)">
                  <Icon name="play" :size="16" /> Probar
                </button>
                <button class="btn btn-primary" :disabled="!!ocupado || restanteMs <= 0" @click="enviar">
                  <Icon name="send" :size="16" /> Enviar
                </button>
              </div>
            </div>

            <div class="card consola">
              <div class="consola-tabs">
                <button :class="{ activo: pestanaConsola === 'resultado' }" @click="pestanaConsola = 'resultado'"><Icon name="terminal" :size="14" /> Resultado</button>
                <button :class="{ activo: pestanaConsola === 'personalizada' }" @click="pestanaConsola = 'personalizada'"><Icon name="code" :size="14" /> Mi propia entrada</button>
                <button :class="{ activo: pestanaConsola === 'envios' }" @click="pestanaConsola = 'envios'">
                  <Icon name="send" :size="14" /> Mis envíos <span v-if="misEnvios.length" class="contador">{{ misEnvios.length }}</span>
                </button>
              </div>

              <div class="consola-cuerpo">
                <div v-if="ocupado && pestanaConsola !== 'envios'" class="ejecutando">
                  <div class="spinner spinner-sm"></div>
                  <span v-if="ocupado === 'otro'">Todavía se está calificando tu envío del reto «{{ comp.evaluando.titulo }}». Te avisaremos el resultado; luego podrás ejecutar código aquí.</span>
                  <span v-else-if="posicionCola > 0">En cola: {{ posicionCola === 1 ? 'eres el siguiente' : 'hay ' + (posicionCola - 1) + ' antes que tú' }}. Muchos compañeros están ejecutando código; no cierres la página.</span>
                  <span v-else>{{ ocupado === 'enviar' ? 'Calificando con las pruebas ocultas...' : 'Ejecutando tu código...' }}</span>
                </div>

                <template v-else-if="pestanaConsola === 'resultado'">
                  <div v-if="mensajeError" class="alert alert-error">{{ mensajeError }}</div>
                  <div v-if="!accionActiva" class="vacio texto-suave">Pulsa <strong>Probar</strong> para ver qué imprime tu código con los ejemplos.</div>

                  <!-- Resultado de un envío -->
                  <div v-else-if="accionActiva.tipo === 'envio'" class="fade-in">
                    <div class="veredicto" :class="veredictoInfo(accionActiva.datos.veredicto).clase">
                      <Icon :name="veredictoInfo(accionActiva.datos.veredicto).icono" :size="22" />
                      <div>
                        <strong>{{ veredictoInfo(accionActiva.datos.veredicto).texto }}</strong>
                        <span v-if="accionActiva.datos.veredicto !== 'COMPILACION'"> · {{ accionActiva.datos.pasadas }} de {{ accionActiva.datos.total }} pruebas ocultas</span>
                      </div>
                      <span class="veredicto-puntos">+{{ accionActiva.datos.puntos }} pts<small v-if="accionActiva.datos.bonus" class="veredicto-bonus">{{ accionActiva.datos.puntosBase }} + {{ accionActiva.datos.bonus }} por tiempo</small></span>
                    </div>
                    <div class="barra-pruebas">
                      <span v-for="i in accionActiva.datos.total" :key="i" :class="{ ok: i <= accionActiva.datos.pasadas }"></span>
                    </div>
                    <p v-if="accionActiva.datos.veredicto === 'PARCIAL'" class="texto-suave">Tu programa falla en algunos casos. Revisa los casos límite: negativos, cero, números grandes...</p>
                    <pre v-if="accionActiva.datos.mensaje" class="salida-error">{{ accionActiva.datos.mensaje }}</pre>
                  </div>

                  <!-- Resultado de probar con ejemplos -->
                  <div v-else class="fade-in">
                    <pre v-if="accionActiva.datos.compilacion" class="salida-error"><strong>Error de compilación</strong>
{{ accionActiva.datos.compilacion }}</pre>
                    <div v-for="(c, i) in accionActiva.datos.casos" :key="i" class="caso" :class="c.ok ? 'caso-ok' : 'caso-mal'">
                      <div class="caso-titulo">
                        <Icon :name="c.ok ? 'check-circle' : 'x-circle'" :size="16" />
                        Ejemplo {{ i + 1 }}: {{ c.ok ? 'correcto' : (c.estado === 'OK' ? 'salida diferente' : estadoTexto(c.estado)) }}
                        <span class="caso-ms">{{ c.ms }} ms</span>
                      </div>
                      <div class="caso-columnas">
                        <div><div class="ejemplo-label">Entrada</div><pre>{{ c.entrada }}</pre></div>
                        <div><div class="ejemplo-label">Esperada</div><pre>{{ c.esperada }}</pre></div>
                        <div><div class="ejemplo-label">Tu salida</div><pre>{{ c.obtenida || '(nada)' }}</pre></div>
                      </div>
                      <pre v-if="c.error" class="salida-error">{{ c.error }}</pre>
                    </div>
                    <p v-if="accionActiva.datos.casos.length && accionActiva.datos.casos.every(c => c.ok)" class="texto-suave">
                      Pasaste los ejemplos. Ahora pulsa <strong>Enviar</strong>: se calificará con {{ problema.totalPruebas }} pruebas ocultas distintas.
                    </p>
                  </div>
                </template>

                <template v-else-if="pestanaConsola === 'personalizada'">
                  <label class="ejemplo-label">Escribe una entrada para probar tu programa</label>
                  <textarea v-model="entradaPersonalizada" class="form-control entrada-personalizada" rows="3" placeholder="Ej: 5 8" spellcheck="false"></textarea>
                  <button class="btn btn-sm btn-secondary" :disabled="!!ocupado || restanteMs <= 0" @click="probar(true)" style="margin-top: 8px;">
                    <Icon name="play" :size="14" /> Ejecutar con esta entrada
                  </button>
                  <div v-if="mensajeError" class="alert alert-error" style="margin-top: 10px;">{{ mensajeError }}</div>
                  <div v-if="resultadoPersonalizado" class="fade-in" style="margin-top: 12px;">
                    <pre v-if="resultadoPersonalizado.compilacion" class="salida-error"><strong>Error de compilación</strong>
{{ resultadoPersonalizado.compilacion }}</pre>
                    <template v-else-if="resultadoPersonalizado.casos[0]">
                      <div class="ejemplo-label">Tu salida ({{ resultadoPersonalizado.casos[0].ms }} ms)</div>
                      <pre>{{ resultadoPersonalizado.casos[0].obtenida || '(nada)' }}</pre>
                      <pre v-if="resultadoPersonalizado.casos[0].error" class="salida-error">{{ resultadoPersonalizado.casos[0].error }}</pre>
                    </template>
                  </div>
                </template>

                <template v-else>
                  <div v-if="misEnvios.length === 0" class="vacio texto-suave">Aún no has enviado este reto.</div>
                  <table v-else class="tabla-envios">
                    <thead><tr><th>Minuto</th><th>Lenguaje</th><th>Veredicto</th><th>Ocultas</th><th>Puntos</th></tr></thead>
                    <tbody>
                      <tr v-for="e in misEnvios" :key="e.id">
                        <td>{{ formatoReloj(e.tiempoMs) }}</td>
                        <td>{{ lenguajeLabel(e.lenguaje) }}</td>
                        <td><span class="chip-veredicto" :class="veredictoInfo(e.veredicto).clase">{{ veredictoInfo(e.veredicto).texto }}</span></td>
                        <td>{{ e.veredicto === 'COMPILACION' ? '—' : e.pasadas + '/' + e.total }}</td>
                        <td><strong>{{ e.puntos }}</strong></td>
                      </tr>
                    </tbody>
                  </table>
                </template>
              </div>
            </div>
          </section>
        </div>
      </div>
    </template>

    <!-- Resultados finales -->
    <div v-else class="container resultados" style="padding-top: 32px;">
      <div class="card fade-in texto-centro hero-final">
        <Icon name="trophy" :size="40" class="icono-trofeo" />
        <h2>¡Competencia terminada!</h2>
        <p v-if="comp.miPosicion" class="posicion-final">Quedaste en el puesto <strong>{{ comp.miPosicion }}</strong> de {{ comp.ranking.length }}</p>
        <div class="resumen-final">
          <div><span class="numero">{{ comp.misPuntos }}</span><span>puntos</span></div>
          <div><span class="numero">{{ correctas }}/{{ comp.totalPreguntas }}</span><span>preguntas correctas</span></div>
          <div v-if="comp.totalProblemas"><span class="numero">{{ resueltos }}/{{ comp.totalProblemas }}</span><span>retos resueltos</span></div>
          <div><span class="numero">{{ formatoReloj(comp.miTiempoTotalMs) }}</span><span>tiempo (desempate)</span></div>
        </div>
      </div>

      <div v-if="comp.ranking && comp.ranking.length" class="card fade-in" style="margin-top: 16px;">
        <Podio :resultados="resultadosPodio" :mi-codigo="comp.codigoEstudiante" />
        <table class="tabla-ranking">
          <thead><tr><th>#</th><th>Nombre</th><th>Puntos</th><th>Preguntas</th><th v-if="comp.totalProblemas">Retos</th><th>Tiempo</th></tr></thead>
          <tbody>
            <tr v-for="f in comp.ranking" :key="f.codigoEstudiante" :class="{ yo: f.codigoEstudiante === comp.codigoEstudiante }">
              <td>{{ f.posicion }}</td>
              <td>{{ f.nombre }}<span v-if="f.codigoEstudiante === comp.codigoEstudiante" class="texto-suave"> (tú)</span></td>
              <td><strong>{{ f.puntos }}</strong></td>
              <td>{{ f.preguntas.correctas }}/{{ f.preguntas.total }}</td>
              <td v-if="comp.totalProblemas">{{ f.resueltos }}</td>
              <td>{{ formatoReloj(f.tiempoTotalMs) }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-if="comp.resumen" class="card fade-in" style="margin-top: 16px;">
        <h3 style="margin-bottom: 12px;">Revisa tus respuestas</h3>
        <div v-for="(r, idx) in comp.resumen" :key="r.tipo + r.id" class="revision" :class="r.tipo === 'pregunta' ? (r.esCorrecta ? 'rev-ok' : 'rev-mal') : (r.aceptado ? 'rev-ok' : r.puntos > 0 ? 'rev-parcial' : 'rev-mal')">
          <div class="revision-cabecera">
            <span class="revision-num">{{ idx + 1 }}</span>
            <span class="badge badge-tipo">{{ r.tipo === 'pregunta' ? tipoLabel(r.tipo_pregunta) : 'Reto' }}</span>
            <strong class="revision-puntos">{{ r.puntos }} / {{ r.maxPuntos }} pts</strong>
          </div>
          <template v-if="r.tipo === 'pregunta'">
            <pre v-if="['IMP', 'ERR', 'COMP', 'DF'].includes(r.tipo_pregunta)" class="enunciado-codigo"><template v-for="(seg, i) in segmentosEnunciado(r.tipo_pregunta, r.enunciado)" :key="i"><span v-if="seg.espacio" class="espacio" :class="'espacio-' + colorEspacio(seg.espacio)">{{ seg.texto }}</span><template v-else>{{ seg.texto }}</template></template></pre>
            <p v-else class="revision-enunciado">{{ r.enunciado }}</p>
            <p class="revision-respuesta">
              <template v-if="r.respuesta === null"><Icon name="clock" :size="14" /> No respondiste a tiempo.</template>
              <template v-else><Icon :name="r.esCorrecta ? 'check-circle' : 'x-circle'" :size="14" /> Tu respuesta: <strong>{{ textoOpcion(r, r.respuesta) }}</strong></template>
              <template v-if="!r.esCorrecta"> · Correcta: <strong>{{ textoOpcion(r, r.respuestaCorrecta) }}</strong></template>
            </p>
            <p v-if="r.explicacion" class="texto-suave revision-explicacion">{{ r.explicacion }}</p>
          </template>
          <p v-else class="revision-enunciado">
            <strong>{{ r.titulo }}</strong> ·
            <template v-if="r.aceptado">resuelto</template>
            <template v-else-if="r.saltado">lo saltaste y no volviste a él<template v-if="r.envios"> ({{ r.envios }} envío(s))</template></template>
            <template v-else-if="r.envios">{{ r.envios }} envío(s), sin resolver por completo</template>
            <template v-else>sin envíos</template>
          </p>
        </div>
      </div>

      <div class="texto-centro" style="margin: 24px 0;">
        <button class="btn btn-primary" @click="volverInicio"><Icon name="arrow-left" :size="16" /> Salir</button>
      </div>
    </div>

    <!-- Sammy celebra o lamenta el resultado (se cierra solo o con un clic) -->
    <transition name="sammy">
      <div v-if="sammy" class="sammy-overlay" @click="sammy = null">
        <div class="sammy-tarjeta">
          <sammy-mascota :estado="sammy.estado" :mensaje="sammy.mensaje"></sammy-mascota>
          <p v-if="sammy.detalle" class="sammy-detalle">{{ sammy.detalle }}</p>
        </div>
      </div>
    </transition>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { useCompetencia } from '../composables/useCompetencia'
import Icon from '../components/Icon.vue'
import Podio from '../components/Podio.vue'
import EditorCodigo from '../components/EditorCodigo.vue'
import { formatoReloj, lenguajeLabel, veredictoInfo, tipoLabel } from '../utils/formato'
import { segmentosEnunciado, partesOpcion, colorEspacio } from '../utils/completar'

const router = useRouter()
const { estado, leerSesion, reingresar, salir, pedir, avisarFoco } = useCompetencia()

const comp = computed(() => estado.comp)
const item = computed(() => comp.value?.item || null)
const problema = computed(() => (item.value?.tipo === 'problema' ? item.value.problema : null))
const miEstado = computed(() => item.value?.miEstado || null)
const misEnvios = computed(() => (item.value?.misEnvios || []).slice().reverse())

const codigos = ref({})              // "P01:python" -> código
const lenguajes = ref({})            // "P01" -> 'python' | 'cpp'
const accion = ref(null)             // lo último que hizo en el reto actual: { tipo: 'prueba' | 'envio', datos }
const resultadoPersonalizado = ref(null)
const entradaPersonalizada = ref('')
const pestanaConsola = ref('resultado')
const pidiendo = ref(null)           // mientras el servidor confirma que recibió el pedido
const mensajeError = ref('')
const errorInicio = ref('')
const elegida = ref(null)            // opción que marcó en la pregunta actual
const aviso = ref(null)              // { texto, clase, icono } que se muestra unos segundos al cambiar de ítem
const sammy = ref(null)              // { estado: 'correcto' | 'incorrecto', mensaje, detalle } de la mascota
const ahora = ref(Date.now())
let reloj = null
let avanceEsperado = false           // true si el cambio de ítem lo causó el estudiante (y no el tiempo)
let temporizadorAviso = null
let temporizadorSammy = null

// ---------- Tiempo del ítem actual ----------
const restanteMs = computed(() => (item.value ? Math.max(0, item.value.fin - (ahora.value + estado.offsetReloj)) : 0))
const porcentajeTiempo = computed(() => (item.value ? (restanteMs.value / item.value.duracionMs) * 100 : 0))
const urgente = computed(() => restanteMs.value < (item.value?.tipo === 'pregunta' ? 10000 : 120000))

function mostrarAviso(texto, clase, icono) {
  clearTimeout(temporizadorAviso)
  aviso.value = { texto, clase, icono }
  temporizadorAviso = setTimeout(() => { aviso.value = null }, 5000)
}

// El servidor espera ~2 s antes de abrir el siguiente ítem, justo lo que dura la animación
function mostrarSammy(estado, mensaje, detalle = '') {
  clearTimeout(temporizadorSammy)
  sammy.value = { estado, mensaje, detalle }
  temporizadorSammy = setTimeout(() => { sammy.value = null }, 2500)
}

// Código que se está calificando en la cola. El estado viene del servidor, así no se pierde si se
// recarga la página, y no queda "pegado" en otro reto si el tiempo se acabó mientras esperaba.
const evaluando = computed(() => comp.value?.evaluando || null)
const ocupado = computed(() => {
  if (pidiendo.value) return pidiendo.value
  const ev = evaluando.value
  if (!ev) return null
  if (!problema.value || ev.problemaId !== problema.value.id) return 'otro'
  return ev.tipo === 'envio' ? 'enviar' : ev.tipo === 'personalizada' ? 'personalizada' : 'probar'
})
const posicionCola = computed(() => (evaluando.value ? (estado.cola?.posicion ?? evaluando.value.posicion ?? 0) : 0))

// Al cambiar de ítem se limpia todo lo del anterior
watch(() => item.value?.clave, (nuevo, anterior) => {
  if (anterior !== undefined && nuevo !== anterior && !avanceEsperado) mostrarAviso('Se acabó el tiempo del ítem anterior. Pasaste al siguiente.', 'aviso-tiempo', 'clock')
  avanceEsperado = false
  sammy.value = null
  elegida.value = null
  accion.value = null
  mensajeError.value = ''
  resultadoPersonalizado.value = null
  entradaPersonalizada.value = ''
  pestanaConsola.value = 'resultado'
})

// ---------- Pregunta ----------
// Opciones de la pregunta actual; en las de completar, partidas por espacio (con su color)
const opcionesPregunta = computed(() => {
  const q = item.value?.pregunta
  if (!q) return []
  return q.opciones.map(texto => ({ texto, partes: partesOpcion(q.tipo, q.enunciado, texto) }))
})
const hayCompletar = computed(() => opcionesPregunta.value.some(o => o.partes))
// Texto de una opción en la revisión final ("(1) x · (2) y" se muestra como "1: x · 2: y")
function textoOpcion(r, idx) {
  const texto = r.opciones[idx]
  const partes = partesOpcion(r.tipo_pregunta, r.enunciado, texto)
  return partes ? partes.map(p => `${p.n}: ${p.valor}`).join('   ·   ') : texto
}

async function responder(idx) {
  if (elegida.value !== null) return
  elegida.value = idx
  mensajeError.value = ''
  avanceEsperado = true
  const res = await pedir('estudiante:responder', { preguntaId: item.value.pregunta.id, respuesta: idx })
  if (res.ok) {
    if (res.esCorrecta) mostrarSammy('correcto', `¡Correcto! +${res.puntos}`, res.bonus ? `${res.puntosBase} pts + ${res.bonus} por tiempo sobrante` : '')
    else mostrarSammy('incorrecto', '¡Incorrecto!', 'La respuesta correcta se revela al final')
  } else {
    avanceEsperado = false
    elegida.value = null
    mensajeError.value = res.mensaje
  }
}

// ---------- Borradores del código guardados en el navegador ----------
function claveLocal(sufijo) {
  return `competencia:${comp.value.codigo}:${comp.value.codigoEstudiante}:${sufijo}`
}
function leerLocal(sufijo) {
  try { return localStorage.getItem(claveLocal(sufijo)) } catch { return null }
}
function guardarLocal(sufijo, valor) {
  try { localStorage.setItem(claveLocal(sufijo), valor) } catch { /* sin almacenamiento */ }
}

const lenguaje = computed({
  get() {
    return lenguajes.value[problema.value?.id] || comp.value?.lenguajes?.[0] || 'python'
  },
  set(l) {
    lenguajes.value[problema.value.id] = l
    guardarLocal(`lenguaje:${problema.value.id}`, l)
  }
})

// Carga el borrador (o la plantilla) del reto y lenguaje activos
watch([problema, () => lenguajes.value[problema.value?.id]], () => {
  const p = problema.value
  if (!p) return
  if (!lenguajes.value[p.id]) {
    const guardado = leerLocal(`lenguaje:${p.id}`)
    lenguajes.value[p.id] = comp.value.lenguajes.includes(guardado) ? guardado : comp.value.lenguajes[0]
  }
  const clave = `${p.id}:${lenguajes.value[p.id]}`
  if (codigos.value[clave] === undefined) {
    codigos.value[clave] = leerLocal(`codigo:${clave}`) ?? (p.plantilla?.[lenguajes.value[p.id]] || '')
  }
}, { immediate: true })

const codigoActual = computed({
  get() {
    return problema.value ? codigos.value[`${problema.value.id}:${lenguaje.value}`] ?? '' : ''
  },
  set(valor) {
    const clave = `${problema.value.id}:${lenguaje.value}`
    codigos.value[clave] = valor
    guardarLocal(`codigo:${clave}`, valor)
  }
})

function restaurarPlantilla() {
  if (!confirm('¿Reemplazar tu código por la plantilla inicial? Perderás lo que escribiste en este reto.')) return
  codigoActual.value = problema.value.plantilla?.[lenguaje.value] || ''
}

// ---------- Cómo leer la entrada ----------
// La entrada del primer ejemplo, línea por línea, con cuántos valores trae cada una
const lineasEjemplo = computed(() => {
  const ej = problema.value?.ejemplos?.[0]
  if (!ej) return []
  return String(ej.entrada).replace(/\n$/, '').split('\n')
    .map((texto, i) => ({ n: i + 1, texto, valores: texto.trim() ? texto.trim().split(/\s+/).length : 0 }))
})
const ayudaEntrada = computed(() => {
  const p = problema.value
  if (!p) return ''
  const propia = p.ayuda_entrada?.[lenguaje.value]
  if (propia) return propia
  const varios = lineasEjemplo.value.some(l => l.valores > 1)
  if (lenguaje.value === 'cpp') {
    return varios
      ? 'cin >> lee un valor a la vez, sin importar si están en la misma línea o en líneas distintas. Para una línea con 3 valores: cin >> a >> b >> c;'
      : 'usa cin >> variable; por cada valor (por ejemplo dentro de un ciclo si son varios).'
  }
  return varios
    ? 'cada input() lee UNA línea completa. Si la línea trae varios valores separados por espacio, sepáralos: a, b = map(int, input().split()) o lista = list(map(int, input().split())).'
    : 'cada input() lee UNA línea. Como cada línea trae un solo valor, usa un int(input()) por línea (dentro de un ciclo si son varias).'
})

// ---------- Probar y enviar ----------
// Lo último que hizo en este reto. Si recargó la página, su último envío.
const accionActiva = computed(() => accion.value || (misEnvios.value[0] ? { tipo: 'envio', datos: misEnvios.value[0] } : null))

function estadoTexto(e) {
  return { TIEMPO: 'tiempo excedido', EJECUCION: 'error en ejecución', COMPILACION: 'error de compilación' }[e] || e
}

// Probar y Enviar solo dejan el código en la cola; el resultado llega después (ver watch de estado.resultado)
async function probar(personalizada) {
  if (ocupado.value) return
  mensajeError.value = ''
  estado.cola = null
  pidiendo.value = personalizada ? 'personalizada' : 'probar'
  pestanaConsola.value = personalizada ? 'personalizada' : 'resultado'
  const datos = { problemaId: problema.value.id, lenguaje: lenguaje.value, codigo: codigoActual.value }
  if (personalizada) datos.entradaPersonalizada = entradaPersonalizada.value
  const res = await pedir('estudiante:probar', datos)
  pidiendo.value = null
  if (!res.ok) mensajeError.value = res.mensaje
}

async function enviar() {
  if (ocupado.value) return
  if (comp.value.intentosMax > 0) {
    const quedan = comp.value.intentosMax - miEstado.value.intentosFallidos
    const aviso = `¿Enviar tu solución en ${lenguajeLabel(lenguaje.value)}?\n\nSi no pasa todas las pruebas gastarás 1 de tus ${quedan} intento(s) restantes. Al agotarlos pasarás al siguiente ítem.`
    if (!confirm(aviso)) return
  }
  mensajeError.value = ''
  estado.cola = null
  pidiendo.value = 'enviar'
  pestanaConsola.value = 'resultado'
  const res = await pedir('estudiante:enviar', { problemaId: problema.value.id, lenguaje: lenguaje.value, codigo: codigoActual.value })
  pidiendo.value = null
  if (!res.ok) mensajeError.value = res.mensaje
}

// Llega el resultado de un Probar o un Enviar
watch(() => estado.resultado, (r) => {
  if (!r) return
  const actual = problema.value?.id
  if (r.tipo === 'prueba') {
    if (r.problemaId !== actual) return
    if (!r.ok) { mensajeError.value = r.mensaje; return }
    if (r.personalizada) resultadoPersonalizado.value = r
    else accion.value = { tipo: 'prueba', datos: r }
    return
  }
  // Envío de un reto que ya no está abierto (se le acabó el tiempo mientras esperaba en la cola)
  if (r.problemaId !== actual) {
    if (!r.ok) mostrarAviso(r.mensaje, 'aviso-tiempo', 'alert-triangle')
    else mostrarAviso(`Tu envío del reto «${r.titulo}» quedó: ${veredictoInfo(r.envio.veredicto).texto} · +${r.envio.puntos} pts`, r.envio.veredicto === 'ACEPTADO' ? 'aviso-ok' : 'aviso-tiempo', veredictoInfo(r.envio.veredicto).icono)
    return
  }
  if (!r.ok) { mensajeError.value = r.mensaje; return }
  accion.value = { tipo: 'envio', datos: r.envio }
  const { veredicto, puntos, puntosBase, bonus, pasadas, total } = r.envio
  if (veredicto === 'ACEPTADO') {
    avanceEsperado = true
    mostrarSammy('correcto', `¡Reto resuelto! +${puntos}`, bonus ? `${puntosBase} pts + ${bonus} por tiempo sobrante · Pasas al siguiente ítem...` : 'Pasas al siguiente ítem...')
  } else if (r.bloqueado) {
    avanceEsperado = true
    mostrarSammy('incorrecto', 'Sin intentos', `Conservas ${r.mejorPuntaje} pts. Pasas al siguiente ítem...`)
  } else if (veredicto !== 'COMPILACION') {
    // Error de compilación no gasta intentos: solo se muestra en la consola, sin la mascota
    mostrarSammy('incorrecto', veredictoInfo(veredicto).texto, `${pasadas} de ${total} pruebas ocultas · revisa la consola`)
  }
})

// ---------- Saltar un reto y volver a los pendientes ----------
async function saltar() {
  if (ocupado.value) return
  const aviso = `¿Saltar este reto?\n\nPasarás al siguiente ítem. Cuando termines los demás podrás volver a él con el tiempo que le queda (${formatoReloj(restanteMs.value)}). Lo que ya enviaste se conserva.`
  if (!confirm(aviso)) return
  mensajeError.value = ''
  avanceEsperado = true
  pidiendo.value = 'saltar'
  const res = await pedir('estudiante:saltar', { problemaId: problema.value.id })
  pidiendo.value = null
  if (!res.ok) { avanceEsperado = false; mensajeError.value = res.mensaje }
}

async function retomar(problemaId) {
  mensajeError.value = ''
  pidiendo.value = 'retomar'
  const res = await pedir('estudiante:retomar', { problemaId })
  pidiendo.value = null
  if (!res.ok) mensajeError.value = res.mensaje
}

async function finalizar() {
  if (!confirm('¿Terminar sin resolver los retos pendientes? Ya no podrás volver a ellos.')) return
  mensajeError.value = ''
  pidiendo.value = 'finalizar'
  const res = await pedir('estudiante:finalizar', {})
  pidiendo.value = null
  if (!res.ok) mensajeError.value = res.mensaje
}

// ---------- Resultados finales ----------
const resultadosPodio = computed(() =>
  (comp.value?.ranking || []).map(f => ({ id: f.codigoEstudiante, nombre: f.nombre, codigoEstudiante: f.codigoEstudiante, puntaje: f.puntos }))
)
const correctas = computed(() => (comp.value?.resumen || []).filter(r => r.tipo === 'pregunta' && r.esCorrecta).length)
const resueltos = computed(() => (comp.value?.resumen || []).filter(r => r.tipo === 'problema' && r.aceptado).length)

function volverInicio() {
  salir()
  router.push('/')
}

// ---------- Ciclo de vida ----------
function alCambiarVisibilidad() {
  if (comp.value?.estado === 'en-curso') avisarFoco(!document.hidden)
}

onMounted(async () => {
  reloj = setInterval(() => { ahora.value = Date.now() }, 250)
  document.addEventListener('visibilitychange', alCambiarVisibilidad)
  if (!estado.comp) {
    if (!leerSesion()) return router.replace('/')
    const r = await reingresar()
    if (!r.ok) errorInicio.value = r.mensaje || 'No se pudo volver a entrar a la competencia.'
  }
})

onBeforeUnmount(() => {
  clearInterval(reloj)
  clearTimeout(temporizadorAviso)
  clearTimeout(temporizadorSammy)
  document.removeEventListener('visibilitychange', alCambiarVisibilidad)
})
</script>

<style scoped>
.comp-page { min-height: 100vh; background: var(--color-bg); display: flex; flex-direction: column; }
.header-derecha { margin-left: auto; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; justify-content: flex-end; }
.chip-header { display: inline-flex; align-items: center; gap: 6px; background: rgba(255,255,255,0.15); padding: 5px 12px; border-radius: 20px; font-weight: 700; font-size: 14px; }
.chip-header.nombre { font-weight: 600; }
@keyframes latido { 50% { opacity: 0.75; } }

.centrado { padding-top: 80px; }
.cargando { display: flex; flex-direction: column; align-items: center; gap: 16px; color: var(--color-text-light); }
.texto-centro { text-align: center; }
.texto-suave { color: var(--color-text-light); }
.icono-aviso { color: var(--color-warning); margin-bottom: 8px; }

h2 { color: var(--color-primary); }
code { background: rgba(0,0,0,0.06); padding: 1px 5px; border-radius: 4px; font-size: 12px; }
.reglas { list-style: none; margin-top: 20px; padding-top: 16px; border-top: 1px solid var(--color-border); display: flex; flex-direction: column; gap: 10px; font-size: 14px; }
.reglas li { display: flex; gap: 10px; align-items: flex-start; }
.reglas li .icon { margin-top: 3px; color: var(--color-primary); }

/* --- Barra del ítem actual (reloj propio) --- */
.barra-item { display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap; background: white; border-bottom: 1px solid var(--color-border); padding: 10px 16px; position: sticky; top: 0; z-index: 5; }
.barra-item-texto { display: flex; gap: 6px; align-items: baseline; color: var(--color-primary); }
.reloj-item { display: flex; align-items: center; gap: 10px; min-width: 220px; font-weight: 800; font-size: 18px; font-variant-numeric: tabular-nums; color: var(--color-primary); }
.reloj-item span { display: inline-flex; align-items: center; gap: 6px; }
.reloj-item.urgente { color: var(--color-error); animation: latido 1s ease-in-out infinite; }
.timer-bar { flex: 1; height: 8px; background: var(--color-border); border-radius: 4px; overflow: hidden; }
.timer-fill { height: 100%; background: var(--color-accent); border-radius: 4px; transition: width 0.25s linear; }
.reloj-item.urgente .timer-fill { background: var(--color-error); }

.aviso { display: flex; align-items: center; gap: 8px; margin-top: 12px; padding: 10px 16px; border-radius: var(--radius-sm); font-weight: 600; font-size: 14px; }
.aviso-ok { background: var(--color-success-light); color: var(--color-success); }
.aviso-tiempo { background: #FFF3CD; color: #856404; }
.slide-up-enter-active { transition: all 0.3s ease; }
.slide-up-enter-from { opacity: 0; transform: translateY(-8px); }

/* --- Pregunta --- */
.badges { display: flex; gap: 6px; flex-wrap: wrap; }
.badge-puntos { background: rgba(32,44,69,0.1); color: var(--color-primary); }
.pregunta-card { margin-bottom: 16px; }
.enunciado-texto { font-size: 18px; line-height: 1.7; color: var(--color-text); white-space: pre-wrap; }
.enunciado-codigo { font-family: Consolas, 'Courier New', monospace; font-size: 14px; line-height: 1.7; white-space: pre-wrap; color: var(--color-text); background: var(--color-bg); padding: 16px; border-radius: var(--radius-sm); border: 1px solid var(--color-border); max-height: none; }
.opciones-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 16px; }
.opcion-btn { display: flex; align-items: center; gap: 12px; padding: 16px 20px; background: white; border: 2px solid var(--color-border); border-radius: var(--radius-md); cursor: pointer; text-align: left; font-size: 15px; font-family: inherit; color: var(--color-text); transition: border-color 0.12s ease, background-color 0.12s ease; }
.opcion-btn:hover:not(:disabled) { border-color: var(--color-primary); background: rgba(32,44,69,0.04); }
.opcion-btn:disabled { cursor: not-allowed; }
.opcion-btn.elegida { border-color: var(--color-primary); background: rgba(32,44,69,0.08); }
.opcion-letra { width: 32px; height: 32px; border-radius: 50%; background: var(--color-bg); display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 13px; color: var(--color-primary); flex-shrink: 0; }
.opcion-btn.elegida .opcion-letra { background: var(--color-primary); color: white; }
.opcion-texto { flex: 1; white-space: pre-wrap; }
@media (max-width: 540px) { .opciones-grid { grid-template-columns: 1fr; } }

/* --- Reto --- */
.reto-layout { width: 100%; max-width: 1440px; margin: 0 auto; padding: 16px; flex: 1; }
.reto-grid { display: grid; grid-template-columns: minmax(0, 5fr) minmax(0, 7fr); gap: 12px; align-items: start; }
@media (max-width: 1100px) { .reto-grid { grid-template-columns: 1fr; } }
.panel-enunciado { position: sticky; top: 64px; max-height: calc(100vh - 80px); overflow-y: auto; }
@media (max-width: 1100px) { .panel-enunciado { position: static; max-height: none; } }
.enunciado-cabecera { margin-bottom: 12px; padding-bottom: 12px; border-bottom: 1px solid var(--color-border); }
.enunciado-cabecera h2 { font-size: 20px; margin-bottom: 8px; }
.tema { font-size: 13px; color: var(--color-text-light); margin-top: 6px; }
.enunciado { white-space: pre-wrap; font-size: 15px; line-height: 1.65; margin-bottom: 8px; }
.panel-enunciado h4 { font-size: 15px; font-weight: 700; color: var(--color-primary); margin: 20px 0 6px; }
.ejemplo { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 8px; }
.ejemplo-label { font-size: 12px; font-weight: 600; color: var(--color-text-light); margin-bottom: 4px; display: block; }
pre { background: #F3F5F9; border: 1px solid var(--color-border); border-radius: 6px; padding: 8px 10px; font-family: Consolas, 'Cascadia Code', monospace; font-size: 13px; white-space: pre-wrap; word-break: break-word; max-height: 220px; overflow: auto; margin: 0; }
.nota-pruebas { display: flex; gap: 10px; align-items: flex-start; margin-top: 12px; padding: 12px; background: rgba(32,44,69,0.05); border-radius: var(--radius-sm); font-size: 13px; color: var(--color-text-light); }
.nota-pruebas .icon { margin-top: 2px; color: var(--color-primary); }

.panel-trabajo { display: flex; flex-direction: column; gap: 12px; min-width: 0; }
.editor-card { padding: 12px; display: flex; flex-direction: column; gap: 10px; }
.editor-toolbar { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.select-lenguaje { width: auto; padding: 6px 10px; font-size: 14px; font-weight: 600; }
.estado-problema { font-size: 13px; color: var(--color-text-light); }
.btn-plantilla { margin-left: auto; padding: 6px 12px; }
.editor-wrap { height: 420px; }
.editor-acciones { display: flex; align-items: center; gap: 8px; justify-content: flex-end; flex-wrap: wrap; }
.ayuda-acciones { font-size: 12px; margin-right: auto; }

.consola { padding: 0; overflow: hidden; }
.consola-tabs { display: flex; border-bottom: 1px solid var(--color-border); background: #FAFBFC; overflow-x: auto; }
.consola-tabs button { display: inline-flex; align-items: center; gap: 6px; padding: 10px 14px; border: none; background: none; font-family: inherit; font-size: 13px; font-weight: 600; color: var(--color-text-light); cursor: pointer; border-bottom: 2px solid transparent; white-space: nowrap; }
.consola-tabs button.activo { color: var(--color-primary); border-bottom-color: var(--color-accent); }
.contador { background: var(--color-primary); color: white; border-radius: 10px; padding: 0 7px; font-size: 11px; }
.consola-cuerpo { padding: 14px; min-height: 140px; }
.vacio { text-align: center; padding: 24px 0; font-size: 14px; }
.ejecutando { display: flex; align-items: center; gap: 12px; padding: 20px 0; color: var(--color-text-light); }
.spinner-sm { width: 24px; height: 24px; border-width: 3px; }

.veredicto { display: flex; align-items: center; gap: 12px; padding: 12px 14px; border-radius: var(--radius-sm); font-size: 15px; }
.veredicto-puntos { margin-left: auto; font-weight: 800; font-size: 18px; text-align: right; }
.veredicto-bonus { display: block; font-size: 12px; font-weight: 600; opacity: 0.8; }
.v-aceptado { background: var(--color-success-light); color: var(--color-success); }
.v-parcial { background: #FFF3CD; color: #856404; }
.v-error { background: var(--color-error-light); color: var(--color-error); }
.v-compilacion { background: #E9EDF5; color: var(--color-primary); }
.barra-pruebas { display: flex; gap: 4px; margin: 10px 0; }
.barra-pruebas span { flex: 1; height: 8px; border-radius: 4px; background: var(--color-error-light); }
.barra-pruebas span.ok { background: var(--color-success); }
.salida-error { background: #FFF5F5; border-color: #F3C7C4; color: #8A1F17; margin-top: 8px; }

.caso { border: 1px solid var(--color-border); border-radius: var(--radius-sm); padding: 10px; margin-bottom: 8px; }
.caso-ok { border-color: #CFE5C2; background: #FAFDF8; }
.caso-mal { border-color: #F3C7C4; background: #FFFAFA; }
.caso-titulo { display: flex; align-items: center; gap: 6px; font-weight: 700; font-size: 14px; margin-bottom: 8px; }
.caso-ok .caso-titulo { color: var(--color-success); }
.caso-mal .caso-titulo { color: var(--color-error); }
.caso-ms { margin-left: auto; font-weight: 400; font-size: 12px; color: var(--color-text-light); }
.caso-columnas { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
@media (max-width: 640px) { .caso-columnas, .ejemplo { grid-template-columns: 1fr; } }
.entrada-personalizada { font-family: Consolas, monospace; font-size: 14px; resize: vertical; }

.tabla-envios, .tabla-ranking { width: 100%; border-collapse: collapse; font-size: 14px; }
.tabla-envios th, .tabla-ranking th { text-align: left; font-size: 13px; font-weight: 600; color: var(--color-text-light); padding: 8px; border-bottom: 1px solid var(--color-border); }
.tabla-envios td, .tabla-ranking td { padding: 8px; border-bottom: 1px solid var(--color-border); }
.chip-veredicto { padding: 3px 10px; border-radius: 12px; font-size: 12px; font-weight: 700; white-space: nowrap; }

/* --- Resultados --- */
.hero-final { padding: 32px 24px; }
.icono-trofeo { color: var(--color-warning); }
.posicion-final { font-size: 18px; margin-top: 4px; }
.posicion-final strong { color: var(--color-accent); font-size: 26px; }
.resumen-final { display: flex; justify-content: center; gap: 32px; margin-top: 20px; flex-wrap: wrap; }
.resumen-final div { display: flex; flex-direction: column; align-items: center; }
.resumen-final .numero { font-size: 30px; font-weight: 800; color: var(--color-primary); font-variant-numeric: tabular-nums; }
.resumen-final span:not(.numero) { font-size: 13px; color: var(--color-text-light); }
.tabla-ranking { margin-top: 16px; }
.tabla-ranking tr.yo { background: rgba(242,24,79,0.07); font-weight: 700; }
.revision { border: 1px solid var(--color-border); border-radius: var(--radius-sm); padding: 12px; margin-bottom: 10px; }
.rev-ok { border-color: #CFE5C2; }
.rev-parcial { border-color: #EBD9A0; }
.rev-mal { border-color: #F3C7C4; }
.revision-cabecera { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; margin-bottom: 8px; }
.revision-num { width: 24px; height: 24px; border-radius: 50%; background: var(--color-primary); color: white; display: inline-flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 700; }
.revision-puntos { margin-left: auto; color: var(--color-primary); }
.revision-enunciado { white-space: pre-wrap; font-size: 14px; }
.revision .enunciado-codigo { font-size: 13px; padding: 10px; }
.revision-respuesta { font-size: 14px; margin-top: 8px; display: flex; align-items: center; gap: 4px; flex-wrap: wrap; }
.revision-explicacion { font-size: 13px; margin-top: 4px; }

/* --- Sammy (resultado de la respuesta) --- */
.sammy-overlay { position: fixed; inset: 0; z-index: 50; display: flex; align-items: center; justify-content: center; padding: 16px; background: rgba(16,22,34,0.45); cursor: pointer; }
.sammy-tarjeta { background: white; border-radius: var(--radius-lg); padding: 20px 28px 24px; box-shadow: var(--shadow-lg); text-align: center; max-width: 100%; }
.sammy-tarjeta sammy-mascota { --sammy-tam: min(240px, 60vw); }
.sammy-detalle { margin-top: 6px; color: var(--color-text-light); font-size: 14px; font-weight: 600; }
.sammy-enter-active, .sammy-leave-active { transition: opacity 0.2s ease; }
.sammy-enter-active .sammy-tarjeta { transition: transform 0.3s cubic-bezier(.16, 1, .3, 1); }
.sammy-enter-from, .sammy-leave-to { opacity: 0; }
.sammy-enter-from .sammy-tarjeta { transform: scale(0.85); }
.badge-retomado { background: #EDE9FE; color: #5B21B6; margin-left: 6px; }

/* Retos pendientes (saltados) */
.pendientes-lista { display: flex; flex-direction: column; gap: 10px; margin-top: 20px; }
.pendiente { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 12px 14px; border: 1px solid var(--color-border); border-radius: var(--radius-sm); flex-wrap: wrap; }
.pendiente-info { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.pendiente-info .texto-suave { font-size: 13px; display: inline-flex; align-items: center; gap: 4px; flex-wrap: wrap; }

/* Botón saltar: discreto, para no invitar a usarlo sin pensar */
.btn-saltar { background: transparent; color: var(--color-text-light); border: 1px dashed var(--color-border); }
.btn-saltar:hover:not(:disabled) { color: #5B21B6; border-color: #7C3AED; background: #F5F3FF; }

/* Cómo leer la entrada */
.lectura-entrada { margin: 10px 0 4px; padding: 12px; border-radius: var(--radius-sm); background: #F6F8FC; border: 1px solid var(--color-border); }
.lectura-titulo { display: flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 700; color: var(--color-primary); margin-bottom: 8px; }
.lectura-lineas { display: flex; flex-direction: column; gap: 4px; }
.lectura-linea { display: grid; grid-template-columns: 64px minmax(0, 1fr) auto; align-items: center; gap: 8px; font-size: 13px; }
.lectura-num { color: var(--color-text-light); font-weight: 600; font-size: 12px; }
.lectura-texto { font-family: Consolas, 'Cascadia Code', monospace; background: white; border: 1px solid var(--color-border); border-radius: 4px; padding: 2px 8px; white-space: pre; overflow-x: auto; font-size: 13px; }
.lectura-valores { font-size: 12px; color: var(--color-text-light); white-space: nowrap; }
.lectura-mas { font-size: 12px; padding-left: 72px; }
.lectura-ayuda { margin-top: 10px; font-size: 13px; line-height: 1.55; }

/* Completar: un color por espacio, en el código y en las opciones */
.ayuda-completar { font-size: 13px; margin: -4px 0 10px; }
.espacio { display: inline-block; padding: 0 6px; border-radius: 4px; font-weight: 800; border: 1.5px solid currentColor; }
.opcion-partes { display: flex; flex-wrap: wrap; gap: 6px; }
.ficha { display: inline-flex; align-items: center; gap: 6px; padding: 3px 10px 3px 4px; border-radius: 6px; font-family: Consolas, 'Cascadia Code', monospace; font-size: 14px; border: 1.5px solid currentColor; }
.ficha b { display: inline-flex; align-items: center; justify-content: center; min-width: 20px; height: 20px; border-radius: 4px; color: white; font-family: var(--font-main); font-size: 12px; }
.espacio-1 { color: #1D4ED8; background: #DBEAFE; }
.espacio-2 { color: #B45309; background: #FEF3C7; }
.espacio-3 { color: #047857; background: #D1FAE5; }
.espacio-4 { color: #7C3AED; background: #EDE9FE; }
.espacio-5 { color: #BE185D; background: #FCE7F3; }
.ficha.espacio-1 b { background: #1D4ED8; }
.ficha.espacio-2 b { background: #B45309; }
.ficha.espacio-3 b { background: #047857; }
.ficha.espacio-4 b { background: #7C3AED; }
.ficha.espacio-5 b { background: #BE185D; }
</style>
