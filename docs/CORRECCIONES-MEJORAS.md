# Correcciones y mejoras

Registro de todos los cambios hechos al proyecto **Hello World · ACEIS**, del más reciente al más antiguo.
Cada entrada indica la fecha, qué problema había, qué se hizo y qué archivos se tocaron.

---

## 2026-11-08 — Correcciones tras la prueba con 20 estudiantes

**Tipo:** Corrección de errores + mejoras pedidas

### 1. Envíos que se quedaban "pegados" con muchos estudiantes

**Qué pasaba:** con unas 20 personas programando a la vez, algunos estudiantes veían "Espera N s para enviar", esperaban, volvían a enviar y no pasaba nada; a otros la pantalla se les quedaba en "Calificando…" y no los dejaba enviar.

**Causa (reproducida con una simulación de 20 estudiantes):**

1. Si el estudiante enviaba cerca del final del tiempo, su envío quedaba esperando en la cola. Se acababa el tiempo, pasaba al siguiente reto y ahí el servidor respondía *"Ya tienes un envío en evaluación"* hasta que terminaba el envío viejo. Después respondía *"Espera N s"*, porque la espera entre envíos se contaba aunque fuera **otro** reto.
2. En la pantalla, el estado "Calificando…" no se limpiaba al cambiar de ítem: el reto nuevo quedaba con los botones deshabilitados.
3. Si la calificación tardaba más de 2 minutos (cola larga), el navegador dejaba de esperar la respuesta, pero el servidor seguía calificando y bloqueaba nuevos envíos.
4. Los "Probar" (ilimitados) compartían la cola con los envíos, así que los envíos esperaban detrás de muchas pruebas.
5. El límite de 2 s de cada programa se medía en tiempo de reloj. Con el PC saturado, un programa correcto podía pasarse y salía **"Tiempo excedido"**, gastando un intento.

**Qué se hizo:**

- **Probar y Enviar ya no esperan la calificación** ([index.js](../server/competencia/index.js)): el servidor confirma al instante, el estudiante ve su posición en la cola y el resultado llega aparte (`competencia:resultado`). Lo que se está calificando viaja en su estado, así que sobrevive a recargar la página o a que se caiga el WiFi.
- Si el tiempo del reto se acaba mientras el envío espera, **se califica igual** y el resultado se le muestra como aviso en el ítem siguiente. Mientras tanto, la pantalla explica qué está pasando en vez de quedarse pegada.
- **La espera entre envíos** baja a 3 s, solo aplica a reenvíos **del mismo reto** y se cuenta desde que termina la calificación anterior.
- **Prioridad en la cola** ([cola.js](../server/competencia/cola.js)): los envíos pasan antes que los "Probar".
- **Límite por tiempo de CPU** ([ejecutor.js](../server/competencia/ejecutor.js)): el límite del reto se aplica al tiempo de CPU, con 6 s de margen de reloj. [docker-compose.yml](../piston/docker-compose.yml) amplía los límites de Piston (**hay que ejecutar `npm run piston:up`**). Si Piston no se ha actualizado, el servidor usa los límites básicos y el panel del profesor lo avisa.
- Pruebas nuevas: [prueba-carga.js](../server/competencia/prueba-carga.js) (20 estudiantes, motor lento, el caso del reto que vence en la cola) y `npm run prueba` las corre todas.

### 2. Saltar retos y volver a ellos al final

- Botón **Saltar reto** en cada reto de programación (las preguntas no se saltan). El reto queda pendiente con **el tiempo que le quedaba** y lo que ya había enviado.
- Al terminar los demás ítems, el estudiante ve **"Te faltan N retos"**, con el tiempo restante de cada uno: **Resolver ahora** o **Terminar sin resolverlos**. Puede volver a saltar un reto retomado.
- Al retomar, el reloj sigue donde quedó; el bonus usa el tiempo que le sobre y el tiempo ya usado cuenta para el desempate.
- La competencia no termina sola mientras alguien esté eligiendo pendientes (el profesor puede terminarla). En el panel se ve "eligiendo pendientes", "retomado" y cuántos retos saltados tiene cada uno.
- Prueba: [prueba-saltar.js](../server/competencia/prueba-saltar.js).

### 3. Preguntas donde la respuesta larga delataba la correcta

En 10 de las 23 preguntas de opción múltiple, la correcta era **la única opción larga** (traía la explicación: "…porque…", "…así que…"). Se reescribieron las opciones de F1, F2, F3, F7, F8, M7, D4, D5, D6 y R5. La correcta conserva su letra y su significado, y los distractores se alargaron con razonamientos plausibles pero equivocados. Ahora en **ninguna** pregunta la correcta es la única más larga.

### 4. Comentarios de los estudiantes

- **Ya no se muestra la dificultad** (ni la ronda) al estudiante, para que no se desanime antes de leer. El profesor la sigue viendo.
- **Completar con varios espacios:** cada espacio `__(1)__` del código y su parte en las opciones tienen **el mismo número y color**; un `/` o un `·` ya no se confunde con la respuesta.
- **Explicación de las entradas:** debajo del formato de entrada se ve la entrada del ejemplo **línea por línea** (cuántos valores trae cada una) y cómo leerla en el lenguaje elegido. Los 4 retos tienen una explicación propia (`ayuda_entrada`) para Python y C++.

**Archivos:** `server/competencia/{index,cola,ejecutor,ranking,prueba-competencia,prueba-saltar,prueba-carga}.js`, `server/data/banco_preguntas.json`, `server/data/banco_problemas.json`, `piston/docker-compose.yml`, `server/.env.example`, `client/src/views/{VistaCompetencia,VistaAdmin}.vue`, `client/src/composables/useCompetencia.js`, `client/src/utils/completar.js`, `package.json`, `README.md`.

---

## 2026-10-30 — Banco de la Copa Hello World (Fase 2) cargado en el sistema

**Tipo:** Contenido (bancos de preguntas y retos)

**Qué se pidió:** cargar los ejercicios del documento *"Copa Hello World · Fase 2 · Ejercicios para el evento"* (equipo académico, evento del 9 de noviembre de 2026), porque son los que se usarán en el torneo:

- Lo que sirva como pregunta, como pregunta.
- Lo que se pueda resolver programando, como reto.
- Algunos de completar código, en selección múltiple.

**Qué se hizo:**

- **[banco_preguntas.json](../server/data/banco_preguntas.json): 25 preguntas**, con el código, la dificultad, el puntaje (15 / 20 / 30) y el tiempo exactos del documento. La explicación de cada una sale de la clave de respuestas.
  - **Ya eran de selección:** F1, F2, F3, M4, D3, D4, R3, R4 y R5 quedaron tal cual.
  - **Abiertas convertidas a selección múltiple:** se escribieron 4 opciones con la respuesta de la clave y distractores basados en errores típicos.
    - **¿Qué imprime?:** F6, M5, M6, D7 y las de desempate R1, R2.
    - **Ordenar:** F4.
    - **Relacionar:** F5, M2, M3.
    - **Encontrar el error:** F7, F8, M7, D5, D6.
  - **Completar código (selección múltiple):** M1. Las opciones combinan los dos espacios (por ejemplo `(1) != 0 · (2) suma + numero`).
- **[banco_problemas.json](../server/data/banco_problemas.json): 4 retos de programación.** Son los ejercicios que el documento pedía responder en hoja y que se pueden resolver como programa:
  - **M8 · Contar positivos** (Media, 20 pts, 4 min): lee 5 números y cuenta los mayores que 0.
  - **D1 · La tienda de la asociación** (Difícil, 30 pts, 7 min): lee códigos hasta 0; muestra `Codigo invalido` (sin tildes, para que el teclado no sea un problema), el total recaudado y las unidades de cada producto.
  - **D2 · El mejor vendedor** (Difícil, 30 pts, 6 min): lee la matriz 5 × 4; muestra el total de cada vendedor y el mejor. Si hay empate, gana el de menor número.
  - **R6 · Edades válidas** (Reserva difícil, 30 pts, 6 min): lee edades hasta -1 y cuenta las que están entre 0 y 120.

  Cada reto tiene 1 ejemplo y 6 pruebas ocultas con casos límite: todo cero, todo inválido, empates, valores máximos y la entrada que es solo el final. Las salidas se calcularon con soluciones de referencia.
- **Rondas:** el campo `tema` de cada ítem dice su ronda (`Ronda 1 · Calentamiento`, `Ronda 2 · Media`, `Ronda 3 · Difícil`) o su uso (`Desempate`, `Reserva`). En el panel, el filtro "Todas las rondas" y el botón "Seleccionar las N visibles" permiten armar una competencia por ronda.
- **Panel del profesor** ([VistaAdmin.vue](../client/src/views/VistaAdmin.vue)): se muestra el código del documento (F1, M2, D1…) en cada pregunta y reto, y se incluye en el Excel.
- **Bancos anteriores:** se reemplazaron las 30 preguntas y los 8 retos de práctica. Siguen en el historial de git (`git show 6ce4e85:server/data/banco_preguntas.json`).

**Diferencias con el documento (para revisar en la reunión):**

- **Sin puntaje parcial en las preguntas:** F5 (3 pts por relación) y M1 (10 pts por espacio) ahora son de selección múltiple: la opción completa vale todo o nada.
- **Retos en Python/C++ en vez de pseudocódigo en hoja:** M8, D1, D2 y R6 ahora se califican con pruebas ocultas; su puntaje es proporcional a las pruebas que pasen. D2 ya no evalúa por separado el planteamiento (a, b, c, d), sino que el programa funcione.
- **Tiempos de los retos:** se dejaron los del documento (4, 7, 6 y 6 min), pensados para responder en papel. Escribir y probar código suele tomar más; si se quiere dar más tiempo, se cambia `tiempo_minutos` en el banco.
- **Bonus por rapidez:** se mantiene (hasta +50 % en las preguntas), así que el puntaje máximo de cada pregunta es mayor que el del documento.

**Cómo se verificó:**

- Una solución de estudiante en Python para cada reto, que usa incluso `input("mensaje")`, pasa sus 7 pruebas (ejemplo y ocultas) con el envoltorio real del juez.
- Todas las preguntas tienen una respuesta correcta válida, tiempo, explicación y ronda.
- El tiempo total coincide con el documento: 54 min de preguntas de ronda + 17 min de retos = 71 min.
- Prueba de punta a punta con el servidor real y el banco nuevo (F1, F6, D7 + reto D1):
  - Imprimir fijo el resultado del ejemplo da 0 puntos.
  - La solución correcta da Aceptado, 30 puntos.
- `npm run prueba` y `npm run build` pasan.

---

## 2026-10-24 — Mascota Sammy: animaciones de correcto / incorrecto y página 401

**Tipo:** Mejora

**Qué se pidió:** usar el Web Component `sammy.js` para mostrar una animación cuando el estudiante responde bien o mal, y cuando intenta entrar a la API de las preguntas.

**Qué se hizo:**

- **Componente:** se agregó [client/src/components/sammy.js](../client/src/components/sammy.js) tal como fue entregado, sin cambios.
  - Se registra una sola vez en [main.js](../client/src/main.js).
  - En [vite.config.js](../client/vite.config.js) se marca `sammy-mascota` como elemento nativo (`isCustomElement`), para que Vue no lo trate como un componente suyo.
- **Correcto / incorrecto** ([VistaCompetencia.vue](../client/src/views/VistaCompetencia.vue)): al responder una pregunta aparece Sammy en una ventana sobre la pantalla.
  - **Correcto:** salta con confeti y muestra los puntos ganados, separando el bonus por rapidez.
  - **Incorrecto:** llora bajo su nube.
  - **Retos:** también aparece al enviar código. Celebra si se resolvió y se pone triste si no pasó todas las pruebas o si se agotaron los intentos. Los errores de compilación solo se muestran en la consola, porque no gastan intentos.
  - Se cierra sola a los 2,5 s o con un clic.
- **Servidor** ([server/competencia/index.js](../server/competencia/index.js)):
  - Al responder, ahora devuelve si la respuesta fue correcta y los puntos. **No dice cuál era la opción correcta:** eso se sigue revelando al final, para que no se pueda pasar la respuesta a un compañero.
  - Después de responder (o de cerrar un reto) espera **2 s** (`pausaResultadoMs`) antes de abrir el siguiente ítem. Así la animación no le quita tiempo al siguiente: su reloj empieza cuando termina la pausa.
  - Durante esa pausa no se puede responder dos veces la misma pregunta.
- **Página 401:**
  - Si alguien abre la API desde el navegador, por ejemplo `/api/preguntas` o `/api/admin/banco` sin ser el profesor, el servidor responde **401** con [VistaNoAutorizado.vue](../client/src/views/VistaNoAutorizado.vue): Sammy enojado con el candado y "Error 401 · No autorizado".
  - Las peticiones del panel (fetch) siguen recibiendo JSON.
  - Cualquier otra ruta desconocida bajo `/api/` también responde 401, en vez de devolver la página de inicio ([server/index.js](../server/index.js)).

**Cómo se verificó:**

- `npm run prueba` cubre lo nuevo:
  - La respuesta indica si acertó, pero no cuál era la correcta.
  - No se puede responder dos veces durante la pausa.
  - El ítem no cambia hasta que termina la pausa.
- Prueba de punta a punta:
  - `/api/preguntas` y `/api/admin/banco` responden 401: la página de Sammy si se piden como navegador y JSON si se piden desde el panel.
  - El recorrido completo funciona con la pausa de 2 s.
- Captura con el navegador Edge en modo sin ventana: la página 401 muestra a Sammy correctamente.
- `npm run build` compila sin errores.

---

## 2026-10-24 — Una sola competencia: preguntas y retos mezclados, cada ítem con su tiempo

**Tipo:** Rediseño (mejora) + corrección del calificador

**Qué se pidió:**

1. Cada pregunta y cada reto debe tener **su propio tiempo**; el profesor no debe fijar un tiempo único, porque depende de la dificultad.
2. Quiz y reto **no deben ser modos separados**: el día del evento el profesor elige preguntas y retos, y a los estudiantes les salen juntos.
3. A cada estudiante le deben salir **en desorden**, no en el mismo orden que a los demás.
4. Cuando a un estudiante se le acaba el tiempo de un ítem, el sistema **lo pasa automáticamente** al siguiente.
5. El calificador tenía dos problemas:
   - En *"Suma de dos números"*, `c = 10` + `print(10)` sacaba puntos.
   - Un código con `a = input("Ingrese un numero")` y `b = input(...)` fallaba con `EOFError: EOF when reading a line`.

**Diagnóstico del punto 5:**

- **`print(10)`:** "Probar" solo usa el ejemplo visible (`3 7 → 10`), así que parecía correcto. "Enviar" sí corría las pruebas ocultas, pero el ejemplo visible también daba puntos: pasaba 1 de 6 pruebas y sacaba **17 de 100 puntos** sin resolver nada.
- **`EOFError`:** la entrada del problema viene en **una sola línea** (`3 7`). El código hacía dos `input()`: el primero leía `"3 7"` y el segundo no encontraba más líneas. Además:
  - El texto de `input("Ingrese un numero")` se imprimía en la salida, así que nunca podía coincidir con la respuesta esperada.
  - `a + b` con textos da `"37"`, no `10`.

  El calificador no estaba fallando, pero el mensaje no ayudaba a un principiante a entender qué pasaba.

**Qué se hizo:**

- **Modelo nuevo: una sola competencia** ([server/competencia/index.js](../server/competencia/index.js)):
  - El profesor crea la competencia eligiendo preguntas y retos del banco.
  - Al iniciar, **cada estudiante recibe todos los ítems mezclados al azar** (algoritmo Fisher–Yates), con un orden distinto para cada uno. Quien entra tarde empieza su recorrido al entrar.
  - Se ve **un ítem a la vez** y no se puede volver atrás ni saltar:
    - **Pregunta:** al responder pasa a la siguiente. Si se acaba el tiempo, cuenta como no respondida y avanza sola.
    - **Reto:** avanza cuando lo resuelve al 100 %, cuando agota sus intentos o cuando se acaba su tiempo (conserva su mejor puntaje). Un envío hecho a tiempo se califica aunque el tiempo venza mientras se evalúa.
  - El servidor lleva el reloj de cada estudiante y de cada ítem, así que no depende del navegador.
  - La competencia **termina sola cuando todos terminan** su recorrido (o cuando el profesor pulsa Terminar).
  - Las respuestas correctas y el ranking **se revelan al final**. Así un estudiante no puede pasarle la respuesta a otro al que todavía no le ha salido esa pregunta.
  - El progreso se guarda en `server/data/competencias-guardadas.json`. Si el servidor se reinicia, se recupera, y los ítems cuyo tiempo venció mientras estaba apagado avanzan solos.
  - El bonus por rapidez de las preguntas (+50 % máx.) ahora se calcula con el tiempo propio de cada pregunta.
- **Tiempo propio por ítem:**
  - Se agregó `tiempo_segundos` a cada pregunta en [banco_preguntas.json](../server/data/banco_preguntas.json): fácil 45 s, medio 60 s, difícil 90 s.
  - Se agregó `tiempo_minutos` a cada reto en [banco_problemas.json](../server/data/banco_problemas.json): fácil 15 min, medio 20 min, difícil 30 min.
  - Se pueden editar uno por uno. Si un ítem no tiene tiempo, se usa el de su nivel.
  - El profesor ya no configura duración ni temporizador.
- **Calificador** ([calificador.js](../server/competencia/calificador.js)): **solo las pruebas ocultas dan puntos.** Los ejemplos visibles siguen siendo obligatorios para el veredicto "Aceptado", pero no suman. Ahora `print(10)` saca **0 puntos**.
- **Ejecutor** ([ejecutor.js](../server/competencia/ejecutor.js)):
  - En Python, el código del estudiante corre dentro de un pequeño envoltorio que hace que `input("mensaje")` **no imprima el mensaje**. Así no se mezcla con la respuesta.
  - Los errores se muestran limpios, como si vinieran de `main.py` y solo con las líneas del estudiante.
  - Se agregan **pistas en español** para dos casos:
    - `EOFError`: explica que la entrada viene en una línea y muestra `a, b = map(int, input().split())`.
    - Sumar texto con números: recuerda usar `int()`.
- **Ranking** ([ranking.js](../server/competencia/ranking.js)):
  - Suma preguntas y retos.
  - Desempata por el tiempo que tardó en cada pregunta acertada y en lograr su mejor puntaje en cada reto.
  - Muestra el progreso de cada estudiante.
- **Servidor** ([server/index.js](../server/index.js)):
  - Se eliminó el modo quiz sincronizado (estilo Kahoot, donde el profesor pasaba las preguntas).
  - El banco completo se pide por `GET /api/admin/banco`, protegido con el token del profesor.
- **Pantallas:**
  - [VistaAdmin.vue](../client/src/views/VistaAdmin.vue): un solo panel.
    - Para elegir preguntas, con filtros por nivel, tipo y tema, y retos. Cada ítem muestra su tiempo.
    - Muestra los puntos posibles y el tiempo máximo por estudiante.
    - Monitor en vivo con el progreso de cada estudiante.
    - Excel con tres hojas: Ranking, Preguntas (respuesta de cada estudiante) y Envíos.
  - [VistaCompetencia.vue](../client/src/views/VistaCompetencia.vue): el estudiante ve el ítem actual con su barra de tiempo.
    - Avisos al pasar de ítem: respuesta registrada, reto resuelto, sin intentos o tiempo agotado.
    - Al final: podio, ranking y revisión de cada pregunta con la respuesta correcta y la explicación.
  - [VistaIngreso.vue](../client/src/views/VistaIngreso.vue): una sola entrada para la competencia.
- **Archivos renombrados:**
  - `server/retos/` → `server/competencia/`
  - `useQuiz.js` → `useSocket.js` (solo la conexión)
  - `useReto.js` → `useCompetencia.js`
  - `VistaReto.vue` → `VistaCompetencia.vue`
  - `VistaAdminRetos.vue` → `VistaAdmin.vue`
- **Archivos eliminados:** el panel del quiz anterior, `VistaSala.vue` y `VistaResultadosEstudiante.vue`. La reconexión del quiz de la entrada anterior ya no aplica: la nueva competencia tiene la suya.
- **Documentación:** se reescribió el [README](../README.md) con el nuevo flujo, los campos de tiempo, las reglas de calificación y la solución al error de cgroup.

**Cómo se verificó:**

- `npm run prueba` ([prueba-competencia.js](../server/competencia/prueba-competencia.js)): prueba automática de las reglas, sin Piston. Revisa:
  - El orden distinto entre 12 estudiantes.
  - Que las preguntas no revelan la respuesta.
  - Que `print(10)` da 0 puntos y que una solución correcta avanza.
  - Que no se puede volver atrás.
  - El avance automático al vencer el tiempo.
  - La recuperación tras reiniciar el servidor.
  - El fin automático cuando todos terminan.
  - El ranking.

  Pasó 5 de 5 veces seguidas.
- **Prueba de punta a punta:** servidor real con un Piston simulado que ejecuta Python de verdad. Con los códigos exactos del reporte:
  - El código con dos `input()` da error de ejecución, con la pista y el traceback limpio.
  - `print(10)` da 0 puntos sobre 5 pruebas ocultas.
  - `a, b = map(int, input("Ingrese dos numeros: ").split())` da **Aceptado, 100 puntos**: el mensaje de `input()` se ignora.
  - El recorrido completo de 4 ítems termina la competencia y revela las respuestas.
- `npm run build` compila sin errores.

**Pendiente / notas:**

- Esto **no se ha probado todavía con el Piston real**, porque en este equipo seguía sin arrancar por el error de cgroup. Cuando Piston funcione, conviene correr `npm run piston:prueba` y hacer una competencia de prueba con un reto en Python y otro en C++.
- El archivo viejo `server/data/retos-guardados.json` ya no se usa y se puede borrar.

---

## 2026-10-24 — Reconexión en el modo Quiz (estudiante y profesor)

> ⚠️ **Reemplazado** por la entrada "Una sola competencia" (misma fecha). El modo quiz se eliminó; la competencia nueva tiene su propia reconexión.

**Tipo:** Mejora / corrección

**Problema:** el modo reto ya soportaba recargas y caídas del WiFi, pero el modo quiz no:

- **Estudiante:** si recargaba la página o se le caía el WiFi, perdía su sesión. Al intentar entrar de nuevo, el servidor lo rechazaba con *"Ya hay un participante con ese código de estudiante"* (en la sala de espera) o con *"El quiz ya inició"* (durante el quiz). Perdía el resto de la competencia.
- **Profesor:** si recargaba el panel, perdía el control de la sala. El servidor seguía enviando los avisos a la conexión vieja y no había forma de volver a tomar la sala para pasar de pregunta o terminar el quiz.

**Qué se hizo:**

- **Servidor** ([server/index.js](../server/index.js)):
  - Al entrar a una sala, si ya existe un participante con el **mismo código de estudiante y el mismo nombre** (sin importar mayúsculas ni espacios repetidos), se trata como un **reingreso**: conserva su puntaje y sus respuestas, aunque el quiz ya haya iniciado o terminado. Con otro nombre se sigue rechazando, así nadie puede tomar el lugar de otro por error.
  - La respuesta al entrar incluye lo necesario para retomar: estado de la sala, pregunta actual, tiempo restante, si ya respondió (con su retroalimentación) y los resultados si el quiz terminó.
  - Cada participante tiene ahora un `id` fijo y un `socketId` (su conexión actual). Solo la conexión más reciente puede responder; una pestaña vieja queda bloqueada.
  - Se registra si cada participante está conectado o no.
  - Nuevo evento `admin:reconectar-sala` (exige el token del profesor): el panel vuelve a tomar el control de la sala y recibe todo su estado (preguntas, participantes, pregunta actual, tiempo, resultados).
  - Los resultados finales se guardan en la sala, para entregarlos a quien vuelva a entrar después de terminar.
  - Se reutiliza `mismoNombre` del módulo de retos ([server/retos/index.js](../server/retos/index.js)) para comparar nombres igual que en el modo reto.
- **Cliente:**
  - [useQuiz.js](../client/src/composables/useQuiz.js): guarda la sesión del estudiante en `sessionStorage`. Las nuevas funciones `aplicarIngreso()` y `reingresar()` restauran el estado y llevan a la pantalla correcta. Al reconectarse el socket, el estudiante vuelve a entrar solo.
  - [VistaIngreso.vue](../client/src/views/VistaIngreso.vue): usa `aplicarIngreso()`. Si el estudiante escribe de nuevo sus mismos datos, retoma donde iba.
  - [VistaSala.vue](../client/src/views/VistaSala.vue) y [VistaResultadosEstudiante.vue](../client/src/views/VistaResultadosEstudiante.vue): al recargar, reingresan con la sesión guardada en vez de mandar al inicio. El puntaje de resultados se anima también cuando llega tras reingresar.
  - [VistaAdmin.vue](../client/src/views/VistaAdmin.vue): guarda el código de la sala activa en `sessionStorage` y la recupera al recargar, al volver desde la pestaña de retos o al reconectarse el socket.

**Limitación conocida:** las salas de quiz siguen viviendo solo en memoria. Si el **servidor** se reinicia, la sala se pierde (el panel lo avisa). El modo reto sí se guarda en disco.

**Cómo se verificó:** prueba automática contra el servidor real con 6 escenarios: banco protegido, reingreso en espera, intento con otro nombre, reingreso a mitad del quiz con su respuesta y puntaje, bloqueo de la pestaña vieja, reconexión del profesor y reingreso después de terminar. Todas pasaron. `npm run build` compila sin errores.

---

## 2026-10-24 — El banco de preguntas exponía las respuestas correctas

**Tipo:** Corrección de seguridad (trampa)

**Problema:** la ruta `GET /api/preguntas` era pública y devolvía el banco completo, **incluido el campo `respuesta_correcta`** de cada pregunta. Cualquier estudiante conectado al WiFi podía abrir `http://IP-DEL-SERVIDOR:3000/api/preguntas` y ver todas las respuestas del quiz.

**Qué se hizo:**

- [server/index.js](../server/index.js): la ruta ahora pasa por `exigirAdmin`. Solo responde si la petición trae el token del profesor en la cabecera `x-admin-token`; sin él devuelve `401 No autorizado`.
- [VistaAdmin.vue](../client/src/views/VistaAdmin.vue): el panel pide el banco **después** de iniciar sesión y envía el token. Si el token ya no sirve (por ejemplo, porque el servidor se reinició), pide la contraseña de nuevo.

**Cómo se verificó:** sin token la ruta responde 401; con el token del profesor devuelve el banco.

---

## 2026-10-24 — Piston no arrancaba: "Cgroup v2 not found"

**Tipo:** Configuración del entorno (no cambia el código)

**Problema:** el contenedor de Piston se reiniciaba en bucle mostrando `Cgroup v2 not found. Please make sure cgroup v2 is enabled on your system`. Docker Desktop (motor WSL 2) estaba usando cgroup v1 (`docker info` → `Cgroup Version: 1`), y Piston necesita cgroup v2 para crear las cajas aisladas donde ejecuta el código.

**Qué se hizo:** se creó el archivo `C:\Users\<usuario>\.wslconfig` con:

```ini
[wsl2]
kernelCommandLine = cgroup_no_v1=all systemd.unified_cgroup_hierarchy=1
```

Después hay que aplicar el cambio:

1. Cerrar Docker Desktop.
2. Ejecutar `wsl --shutdown` en PowerShell.
3. Abrir Docker Desktop de nuevo.
4. Verificar con `docker info | Select-String Cgroup` que diga `Cgroup Version: 2`.
5. Levantar Piston: `npm run piston:down` y luego `npm run piston:up`.

Este paso se debe repetir en **cualquier PC** que vaya a hacer de servidor.

**Nota:** el comando `docker compose` debe correrse dentro de `piston/` o con `-f piston/docker-compose.yml`. Si se corre desde la raíz sin `-f`, da el error *"no configuration file provided"*. Lo más fácil es usar `npm run piston:up`.
