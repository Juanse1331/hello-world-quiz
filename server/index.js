// Lee server/.env sin importar desde qué carpeta se arranque el servidor
require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'aceis2024';
// Token aleatorio por arranque: no expone la contraseña y valida las acciones de admin por socket
const ADMIN_TOKEN = require('crypto').randomBytes(24).toString('hex');

// --- Competencia: preguntas + problemas de programación (ver server/competencia/) ---
const leerBanco = (archivo) => JSON.parse(fs.readFileSync(path.join(__dirname, 'data', archivo), 'utf-8'));
const { crearGestorCompetencias } = require('./competencia');
const gestor = crearGestorCompetencias({
  io,
  bancoPreguntas: leerBanco('banco_preguntas.json'),
  bancoProblemas: leerBanco('banco_problemas.json'),
  adminToken: ADMIN_TOKEN,
  generarCodigo: codigoLibre,
  rutaGuardado: path.join(__dirname, 'data', 'competencias-guardadas.json'),
  config: {
    enviosSimultaneos: parseInt(process.env.RETO_ENVIOS_SIMULTANEOS) || 4,
    pruebasParalelas: parseInt(process.env.RETO_PRUEBAS_PARALELAS) || 3,
    esperaEnvioMs: (parseInt(process.env.RETO_ESPERA_ENVIO_S) || 10) * 1000
  }
});
// Guardar el estado de las competencias antes de cerrar el servidor (Ctrl+C)
['SIGINT', 'SIGTERM'].forEach(senal => process.on(senal, () => {
  gestor.guardarYa();
  process.exit(0);
}));

// --- REST API ---
app.post('/api/admin/auth', (req, res) => {
  const { password } = req.body;
  if (password === ADMIN_PASSWORD) {
    res.json({ ok: true, token: ADMIN_TOKEN });
  } else {
    res.status(401).json({ ok: false, mensaje: 'Contraseña incorrecta' });
  }
});

// Si alguien abre la API desde el navegador (p. ej. /api/preguntas) ve a Sammy con el error 401;
// las peticiones del panel (fetch) reciben JSON
function noAutorizado(req, res) {
  const indexPath = path.join(__dirname, 'public', 'index.html');
  res.status(401);
  if (req.accepts(['json', 'html']) === 'html' && fs.existsSync(indexPath)) return res.sendFile(indexPath);
  res.json({ ok: false, mensaje: 'No autorizado' });
}

// Rutas del profesor (requieren el token de admin en la cabecera x-admin-token)
function exigirAdmin(req, res, next) {
  if (req.get('x-admin-token') === ADMIN_TOKEN) return next();
  noAutorizado(req, res);
}

// El banco incluye las respuestas correctas: solo el profesor puede verlo
app.get('/api/admin/banco', exigirAdmin, (req, res) => {
  res.json(gestor.bancoAdmin());
});

app.get('/api/admin/motor', exigirAdmin, async (req, res) => {
  res.json(await gestor.estadoMotor());
});

// Cualquier otra ruta de la API (como la antigua /api/preguntas) no es pública
app.all('/api/*', noAutorizado);

// SPA fallback
app.get('*', (req, res) => {
  const indexPath = path.join(__dirname, 'public', 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.json({ mensaje: 'Hello World ACEIS API corriendo. Cliente no construido aún.' });
  }
});

// --- Helpers ---
function generarCodigoSala() {
  const letras = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const nums = '0123456789';
  let codigo = '';
  for (let i = 0; i < 4; i++) codigo += letras[Math.floor(Math.random() * letras.length)];
  codigo += '-';
  for (let i = 0; i < 4; i++) codigo += nums[Math.floor(Math.random() * nums.length)];
  return codigo;
}

function codigoLibre() {
  let codigo = generarCodigoSala();
  while (gestor.existe(codigo)) codigo = generarCodigoSala();
  return codigo;
}

// --- Socket.io ---
io.on('connection', (socket) => {
  gestor.registrarSocket(socket);
  socket.on('estudiante:unirse', (data, callback) => gestor.unirse(socket, data, callback));
});

httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(` Hello World ACEIS corriendo en http://localhost:${PORT}`);
  console.log(` Panel del profesor: http://localhost:${PORT}/admin`);
});
