# Hello World · ACEIS

Plataforma para la competencia **Hello World** de ACEIS. Funciona en la red WiFi del salón: el profesor corre el servidor en su computador y los estudiantes entran desde el navegador de su celular o portátil. No necesitan instalar nada.

Es **una sola competencia** que mezcla dos tipos de ítems:

| Ítem | Qué es |
|---|---|
| **Pregunta** | Selección múltiple, verdadero/falso, "¿qué imprime?", encontrar el error... |
| **Reto de programación** | El estudiante escribe código en **Python o C++** y el sistema lo califica solo, con pruebas ocultas |

El profesor elige qué preguntas y qué retos entran. **A cada estudiante le salen todos mezclados en un orden aleatorio distinto**, cada ítem con **su propio tiempo**, y avanza a su ritmo sin poder volver atrás.

> El historial de cambios y correcciones está en [docs/CORRECCIONES-MEJORAS.md](docs/CORRECCIONES-MEJORAS.md).

---

## Contenido

1. [Cómo funciona](#1-cómo-funciona)
2. [Requisitos](#2-requisitos)
3. [Instalación (una sola vez)](#3-instalación-una-sola-vez)
4. [Configuración](#4-configuración)
5. [Uso el día del evento](#5-uso-el-día-del-evento)
6. [La competencia](#6-la-competencia)
7. [Agregar preguntas y retos](#7-agregar-preguntas-y-retos)
8. [Desarrollo](#8-desarrollo)
9. [Solución de problemas](#9-solución-de-problemas)

---

## 1. Cómo funciona

```
 Celulares / portátiles                 Computador del profesor (Windows)
 de los estudiantes            ┌──────────────────────────────────────────────────┐
┌──────────────────┐   WiFi    │  Servidor Node.js  (puerto 3000)                 │
│ Navegador        │ ◄───────► │  · Sirve la página web (Vue)                     │
│ http://IP:3000   │ Socket.io │  · Reparte los ítems, controla los tiempos,      │
└──────────────────┘           │    califica y arma el ranking                    │
                               │  · Guarda las respuestas y pruebas ocultas       │
                               │    (nunca las envía antes de tiempo)             │
                               │              │ solo por 127.0.0.1                │
                               │              ▼                                   │
                               │  Piston en Docker  (puerto 2000, NO expuesto)    │
                               │  · Compila y ejecuta el código de los estudiantes│
                               │    en una caja aislada: sin internet, con límite │
                               │    de tiempo y memoria                           │
                               └──────────────────────────────────────────────────┘
```

- **Servidor** (`server/`): Node.js + Express + Socket.io. Es el "cerebro": crea la competencia, lleva el recorrido y el reloj de cada estudiante, califica y arma el ranking.
- **Cliente** (`client/`): Vue 3 + Vite. Son las pantallas. Al compilarlo (`npm run build`) se genera en `server/public/` y el servidor lo entrega.
- **Piston** (`piston/`): un motor libre que ejecuta código en contenedores aislados. Solo se necesita si la competencia tiene retos. Escucha **únicamente en `127.0.0.1`**, así que los estudiantes no pueden llegar a él directamente.

### Estructura del proyecto

```
hello-world-quiz/
├── package.json                  ← comandos: setup, build, start, prueba, piston:up...
├── docs/
│   └── CORRECCIONES-MEJORAS.md   ← historial de cambios
├── piston/
│   ├── docker-compose.yml        ← levanta Piston
│   ├── prueba-piston.mjs         ← prueba automática de Piston (instala Python y C++)
│   └── LEEME.md
├── server/
│   ├── index.js                  ← servidor: rutas del profesor y conexión
│   ├── .env                      ← tu configuración (se crea copiando .env.example)
│   ├── data/
│   │   ├── banco_preguntas.json  ← preguntas (con su tiempo)
│   │   ├── banco_problemas.json  ← retos (con su tiempo y sus pruebas ocultas)
│   │   └── competencias-guardadas.json ← se crea solo: respaldo de la competencia en curso
│   └── competencia/
│       ├── index.js              ← reglas: recorrido aleatorio, tiempos, respuestas, envíos, guardado
│       ├── ejecutor.js           ← habla con Piston
│       ├── calificador.js        ← compara la salida del estudiante con la esperada
│       ├── cola.js               ← limita cuántos envíos se califican a la vez
│       ├── ranking.js            ← puntos y desempate por tiempo
│       └── prueba-competencia.js ← prueba automática de las reglas (npm run prueba)
└── client/src/
    ├── views/
    │   ├── VistaIngreso.vue      ← pantalla de entrada del estudiante
    │   ├── VistaCompetencia.vue  ← estudiante: pregunta o reto actual, reloj, resultados
    │   ├── VistaAdmin.vue        ← profesor: elegir ítems, monitor en vivo, Excel
    │   └── VistaNoAutorizado.vue ← Sammy con el error 401 (si abren la API en el navegador)
    ├── components/               ← EditorCodigo (CodeMirror), Podio, Icon, sammy.js (mascota animada)
    └── composables/              ← useSocket (conexión), useCompetencia (estado del estudiante)
```

---

## 2. Requisitos

En el **computador del profesor** (el que hace de servidor):

| Programa | Versión | Para qué |
|---|---|---|
| [Node.js](https://nodejs.org) | **20.19 o superior** (o 22.12+) | Correr el servidor y compilar el cliente |
| [Docker Desktop](https://www.docker.com/products/docker-desktop/) | Con el motor WSL 2 activado y **cgroup v2** | Solo si hay **retos de programación** (Piston) |

Los estudiantes solo necesitan un navegador y estar en la **misma red WiFi** que el computador del profesor.

---

## 3. Instalación (una sola vez)

Abre una terminal (PowerShell) en la carpeta del proyecto:

```powershell
# 1. Instalar las dependencias del servidor y del cliente
npm run setup

# 2. Crear el archivo de configuración y editarlo (cambia la contraseña)
copy server\.env.example server\.env

# 3. Compilar las pantallas
npm run build
```

**Solo si vas a usar retos de programación**, con Docker Desktop abierto:

```powershell
# 4. Levantar Piston (la primera vez descarga la imagen)
npm run piston:up

# 5. Instalar Python y C++ dentro de Piston y comprobar que todo funciona
#    (la primera vez tarda varios minutos)
npm run piston:prueba
```

La prueba del paso 5 debe terminar con **"🎉 Todo funcionó"**. Revisa que se ejecutan Python y C++, que un bucle infinito se corta, que el código no tiene internet y que hay límite de memoria. Con `node piston/prueba-piston.mjs --carga` además simula 40 estudiantes enviando código al mismo tiempo.

> Si Piston se reinicia en bucle con *"Cgroup v2 not found"*, mira la [solución de problemas](#9-solución-de-problemas).
>
> Python y C++ quedan instalados en un volumen de Docker: no hay que repetir los pasos 4 y 5 cada vez, solo `npm run piston:up`.

---

## 4. Configuración

Archivo `server/.env`:

| Variable | Por defecto | Qué hace |
|---|---|---|
| `ADMIN_PASSWORD` | `aceis2024` | Contraseña del panel del profesor. **Cámbiala.** |
| `PORT` | `3000` | Puerto del servidor |
| `PISTON_URL` | `http://127.0.0.1:2000` | Dónde está Piston |
| `RETO_ENVIOS_SIMULTANEOS` | `4` | Cuántos envíos se califican al mismo tiempo. Súbelo si el PC es potente; bájalo si se pone lento |
| `RETO_PRUEBAS_PARALELAS` | `3` | Cuántas pruebas de un mismo envío corren en paralelo |
| `RETO_ESPERA_ENVIO_S` | `10` | Segundos mínimos entre dos envíos del mismo estudiante (evita saturar el servidor) |

Los **tiempos de cada pregunta y reto no se configuran aquí**: están en los bancos (ver [sección 7](#7-agregar-preguntas-y-retos)).

---

## 5. Uso el día del evento

1. Conecta el computador al **WiFi del salón**.
2. Si habrá retos de programación: abre **Docker Desktop** y ejecuta `npm run piston:up`.
3. Inicia el servidor:
   ```powershell
   npm start
   ```
4. Averigua la IP del computador: ejecuta `ipconfig` y busca **"Dirección IPv4"** (por ejemplo `192.168.1.15`).
5. Comparte con los estudiantes la dirección **`http://192.168.1.15:3000`** (puedes ponerla en el tablero o en un código QR).
6. Tú entras al panel en **`http://localhost:3000/admin`**.

> **Firewall de Windows:** la primera vez que corras el servidor, Windows puede preguntar si permites que Node.js use la red. Marca **"Redes privadas"** y acepta. Si los estudiantes no pueden entrar, revisa esto primero.

Para apagar: `Ctrl + C` en la terminal del servidor (el estado se guarda antes de cerrar) y `npm run piston:down` si quieres detener Piston.

---

## 6. La competencia

### Profesor (`/admin`)

1. Ingresa la contraseña.
2. Si vas a usar retos, revisa que arriba diga **"Motor listo · Python … · C++ …"**. Si dice "Motor no disponible", abre Docker Desktop y ejecuta `npm run piston:up`.
3. **Preguntas:** fíltralas por nivel, tipo o tema y márcalas. Cada una muestra su puntaje y su tiempo.
4. **Retos de programación:** márcalos. Si eliges alguno, configura:
   - **Intentos fallidos por reto** (por defecto 3; 0 = ilimitados).
   - **Lenguajes** permitidos: Python, C++ o ambos.
5. Abajo verás el total de puntos posibles y el **tiempo máximo por estudiante** (la suma de los tiempos de todos los ítems).
6. Pulsa **Crear competencia** y comparte el código (por ejemplo `ABCD-1234`).
7. Cuando estén todos, pulsa **Iniciar competencia**. Cada estudiante empieza su recorrido al mismo tiempo, con su propio reloj por ítem.
8. **Monitor en vivo:**
   - Tabla de ranking con el **progreso** de cada estudiante (en qué ítem va), sus puntos de preguntas y una columna por reto (R1, R2…: puntos, minutos que tardó e intentos fallidos ✗).
   - Lista de **últimos envíos** de código con su veredicto.
   - Avisos de estudiantes **desconectados** y cuántas veces **salieron de la pestaña** (👁‍🗨). Es solo informativo; tú decides qué hacer.
   - Botón **Terminar** para cerrar antes para todos.
9. La competencia **termina sola cuando todos terminan su recorrido** (o cuando pulsas Terminar). Se muestra el podio y puedes **Exportar Excel** con:
   - **Ranking:** posición, puntos, preguntas correctas, retos resueltos, tiempo total, intentos fallidos, salidas de pestaña y puntos por reto.
   - **Preguntas:** qué respondió cada estudiante en cada pregunta, la correcta, cuánto tardó y sus puntos.
   - **Envíos:** cada envío de código con su veredicto, mensaje de error y **el código que envió el estudiante**.

> Si cierras o recargas el navegador, el panel vuelve a conectarse solo a la competencia activa. Si el **servidor se reinicia**, la competencia se recupera de `server/data/competencias-guardadas.json`: vuelve a ingresar la contraseña y sigue donde iba.

### Estudiante

Entra a la dirección del servidor, escribe su nombre, su código de estudiante y el código de la sala. Al iniciar, le aparece **un ítem a la vez**, con una barra de tiempo arriba:

- **Pregunta:** elige una opción. **Sammy**, la mascota, aparece unos 2 segundos celebrando (¡Correcto!) o lamentando (¡Incorrecto!), y luego pasa a la siguiente. El reloj de la siguiente pregunta empieza cuando Sammy se va. Si se acaba el tiempo, cuenta como no respondida y pasa sola.
- **Reto de programación:** pantalla dividida en dos.
  - **Izquierda:** el enunciado, el formato de entrada y salida, y los ejemplos.
  - **Derecha:** el **editor de código** (con colores, números de línea y Tab para indentar) y una consola con tres pestañas: **Resultado**, **Mi propia entrada** y **Mis envíos**.
  - Pasa al siguiente ítem cuando **lo resuelve al 100 %**, cuando **agota sus intentos** o cuando **se acaba su tiempo**. Si no lo resuelve por completo, conserva su mejor puntaje. Sammy también aparece al enviar: celebra si lo resolvió y se pone triste si no.

**No puede volver atrás ni saltarse un ítem.** Al responder sabe si acertó, pero **cuál era la opción correcta** y el ranking **se revelan al final** (así nadie puede pasarle la respuesta a un compañero al que todavía no le ha salido esa pregunta). Al terminar ve su posición, el podio y la revisión de cada pregunta con su explicación.

| Botón (retos) | Qué hace | ¿Gasta intentos? |
|---|---|---|
| **Probar** | Ejecuta el código con los **ejemplos** y muestra, lado a lado, la salida esperada y la obtenida | No, es ilimitado |
| **Enviar** | Califica el código con las **pruebas ocultas** | Sí, si no pasa todas las pruebas |

El código se guarda automáticamente en el navegador: si el estudiante recarga la página, no pierde lo que escribió. Si se cae el WiFi, vuelve a entrar solo al reconectarse; también puede volver a entrar con **el mismo nombre y código de estudiante** y conserva todo su progreso.

### Reglas de calificación

- **Preguntas:** los puntos de la pregunta (en el banco: fácil 15, medio 20, difícil 30) más un **bonus de hasta +50 %** por responder rápido. El bonus baja de forma lineal durante el tiempo propio de la pregunta.
- **Retos — puntaje parcial:** `puntos del reto × (pruebas ocultas superadas / total de pruebas ocultas)`. **Los ejemplos visibles no dan puntos**: solo sirven para probar. Cuenta el **mejor** envío.
- **Intentos:** cada envío que no pase el 100 % de las pruebas gasta un intento. **Los errores de compilación no gastan intentos.** Al agotarlos, el estudiante pasa al siguiente ítem y conserva su mejor puntaje.
- **Desempate:** gana quien tenga **menor tiempo total**: lo que tardó en responder cada pregunta acertada más lo que tardó (desde que se le abrió) en lograr su mejor puntaje en cada reto. Si siguen empatados, gana quien tenga menos intentos fallidos.
- **Veredictos:** ✅ Aceptado · 🟡 Parcial · ❌ Respuesta incorrecta · ⏱️ Tiempo excedido · 💥 Error en ejecución · 🔧 Error de compilación.
- **Comparación de salidas:** se ignoran los espacios repetidos, los espacios al final de cada línea y las líneas vacías al inicio o al final. **Sí** se distinguen mayúsculas y minúsculas (`PAR` ≠ `par`).
- **Mensajes de `input()` en Python:** el texto de `input("Ingrese un número")` **no se imprime**, para que no se mezcle con la respuesta. En C++ el estudiante no debe imprimir mensajes con `cout`, solo la respuesta.
- **Errores comunes:** si el programa intenta leer más líneas de las que tiene la entrada (`EOFError`) o suma texto en vez de números, el mensaje de error incluye una pista en español.
- **Límites por ejecución:** 2 s de tiempo (configurable por reto), 256 MB de memoria y sin acceso a internet.

### ¿Por qué no se puede hacer trampa imprimiendo el resultado?

Cada reto se califica con **varias entradas ocultas distintas** a las del ejemplo. En *"Suma de dos números"* el ejemplo es `3 7 → 10`, pero al enviar el programa se ejecuta con `-5 2`, `0 0`, `1000000000 1000000000`... Un programa que solo hace `print(10)` pasa el ejemplo, pero **0 de 5 pruebas ocultas: 0 puntos**.

Las pruebas ocultas **nunca salen del servidor**: el navegador del estudiante solo recibe el enunciado y los ejemplos. Las respuestas correctas de las preguntas tampoco se envían hasta que la competencia termina, y el banco completo solo lo puede pedir el profesor con su contraseña. Si un estudiante intenta abrir la API en el navegador (por ejemplo `http://IP:3000/api/preguntas`), ve a Sammy con un candado y el mensaje **"Error 401 · No autorizado"**.

---

## 7. Agregar preguntas y retos

### Preguntas: `server/data/banco_preguntas.json`

```json
{
  "id": 31, "nivel": "facil", "tipo": "SM", "puntos": 15, "tiempo_segundos": 45,
  "enunciado": "¿Qué imprime print(2 + 3 * 2)?",
  "opciones": ["10", "8", "7", "12"],
  "respuesta_correcta": 1,
  "explicacion": "La multiplicación va primero: 3*2 = 6, luego 2 + 6 = 8.",
  "tema": "3.3 Operadores aritméticos"
}
```

- `tiempo_segundos`: tiempo que tiene el estudiante para responder **esa** pregunta. Si falta, se usa el del nivel: fácil 45 s, medio 60 s, difícil 90 s.
- `respuesta_correcta` es la **posición** de la opción, contando desde 0.
- `tipo`: `SM` selección múltiple, `VF` verdadero/falso, `IMP` ¿qué imprime?, `ERR` encontrar el error, `COMP` completar, `DF` diagrama.
- `nivel`: `facil`, `medio` o `dificil`.

### Retos: `server/data/banco_problemas.json`

```json
{
  "id": "P09",
  "titulo": "Máximo de una lista",
  "nivel": "medio",
  "puntos": 150,
  "tema": "5.3 Ciclo for",
  "enunciado": "Lee N números e imprime el mayor.",
  "formato_entrada": "La primera línea tiene N (1 ≤ N ≤ 1000). La segunda, N enteros separados por espacio.",
  "formato_salida": "Un único entero: el mayor.",
  "limite_tiempo_ms": 2000,
  "tiempo_minutos": 20,
  "plantilla": {
    "python": "n = int(input())\nnumeros = list(map(int, input().split()))\n# Escribe tu solución aquí\n",
    "cpp": "#include <iostream>\nusing namespace std;\n\nint main() {\n    int n;\n    cin >> n;\n\n    return 0;\n}\n"
  },
  "ejemplos": [
    { "entrada": "3\n4 9 2", "salida": "9" }
  ],
  "pruebas_ocultas": [
    { "entrada": "1\n-5", "salida": "-5" },
    { "entrada": "4\n-1 -7 -3 -2", "salida": "-1" },
    { "entrada": "5\n7 7 7 7 7", "salida": "7" }
  ]
}
```

- `tiempo_minutos`: tiempo que tiene el estudiante para desarrollar **ese** reto. Si falta, se usa el del nivel: fácil 15 min, medio 20 min, difícil 30 min.
- `limite_tiempo_ms`: cuánto puede tardar **cada ejecución** del programa (para cortar ciclos infinitos). No es lo mismo que `tiempo_minutos`.

**Consejos para escribir buenas pruebas:**

1. **El resultado debe depender de la entrada.** "Imprime una suma que dé 10" no sirve; "lee a y b e imprime a + b" sí.
2. Pon **5 o más pruebas ocultas** (son las únicas que dan puntos), incluyendo **casos límite**: el valor mínimo y el máximo, cero, negativos, todos iguales, listas de un solo elemento.
3. Deja claro en `formato_entrada` **en cuántas líneas** vienen los datos, y que la plantilla los lea así (por ejemplo `a, b = map(int, input().split())` si vienen en una sola línea).
4. Calcula las salidas esperadas con **un programa tuyo**, no a mano.
5. Mantén las salidas cortas (menos de 1000 caracteres por prueba).
6. Después de editar el archivo, reinicia el servidor y **prueba el reto tú mismo** creando una competencia de prueba.

Los 8 retos incluidos (suma, par/impar, mayor de tres, suma 1..N, vocales, FizzBuzz, primos y palíndromo) tienen sus salidas generadas con soluciones de referencia.

---

## 8. Desarrollo

Para trabajar en el código con recarga automática, usa dos terminales:

```powershell
npm run dev:server     # servidor en :3000, se reinicia al guardar
npm run dev:client     # cliente en :5173 con recarga en caliente
```

Abre `http://localhost:5173`. Vite redirige `/api` y `/socket.io` al servidor.

**No edites `server/public/`**: se genera con `npm run build` y se sobrescribe cada vez.

Para comprobar las reglas de la competencia (orden aleatorio, tiempos, avance automático, puntaje, guardado) sin Piston ni navegador:

```powershell
npm run prueba
```

### Mensajes de Socket.io (referencia)

| Quién envía | Evento | Para qué |
|---|---|---|
| Profesor | `admin:competencia:crear`, `admin:competencia:iniciar`, `admin:competencia:terminar`, `admin:competencia:exportar`, `admin:competencia:reconectar` | Manejar la competencia |
| Estudiante | `estudiante:unirse` | Entrar (o volver a entrar) a la competencia |
| Estudiante | `estudiante:responder` | Responder la pregunta actual |
| Estudiante | `estudiante:probar`, `estudiante:enviar` | Probar o enviar el código del reto actual |
| Estudiante | `estudiante:foco` | Avisar que salió de la pestaña |
| Servidor | `competencia:mi-estado`, `competencia:cola`, `competencia:sesion-reemplazada` | Actualizaciones para el estudiante |
| Servidor | `competencia:admin-estado` | Actualizaciones para el panel del profesor |

Rutas HTTP del profesor (piden la cabecera `x-admin-token`): `GET /api/admin/banco` y `GET /api/admin/motor`. Sin el token, o en cualquier otra ruta `/api/...`, responden **401**: JSON si la pide el panel, o la página de Sammy si se abre en el navegador.

### Sammy, la mascota

`client/src/components/sammy.js` es un Web Component estándar (`<sammy-mascota>`), registrado en `main.js`. En `vite.config.js` se le dice a Vue que es un elemento nativo (`isCustomElement`). Uso:

```html
<sammy-mascota estado="correcto" mensaje="¡Correcto! +18"></sammy-mascota>
<!-- estado: normal | correcto | incorrecto | 401 · tamaño con CSS: --sammy-tam: 240px -->
```

La pausa del servidor para mostrar el resultado se ajusta con `pausaResultadoMs` en `server/competencia/index.js` (2000 ms).

---

## 9. Solución de problemas

| Problema | Solución |
|---|---|
| Los estudiantes no pueden abrir la página | Deben estar en el mismo WiFi. Revisa que el Firewall de Windows permita Node.js en redes privadas. Usa la IP de `ipconfig`, no `localhost`. |
| `npm run setup` falla con `ERESOLVE` | Verifica que tienes Node 20.19+ (`node -v`). Si persiste: `cd client` y `npm install --legacy-peer-deps`. |
| El panel dice "Motor no disponible" | Abre Docker Desktop, espera a que esté en verde y ejecuta `npm run piston:up`. Luego pulsa **Revisar**. |
| Piston se reinicia en bucle: *"Cgroup v2 not found"* | Docker está usando cgroup v1. Crea `C:\Users\<tu-usuario>\.wslconfig` con `[wsl2]` y `kernelCommandLine = cgroup_no_v1=all systemd.unified_cgroup_hierarchy=1`, cierra Docker, ejecuta `wsl --shutdown`, abre Docker y verifica con `docker info` que diga `Cgroup Version: 2`. Detalles en [docs/CORRECCIONES-MEJORAS.md](docs/CORRECCIONES-MEJORAS.md). |
| `docker compose` dice *"no configuration file provided"* | Se corrió desde la carpeta equivocada. Usa `npm run piston:up` desde la raíz del proyecto. |
| "Python/C++ no está instalado en Piston" | Ejecuta `npm run piston:prueba`: instala los lenguajes que falten. |
| Los envíos tardan mucho / aparece "En cola" | Normal si muchos envían a la vez. Si el PC lo aguanta, sube `RETO_ENVIOS_SIMULTANEOS` en `server/.env` y reinicia el servidor. |
| "La sesión expiró" en el panel | El servidor se reinició. Ingresa la contraseña otra vez; la competencia activa se recupera sola. |
| Cambié el código del cliente y no veo los cambios | Ejecuta `npm run build` y recarga con `Ctrl + F5`. |
| Un estudiante recargó la página o se le cayó el WiFi | Vuelve a entrar solo. Si no, que ingrese con el **mismo nombre y código de estudiante** y el mismo código de sala: conserva todo su progreso. Su reloj siguió corriendo mientras estaba fuera. |
