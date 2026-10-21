# Hello World · ACEIS

Plataforma para la competencia **Hello World** de ACEIS. Funciona en la red WiFi del salón: el profesor corre el servidor en su computador y los estudiantes entran desde el navegador de su celular o portátil. No necesitan instalar nada.

Tiene **dos modos**:

| Modo | Qué es | Para qué sirve |
|---|---|---|
| **Quiz** | Preguntas de selección múltiple en tiempo real, al estilo Kahoot | Repasar conceptos: tipos de datos, condicionales, ciclos, "¿qué imprime?"... |
| **Reto de programación** | Los estudiantes escriben código en **Python o C++** y el sistema lo califica solo, con pruebas ocultas | Medir si realmente saben resolver un problema programando |

---

## Contenido

1. [Cómo funciona](#1-cómo-funciona)
2. [Requisitos](#2-requisitos)
3. [Instalación (una sola vez)](#3-instalación-una-sola-vez)
4. [Configuración](#4-configuración)
5. [Uso el día del evento](#5-uso-el-día-del-evento)
6. [Modo Quiz](#6-modo-quiz)
7. [Modo Reto de programación](#7-modo-reto-de-programación)
8. [Agregar preguntas y problemas](#8-agregar-preguntas-y-problemas)
9. [Desarrollo](#9-desarrollo)
10. [Solución de problemas](#10-solución-de-problemas)

---

## 1. Cómo funciona

```
 Celulares / portátiles                 Computador del profesor (Windows)
 de los estudiantes            ┌──────────────────────────────────────────────────┐
┌──────────────────┐   WiFi    │  Servidor Node.js  (puerto 3000)                 │
│ Navegador        │ ◄───────► │  · Sirve la página web (Vue)                     │
│ http://IP:3000   │ Socket.io │  · Maneja salas, preguntas, puntajes, ranking    │
└──────────────────┘           │  · Guarda las pruebas ocultas (nunca las envía)  │
                               │              │ solo por 127.0.0.1                │
                               │              ▼                                   │
                               │  Piston en Docker  (puerto 2000, NO expuesto)    │
                               │  · Compila y ejecuta el código de los estudiantes│
                               │    en una caja aislada: sin internet, con límite │
                               │    de tiempo y memoria                           │
                               └──────────────────────────────────────────────────┘
```

- **Servidor** (`server/`): Node.js + Express + Socket.io. Es el "cerebro": crea las salas, recibe respuestas y código, califica y arma el ranking. Socket.io mantiene una conexión abierta con cada navegador, así todos ven los cambios al instante.
- **Cliente** (`client/`): Vue 3 + Vite. Son las pantallas. Al compilarlo (`npm run build`) se genera en `server/public/` y el servidor lo entrega.
- **Piston** (`piston/`): un motor libre que ejecuta código en contenedores aislados. Solo lo usa el modo reto. Escucha **únicamente en `127.0.0.1`**, así que los estudiantes no pueden llegar a él directamente.

### Estructura del proyecto

```
hello-world-quiz/
├── package.json                  ← comandos: setup, build, start, piston:up...
├── piston/
│   ├── docker-compose.yml        ← levanta Piston
│   ├── prueba-piston.mjs         ← prueba automática de Piston (instala Python y C++)
│   └── LEEME.md
├── server/
│   ├── index.js                  ← servidor + modo quiz
│   ├── .env                      ← tu configuración (se crea copiando .env.example)
│   ├── data/
│   │   ├── banco_preguntas.json  ← preguntas del quiz
│   │   ├── banco_problemas.json  ← problemas del reto (con sus pruebas ocultas)
│   │   └── retos-guardados.json  ← se crea solo: respaldo del reto en curso
│   └── retos/                    ← modo reto de programación
│       ├── index.js              ← reglas: salas, envíos, intentos, tiempo, guardado
│       ├── ejecutor.js           ← habla con Piston
│       ├── calificador.js        ← compara la salida del estudiante con la esperada
│       ├── cola.js               ← limita cuántos envíos se califican a la vez
│       └── ranking.js            ← puntos y desempate por tiempo
└── client/src/
    ├── views/
    │   ├── VistaIngreso.vue      ← pantalla de entrada (sirve para quiz y reto)
    │   ├── VistaSala.vue         ← quiz: preguntas
    │   ├── VistaResultadosEstudiante.vue
    │   ├── VistaAdmin.vue        ← profesor: quiz
    │   ├── VistaReto.vue         ← estudiante: reto (enunciado + editor + consola)
    │   └── VistaAdminRetos.vue   ← profesor: reto (configurar, monitor en vivo, Excel)
    ├── components/               ← EditorCodigo (CodeMirror), Podio, Icon
    └── composables/              ← useQuiz, useReto (estado compartido y conexión)
```

---

## 2. Requisitos

En el **computador del profesor** (el que hace de servidor):

| Programa | Versión | Para qué |
|---|---|---|
| [Node.js](https://nodejs.org) | **20.19 o superior** (o 22.12+) | Correr el servidor y compilar el cliente |
| [Docker Desktop](https://www.docker.com/products/docker-desktop/) | Con el motor WSL 2 activado | Solo para el **modo reto** (Piston) |

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

**Solo si vas a usar el modo reto**, con Docker Desktop abierto:

```powershell
# 4. Levantar Piston (la primera vez descarga la imagen)
npm run piston:up

# 5. Instalar Python y C++ dentro de Piston y comprobar que todo funciona
#    (la primera vez tarda varios minutos)
npm run piston:prueba
```

La prueba del paso 5 debe terminar con **"🎉 Todo funcionó"**. Revisa que se ejecutan Python y C++, que un bucle infinito se corta, que el código no tiene internet y que hay límite de memoria. Con `node piston/prueba-piston.mjs --carga` además simula 40 estudiantes enviando código al mismo tiempo.

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

---

## 5. Uso el día del evento

1. Conecta el computador al **WiFi del salón**.
2. Si habrá reto de programación: abre **Docker Desktop** y ejecuta `npm run piston:up`.
3. Inicia el servidor:
   ```powershell
   npm start
   ```
4. Averigua la IP del computador: ejecuta `ipconfig` y busca **"Dirección IPv4"** (por ejemplo `192.168.1.15`).
5. Comparte con los estudiantes la dirección **`http://192.168.1.15:3000`** (puedes ponerla en el tablero o en un código QR).
6. Tú entras al panel en **`http://localhost:3000/admin`**.

> **Firewall de Windows:** la primera vez que corras el servidor, Windows puede preguntar si permites que Node.js use la red. Marca **"Redes privadas"** y acepta. Si los estudiantes no pueden entrar, revisa esto primero.

Para apagar: `Ctrl + C` en la terminal del servidor (el estado del reto se guarda antes de cerrar) y `npm run piston:down` si quieres detener Piston.

---

## 6. Modo Quiz

**Profesor** (`/admin` → pestaña **Quiz**):

1. Ingresa la contraseña.
2. (Opcional) Activa el **temporizador** y define los segundos por pregunta (hasta 10 minutos).
3. Filtra el banco por **nivel, tipo o tema** y marca las preguntas. Para ver una pregunta completa, pasa el mouse encima.
4. Ordena las seleccionadas **arrastrándolas** hacia arriba o abajo (o con las flechas).
5. Pulsa **Crear sala**. Aparece un código como `ABCD-1234`.
6. Cuando estén todos, pulsa **Iniciar Quiz** y avanza pregunta por pregunta. El monitor muestra **"Respondieron X / N"**. Cuando todos respondieron aparece un aviso para pasar a la siguiente sin esperar a que se acabe el tiempo.
7. Al terminar verás el podio y podrás **exportar los resultados a Excel**.

**Estudiante:** entra a la dirección del servidor, escribe su nombre, su código de estudiante y el código de la sala, y responde.

**Puntaje:** cada pregunta vale según su nivel (fácil 15, medio 20, difícil 30) más un **bonus de hasta +50 %** por responder rápido.

---

## 7. Modo Reto de programación

### Profesor (`/admin` → pestaña **Reto de programación**)

1. Revisa que arriba diga **"Motor listo · Python … · C++ …"**. Si dice "Motor no disponible", abre Docker Desktop y ejecuta `npm run piston:up`.
2. Configura:
   - **Duración** (por defecto 30 min).
   - **Intentos fallidos por problema** (por defecto 3; 0 = ilimitados).
   - **Lenguajes** permitidos: Python, C++ o ambos.
3. Marca los problemas y pulsa **Crear reto**. Comparte el código.
4. Los estudiantes entran desde **la misma pantalla de inicio** que el quiz, con ese código. El sistema detecta que es un reto.
5. Pulsa **Iniciar reto**. Desde ese momento corre el reloj para todos al mismo tiempo.
6. **Monitor en vivo:**
   - Tabla de ranking con una columna por problema: puntos, minuto en que logró su mejor puntaje e intentos fallidos (✗).
   - Lista de **últimos envíos** con su veredicto.
   - Avisos de estudiantes **desconectados** y cuántas veces **salieron de la pestaña** (👁‍🗨). Es solo informativo; tú decides qué hacer.
   - Botones **+1 min / +5 min** para dar más tiempo y **Terminar** para cerrar antes.
7. Al terminar el tiempo (o al pulsar Terminar) se muestra el podio y puedes **Exportar Excel** con dos hojas:
   - **Ranking:** posición, puntos, problemas resueltos, tiempo total, intentos fallidos, salidas de pestaña y puntos por problema.
   - **Envíos:** cada envío con su veredicto, mensaje de error y **el código que envió el estudiante**.

> Si cierras o recargas el navegador, el panel vuelve a conectarse solo al reto activo. Si el **servidor se reinicia**, el reto se recupera de `server/data/retos-guardados.json`: vuelve a ingresar la contraseña y el reto sigue donde iba.

### Estudiante

Pantalla dividida en dos:

- **Izquierda:** el enunciado, el formato de entrada y salida, y los ejemplos.
- **Derecha:** el **editor de código** (con colores, números de línea y Tab para indentar) y una consola con tres pestañas:
  - **Resultado:** lo que pasó al probar o enviar.
  - **Mi propia entrada:** para ejecutar el programa con datos que el estudiante escriba.
  - **Mis envíos:** el historial del problema.

Arriba están las pestañas de los problemas (A, B, C…) con su estado: verde = resuelto, amarillo = parcial, rojo = sin intentos. También se ven el **reloj** y los **puntos**.

| Botón | Qué hace | ¿Gasta intentos? |
|---|---|---|
| **Probar** | Ejecuta el código con los **ejemplos** y muestra, lado a lado, la salida esperada y la obtenida | No, es ilimitado |
| **Enviar** | Califica el código con **todas las pruebas**, incluidas las **ocultas** | Sí, si no pasa todas las pruebas |

El código se guarda automáticamente en el navegador: si el estudiante recarga la página, no pierde lo que escribió. Si se cae el WiFi, vuelve a entrar solo al reconectarse.

### Reglas de calificación

- **Puntaje parcial:** `puntos del problema × (pruebas superadas / total de pruebas)`. Cuenta el **mejor** envío de cada problema.
- **Intentos:** cada envío que no pase el 100 % de las pruebas gasta un intento. **Los errores de compilación no gastan intentos.** Al agotarlos, el problema se bloquea para ese estudiante y se conserva su mejor puntaje.
- **Desempate:** gana quien tenga **menor tiempo total**. El tiempo de cada problema es el minuto (contado desde que inició el reto) en que el estudiante logró su mejor puntaje en ese problema. Volver a enviar con el mismo puntaje **no** empeora su tiempo. Si siguen empatados, gana quien tenga menos intentos fallidos.
- **Veredictos:** ✅ Aceptado · 🟡 Parcial · ❌ Respuesta incorrecta · ⏱️ Tiempo excedido · 💥 Error en ejecución · 🔧 Error de compilación.
- **Comparación de salidas:** se ignoran los espacios repetidos, los espacios al final de cada línea y las líneas vacías al inicio o al final. **Sí** se distinguen mayúsculas y minúsculas (`PAR` ≠ `par`).
- **Límites por ejecución:** 2 s de tiempo (configurable por problema), 256 MB de memoria y sin acceso a internet.

### ¿Por qué no se puede hacer trampa imprimiendo el resultado?

Cada problema se califica con **varias entradas distintas** y la mayoría están **ocultas**. Por ejemplo, en *"Suma de dos números"* el ejemplo es `3 7 → 10`, pero al enviar el programa también se ejecuta con `-5 2`, `0 0`, `1000000000 1000000000`... Un programa que solo hace `print(10)` pasa 1 de 6 pruebas y obtiene **17 de 100 puntos**.

Las pruebas ocultas **nunca salen del servidor**: el navegador del estudiante solo recibe el enunciado y los ejemplos.

---

## 8. Agregar preguntas y problemas

### Preguntas del quiz: `server/data/banco_preguntas.json`

```json
{
  "id": 31, "nivel": "facil", "tipo": "SM", "puntos": 15,
  "enunciado": "¿Qué imprime print(2 + 3 * 2)?",
  "opciones": ["10", "8", "7", "12"],
  "respuesta_correcta": 1,
  "explicacion": "La multiplicación va primero: 3*2 = 6, luego 2 + 6 = 8.",
  "tema": "3.3 Operadores aritméticos"
}
```

- `respuesta_correcta` es la **posición** de la opción, contando desde 0.
- `tipo`: `SM` selección múltiple, `VF` verdadero/falso, `IMP` ¿qué imprime?, `ERR` encontrar el error, `COMP` completar, `DF` diagrama.
- `nivel`: `facil`, `medio` o `dificil`.

### Problemas del reto: `server/data/banco_problemas.json`

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

**Consejos para escribir buenas pruebas:**

1. **El resultado debe depender de la entrada.** "Imprime una suma que dé 10" no sirve; "lee a y b e imprime a + b" sí.
2. Pon **5 o más pruebas ocultas**, incluyendo **casos límite**: el valor mínimo y el máximo, cero, negativos, todos iguales, listas de un solo elemento.
3. Calcula las salidas esperadas con **un programa tuyo**, no a mano.
4. Mantén las salidas cortas (menos de 1000 caracteres por prueba).
5. Después de editar el archivo, reinicia el servidor y **prueba el problema tú mismo** creando un reto de prueba.

Los 8 problemas incluidos (suma, par/impar, mayor de tres, suma 1..N, vocales, FizzBuzz, primos y palíndromo) tienen sus salidas generadas con soluciones de referencia.

---

## 9. Desarrollo

Para trabajar en el código con recarga automática, usa dos terminales:

```powershell
npm run dev:server     # servidor en :3000, se reinicia al guardar
npm run dev:client     # cliente en :5173 con recarga en caliente
```

Abre `http://localhost:5173`. Vite redirige `/api` y `/socket.io` al servidor.

**No edites `server/public/`**: se genera con `npm run build` y se sobrescribe cada vez.

### Mensajes de Socket.io (referencia)

| Quién envía | Evento | Para qué |
|---|---|---|
| Profesor | `admin:crear-sala`, `admin:iniciar-quiz`, `admin:siguiente-pregunta`, `admin:terminar-quiz` | Quiz |
| Profesor | `admin:reto:crear`, `admin:reto:iniciar`, `admin:reto:agregar-tiempo`, `admin:reto:terminar`, `admin:reto:exportar`, `admin:reto:reconectar` | Reto |
| Estudiante | `estudiante:unirse` | Entrar a un quiz **o** a un reto (el servidor decide según el código) |
| Estudiante | `estudiante:responder` | Responder una pregunta del quiz |
| Estudiante | `estudiante:reto:probar`, `estudiante:reto:enviar`, `estudiante:reto:foco` | Reto |
| Servidor | `sala:*` | Actualizaciones del quiz |
| Servidor | `reto:estado`, `reto:mi-estado`, `reto:cola`, `reto:admin-estado` | Actualizaciones del reto |

---

## 10. Solución de problemas

| Problema | Solución |
|---|---|
| Los estudiantes no pueden abrir la página | Deben estar en el mismo WiFi. Revisa que el Firewall de Windows permita Node.js en redes privadas. Usa la IP de `ipconfig`, no `localhost`. |
| `npm run setup` falla con `ERESOLVE` | Verifica que tienes Node 20.19+ (`node -v`). Si persiste: `cd client` y `npm install --legacy-peer-deps`. |
| El panel del reto dice "Motor no disponible" | Abre Docker Desktop, espera a que esté en verde y ejecuta `npm run piston:up`. Luego pulsa **Revisar**. |
| "Python/C++ no está instalado en Piston" | Ejecuta `npm run piston:prueba`: instala los lenguajes que falten. |
| Los envíos tardan mucho / aparece "En cola" | Normal si muchos envían a la vez. Si el PC lo aguanta, sube `RETO_ENVIOS_SIMULTANEOS` en `server/.env` y reinicia el servidor. |
| "La sesión expiró" en el panel | El servidor se reinició. Ingresa la contraseña otra vez; el reto activo se recupera solo. |
| Cambié el código del cliente y no veo los cambios | Ejecuta `npm run build` y recarga con `Ctrl + F5`. |
| Un estudiante recargó la página o se le cayó el WiFi | Vuelve a entrar solo. Si no, que ingrese con el **mismo nombre y código de estudiante** y el mismo código de sala: conserva todo su progreso. |
