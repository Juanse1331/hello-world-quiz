// Adaptador del motor de ejecución de código (Piston).
// El resto del servidor solo usa ejecutar() y estadoMotor(); si algún día se cambia de motor,
// basta con reescribir este archivo.

const PISTON_URL = (process.env.PISTON_URL || 'http://127.0.0.1:2000').replace(/\/+$/, '')

// Lenguajes que acepta el modo reto -> nombre en Piston y archivo principal
const LENGUAJES = {
  python: { piston: 'python', archivo: 'main.py', nombre: 'Python' },
  cpp: { piston: 'c++', archivo: 'main.cpp', nombre: 'C++' }
}

const MEMORIA_MAX = 256 * 1024 * 1024 // 256 MB por ejecución

// Python: el código del estudiante corre dentro de este envoltorio para que input("Ingrese un número")
// NO imprima el mensaje (se mezclaría con la salida y la respuesta nunca coincidiría).
// Los errores se muestran como si vinieran de main.py, con las líneas del estudiante.
const ENVOLTORIO_PYTHON = `import builtins, linecache, os, sys, traceback
_leer = builtins.input
builtins.input = lambda *mensaje: _leer()
with open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'main.py'), encoding='utf-8') as _f:
    _fuente = _f.read()
linecache.cache['main.py'] = (len(_fuente), None, _fuente.splitlines(True), 'main.py')
try:
    exec(compile(_fuente, 'main.py', 'exec'), {'__name__': '__main__'})
except SystemExit:
    raise
except BaseException as _e:
    _pila = [f for f in traceback.extract_tb(_e.__traceback__) if f.filename == 'main.py']
    if _pila:
        print('Traceback (most recent call last):', file=sys.stderr)
        print(''.join(traceback.format_list(_pila)), end='', file=sys.stderr)
    print(''.join(traceback.format_exception_only(type(_e), _e)), end='', file=sys.stderr)
    sys.exit(1)
`

function archivos(lenguaje, codigo) {
  // Piston ejecuta el primer archivo: el envoltorio, que carga main.py (el código del estudiante)
  if (lenguaje === 'python') return [{ name: '_juez.py', content: ENVOLTORIO_PYTHON }, { name: 'main.py', content: codigo }]
  return [{ name: LENGUAJES[lenguaje].archivo, content: codigo }]
}

// Explicación en español para los errores más comunes de principiantes
function pista(error) {
  if (/EOFError/.test(error)) {
    return '\n\n💡 Tu programa intentó leer más líneas de las que tiene la entrada. Revisa el formato de entrada: ' +
      'si los datos vienen en UNA sola línea (por ejemplo "3 7"), léelos con un solo input(), así: a, b = map(int, input().split())'
  }
  if (/can only concatenate str|unsupported operand type.*'str'/.test(error)) {
    return '\n\n💡 input() siempre devuelve texto. Para hacer cuentas conviértelo a número con int(...) o float(...).'
  }
  return ''
}

let versiones = null
let versionesTs = 0

function compararVersion(a, b) {
  const x = String(a).split('.').map(Number)
  const y = String(b).split('.').map(Number)
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    const d = (x[i] || 0) - (y[i] || 0)
    if (d) return d
  }
  return 0
}

async function pedir(ruta, { metodo = 'GET', cuerpo, timeoutMs = 15000 } = {}) {
  const ctrl = new AbortController()
  const temporizador = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch(PISTON_URL + '/api/v2' + ruta, {
      method: metodo,
      headers: { 'Content-Type': 'application/json' },
      body: cuerpo ? JSON.stringify(cuerpo) : undefined,
      signal: ctrl.signal
    })
    const texto = await res.text()
    let datos
    try { datos = JSON.parse(texto) } catch { datos = { message: texto } }
    if (!res.ok) throw new Error(datos?.message || `Piston respondió HTTP ${res.status}`)
    return datos
  } catch (e) {
    if (e.name === 'AbortError') throw new Error('Piston no respondió a tiempo')
    if (e.cause?.code === 'ECONNREFUSED') throw new Error(`No se pudo conectar con Piston en ${PISTON_URL}. ¿Está corriendo Docker?`)
    throw e
  } finally {
    clearTimeout(temporizador)
  }
}

// Versión instalada de cada lenguaje (se guarda 60 s para no consultar en cada ejecución)
async function cargarVersiones(forzar = false) {
  if (versiones && !forzar && Date.now() - versionesTs < 60000) return versiones
  const runtimes = await pedir('/runtimes')
  const v = {}
  for (const r of runtimes) {
    for (const nombre of [r.language, ...(r.aliases || [])]) {
      if (!v[nombre] || compararVersion(r.version, v[nombre]) > 0) v[nombre] = r.version
    }
  }
  versiones = v
  versionesTs = Date.now()
  return v
}

// Para el panel del profesor: ¿Piston está vivo y con Python / C++ instalados?
async function estadoMotor() {
  try {
    const v = await cargarVersiones(true)
    const lenguajes = {}
    for (const [clave, cfg] of Object.entries(LENGUAJES)) lenguajes[clave] = v[cfg.piston] || null
    const ok = Object.values(lenguajes).every(Boolean)
    return { ok, url: PISTON_URL, lenguajes, mensaje: ok ? 'Motor listo' : 'Falta instalar algún lenguaje en Piston' }
  } catch (e) {
    return { ok: false, url: PISTON_URL, lenguajes: {}, mensaje: e.message }
  }
}

// Quita rutas internas de Piston de los mensajes de error y limita su tamaño
function limpiarMensaje(texto) {
  return String(texto || '')
    .replace(/\/piston\/jobs\/[0-9a-f-]+\//gi, '')
    .replace(/\/box\//g, '')
    .slice(0, 2000)
    .trim()
}

/**
 * Ejecuta un programa con una entrada.
 * Devuelve { estado, salida, error, ms }
 *   estado: 'OK' | 'COMPILACION' | 'TIEMPO' | 'EJECUCION' | 'INTERNO'
 */
async function ejecutar({ lenguaje, codigo, entrada = '', limiteMs = 2000 }) {
  const cfg = LENGUAJES[lenguaje]
  if (!cfg) return { estado: 'INTERNO', salida: '', error: `Lenguaje no soportado: ${lenguaje}`, ms: 0 }

  const inicio = Date.now()
  try {
    const v = await cargarVersiones()
    const version = v[cfg.piston]
    if (!version) return { estado: 'INTERNO', salida: '', error: `${cfg.nombre} no está instalado en Piston`, ms: 0 }

    const r = await pedir('/execute', {
      metodo: 'POST',
      timeoutMs: limiteMs + 25000,
      cuerpo: {
        language: cfg.piston,
        version,
        files: archivos(lenguaje, codigo),
        stdin: entrada.endsWith('\n') ? entrada : entrada + '\n',
        compile_timeout: 10000,
        run_timeout: limiteMs,
        run_memory_limit: MEMORIA_MAX
      }
    })
    const ms = Date.now() - inicio

    if (r.compile && (r.compile.code !== 0 || r.compile.status)) {
      const msg = r.compile.status === 'TO' ? 'La compilación tardó demasiado.' : (r.compile.stderr || r.compile.output || r.compile.message)
      return { estado: 'COMPILACION', salida: '', error: limpiarMensaje(msg), ms }
    }

    const run = r.run || {}
    if (run.status === 'TO') {
      return { estado: 'TIEMPO', salida: run.stdout || '', error: `Superó el límite de ${limiteMs / 1000} s (¿un ciclo infinito?).`, ms }
    }
    if (run.status === 'OL' || run.status === 'EL') {
      return { estado: 'EJECUCION', salida: run.stdout || '', error: 'El programa imprimió demasiado texto.', ms }
    }
    if (run.status === 'XX') {
      return { estado: 'INTERNO', salida: '', error: limpiarMensaje(run.message || 'Error interno de Piston'), ms }
    }
    if (run.signal || run.code !== 0) {
      const msg = run.stderr || run.message ||
        (run.signal === 'SIGKILL' ? 'El programa fue detenido (posible exceso de memoria).' : `El programa terminó con error (código ${run.code}).`)
      return { estado: 'EJECUCION', salida: run.stdout || '', error: limpiarMensaje(msg) + pista(msg), ms }
    }
    return { estado: 'OK', salida: run.stdout || '', error: '', ms }
  } catch (e) {
    return { estado: 'INTERNO', salida: '', error: e.message, ms: Date.now() - inicio }
  }
}

module.exports = { ejecutar, estadoMotor, LENGUAJES, ENVOLTORIO_PYTHON }
