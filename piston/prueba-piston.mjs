// Prueba de Piston para Hello World Quiz (fase 1)
// Uso:
//   node prueba-piston.mjs           -> instala Python y C++ (si faltan) y corre las pruebas
//   node prueba-piston.mjs --carga   -> además simula 40 estudiantes enviando C++ al mismo tiempo
// Requiere Node 18 o superior.

const BASE = (process.env.PISTON_URL || 'http://127.0.0.1:2000') + '/api/v2'
const CARGA = process.argv.includes('--carga')
const ESTUDIANTES_CARGA = 40

let fallos = 0
const ok = (msg) => console.log(`  ✅ ${msg}`)
const mal = (msg) => { fallos++; console.log(`  ❌ ${msg}`) }
const info = (msg) => console.log(`  ·  ${msg}`)
const titulo = (msg) => console.log(`\n▶ ${msg}`)
const esperar = (ms) => new Promise(r => setTimeout(r, ms))

async function api(ruta, metodo = 'GET', cuerpo) {
  const res = await fetch(BASE + ruta, {
    method: metodo,
    headers: { 'Content-Type': 'application/json' },
    body: cuerpo ? JSON.stringify(cuerpo) : undefined
  })
  const texto = await res.text()
  let datos
  try { datos = JSON.parse(texto) } catch { datos = texto }
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${datos?.message || texto}`)
  return datos
}

// Compara versiones tipo "3.10.0" > "3.9.4"
function compararVersion(a, b) {
  const x = a.split('.').map(Number), y = b.split('.').map(Number)
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    const d = (x[i] || 0) - (y[i] || 0)
    if (d) return d
  }
  return 0
}

async function instalarSiFalta(lenguaje) {
  const paquetes = await api('/packages')
  const delLenguaje = paquetes.filter(p => p.language === lenguaje)
  if (delLenguaje.length === 0) { mal(`No existe el paquete "${lenguaje}" en el repositorio de Piston`); return }
  const instalado = delLenguaje.find(p => p.installed)
  if (instalado) { ok(`${lenguaje} ${instalado.language_version} ya está instalado`); return }

  const ultima = delLenguaje.map(p => p.language_version).sort(compararVersion).at(-1)
  info(`Instalando ${lenguaje} ${ultima}... (la primera vez puede tardar varios minutos)`)
  try {
    await api('/packages', 'POST', { language: lenguaje, version: ultima })
  } catch (e) {
    info(`La petición de instalación se cortó (${e.message}). Reviso si terminó igual...`)
  }
  // Por si la petición se cortó por tiempo: consultar hasta 15 minutos
  for (let i = 0; i < 90; i++) {
    const ahora = await api('/packages')
    if (ahora.some(p => p.language === lenguaje && p.installed)) { ok(`${lenguaje} ${ultima} instalado`); return }
    await esperar(10000)
  }
  mal(`${lenguaje} no terminó de instalarse. Revisa: docker compose logs piston`)
}

let runtimes = []
function version(lenguaje) {
  return runtimes.find(r => r.language === lenguaje || r.aliases.includes(lenguaje))?.version
}

async function ejecutar(lenguaje, nombreArchivo, codigo, stdin = '', extra = {}) {
  const inicio = Date.now()
  const r = await api('/execute', 'POST', {
    language: lenguaje,
    version: version(lenguaje),
    files: [{ name: nombreArchivo, content: codigo }],
    stdin,
    compile_timeout: 10000,
    run_timeout: 3000,
    run_memory_limit: 256 * 1024 * 1024,
    ...extra
  })
  r.ms = Date.now() - inicio
  return r
}

const PY_SUMA = 'a, b = map(int, input().split())\nprint(a + b)\n'
const CPP_SUMA = '#include <iostream>\nint main() { long long a, b; std::cin >> a >> b; std::cout << a + b << std::endl; return 0; }\n'

async function main() {
  console.log(`Probando Piston en ${BASE}`)

  titulo('1. Conexión con Piston')
  try {
    runtimes = await api('/runtimes')
    ok(`Piston responde (${runtimes.length} lenguajes instalados)`)
  } catch (e) {
    mal(`No responde: ${e.message}`)
    console.log('\n   ¿Está corriendo? Ejecuta "docker compose up -d" en esta carpeta y espera unos segundos.')
    process.exit(1)
  }

  titulo('2. Instalar Python y C++ (paquete gcc)')
  await instalarSiFalta('python')
  await instalarSiFalta('gcc')
  runtimes = await api('/runtimes')
  info(`Python: ${version('python') || 'NO disponible'} · C++: ${version('c++') || 'NO disponible'}`)

  titulo('3. Python: leer dos números y sumar')
  try {
    const r = await ejecutar('python', 'main.py', PY_SUMA, '3 7')
    r.run.stdout.trim() === '10' ? ok(`Imprime 10 (${r.ms} ms)`) : mal(`Esperaba 10, obtuvo: ${JSON.stringify(r.run.output)}`)
  } catch (e) { mal(e.message) }

  titulo('4. C++: compilar, leer dos números y sumar')
  try {
    const r = await ejecutar('c++', 'main.cpp', CPP_SUMA, '-5 2')
    if (r.compile && r.compile.code !== 0) mal(`No compiló: ${r.compile.stderr}`)
    else r.run.stdout.trim() === '-3' ? ok(`Imprime -3 (compilar + ejecutar: ${r.ms} ms)`) : mal(`Esperaba -3, obtuvo: ${JSON.stringify(r.run.output)}`)
  } catch (e) { mal(e.message) }

  titulo('5. C++ con error de sintaxis → debe reportar error de compilación')
  try {
    const r = await ejecutar('c++', 'main.cpp', 'int main() { return 0 }', '')
    r.compile && r.compile.code !== 0
      ? ok(`Detectado. Primer mensaje: ${r.compile.stderr.split('\n').find(l => l.includes('error')) || r.compile.stderr.slice(0, 120)}`)
      : mal('Compiló algo que no debía compilar')
  } catch (e) { mal(e.message) }

  titulo('6. Bucle infinito → debe cortarse por tiempo (3 s)')
  try {
    const r = await ejecutar('python', 'main.py', 'while True:\n    pass\n')
    r.run.status === 'TO' || r.run.signal === 'SIGKILL'
      ? ok(`Cortado (status=${r.run.status}, señal=${r.run.signal}, ${r.ms} ms)`)
      : mal(`No se cortó como se esperaba: ${JSON.stringify(r.run)}`)
  } catch (e) { mal(e.message) }

  titulo('7. Sin acceso a internet desde el código del estudiante')
  try {
    const codigo = 'import urllib.request\ntry:\n    urllib.request.urlopen("https://example.com", timeout=2)\n    print("CON RED")\nexcept Exception:\n    print("BLOQUEADA")\n'
    const r = await ejecutar('python', 'main.py', codigo)
    r.run.stdout.trim() === 'BLOQUEADA' ? ok('La red está bloqueada') : mal(`El código SÍ tiene red: ${r.run.output}`)
  } catch (e) { mal(e.message) }

  titulo('8. Límite de memoria (256 MB) → pedir 1 GB debe fallar')
  try {
    const r = await ejecutar('python', 'main.py', 'x = bytearray(1024 ** 3)\nprint("RESERVADO")\n')
    r.run.stdout.trim() !== 'RESERVADO'
      ? ok(`Bloqueado (status=${r.run.status}, señal=${r.run.signal})`)
      : mal('Logró reservar 1 GB: el límite de memoria no funciona')
  } catch (e) { mal(e.message) }

  titulo('9. El código no corre como administrador (root)')
  try {
    const r = await ejecutar('python', 'main.py', 'import os\nprint(os.getuid())\n')
    const uid = r.run.stdout.trim()
    uid !== '0' ? ok(`Corre como usuario sin privilegios (uid ${uid})`) : mal('¡Corre como root!')
  } catch (e) { mal(e.message) }

  if (CARGA) {
    titulo(`10. Carga: ${ESTUDIANTES_CARGA} envíos de C++ al mismo tiempo`)
    const inicio = Date.now()
    const resultados = await Promise.allSettled(
      Array.from({ length: ESTUDIANTES_CARGA }, (_, i) => ejecutar('c++', 'main.cpp', CPP_SUMA, `${i} 1`))
    )
    const total = Date.now() - inicio
    const tiempos = []
    let buenos = 0
    resultados.forEach((res, i) => {
      if (res.status === 'fulfilled' && res.value.run?.stdout.trim() === String(i + 1)) { buenos++; tiempos.push(res.value.ms) }
    })
    tiempos.sort((a, b) => a - b)
    info(`Tiempo total: ${(total / 1000).toFixed(1)} s · más rápido: ${tiempos[0] ?? '-'} ms · más lento: ${tiempos.at(-1) ?? '-'} ms`)
    buenos === ESTUDIANTES_CARGA ? ok(`${buenos}/${ESTUDIANTES_CARGA} correctos`) : mal(`Solo ${buenos}/${ESTUDIANTES_CARGA} correctos`)
    const fallidos = resultados.filter(r => r.status === 'rejected').slice(0, 3)
    fallidos.forEach(f => info(`Ejemplo de fallo: ${f.reason?.message}`))
  }

  console.log(fallos === 0
    ? '\n🎉 Todo funcionó. Piston está listo para el modo reto.'
    : `\n⚠️  ${fallos} prueba(s) fallaron. Copia esta salida completa y revisémosla.`)
  process.exit(fallos ? 1 : 0)
}

main().catch(e => { console.error('\nError inesperado:', e); process.exit(1) })
