require('dotenv').config();
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

// Bonus por rapidez: una respuesta correcta suma hasta +50% de los puntos base,
// decayendo linealmente desde la publicación de la pregunta hasta el fin de la ventana.
const BONUS_MAX = 0.5;
const VENTANA_SIN_TIMER = 30; // segundos de referencia cuando el temporizador está desactivado

function calcularBonus(sala, puntosBase) {
  const ventanaMs = (sala.timerActivo ? sala.segundosPorPregunta : VENTANA_SIN_TIMER) * 1000;
  const transcurrido = Date.now() - sala.preguntaInicio;
  const fraccionRestante = Math.min(1, Math.max(0, 1 - transcurrido / ventanaMs));
  return Math.round(puntosBase * BONUS_MAX * fraccionRestante);
}

// Estado en memoria: Map<codigoSala, sala>
const salas = new Map();

// Cargar banco de preguntas
const bancoPreguntas = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'data', 'banco_preguntas.json'), 'utf-8')
);

// --- REST API ---
app.get('/api/preguntas', (req, res) => {
  res.json(bancoPreguntas);
});

app.post('/api/admin/auth', (req, res) => {
  const { password } = req.body;
  if (password === ADMIN_PASSWORD) {
    res.json({ ok: true, token: ADMIN_TOKEN });
  } else {
    res.status(401).json({ ok: false, mensaje: 'Contraseña incorrecta' });
  }
});

// SPA fallback
app.get('*', (req, res) => {
  const indexPath = path.join(__dirname, 'public', 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.json({ mensaje: 'Hello World Quiz ACEIS API corriendo. Cliente no construido aún.' });
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

function obtenerEstadoSala(sala) {
  return {
    codigo: sala.codigo,
    estado: sala.estado,
    preguntaActualIdx: sala.preguntaActualIdx,
    totalPreguntas: sala.preguntas.length,
    timerActivo: sala.timerActivo,
    segundosPorPregunta: sala.segundosPorPregunta,
    participantes: sala.participantes.map(p => ({
      id: p.id,
      nombre: p.nombre,
      codigoEstudiante: p.codigoEstudiante,
      puntaje: p.puntaje,
      respuestas: p.respuestas
    }))
  };
}

function calcularPuntaje(sala, participanteId) {
  const p = sala.participantes.find(x => x.id === participanteId);
  if (!p) return 0;
  return p.respuestas.reduce((acc, r) => acc + (r.puntos || 0), 0);
}

function limpiarTimers(sala) {
  if (sala.timerInterval) {
    clearInterval(sala.timerInterval);
    sala.timerInterval = null;
  }
  if (sala.avanceTimeout) {
    clearTimeout(sala.avanceTimeout);
    sala.avanceTimeout = null;
  }
}

function iniciarTimer(sala) {
  limpiarTimers(sala);
  sala.tiempoRestante = sala.segundosPorPregunta;

  sala.timerInterval = setInterval(() => {
    sala.tiempoRestante--;
    io.to(sala.codigo).emit('sala:timer-tick', { tiempoRestante: sala.tiempoRestante });

    if (sala.tiempoRestante <= 0) {
      clearInterval(sala.timerInterval);
      sala.timerInterval = null;
      sala.tiempoAgotado = true;
      const pregunta = sala.preguntas[sala.preguntaActualIdx];
      io.to(sala.codigo).emit('sala:tiempo-agotado', {
        respuestaCorrecta: pregunta?.respuesta_correcta,
        explicacion: pregunta?.explicacion || '',
        tema: pregunta?.tema || ''
      });
      // Avanzar automáticamente después de 2 segundos
      sala.avanceTimeout = setTimeout(() => {
        sala.avanceTimeout = null;
        if (sala.estado === 'en-curso') avanzarPregunta(sala);
      }, 2000);
    }
  }, 1000);
}

function emitirPreguntaActual(sala) {
  if (sala.preguntaActualIdx >= sala.preguntas.length) {
    terminarQuiz(sala);
    return;
  }

  sala.tiempoAgotado = false;
  sala.preguntaInicio = Date.now();
  const pregunta = sala.preguntas[sala.preguntaActualIdx];
  const preguntaParaEstudiante = {
    id: pregunta.id,
    nivel: pregunta.nivel,
    tipo: pregunta.tipo,
    puntos: pregunta.puntos,
    enunciado: pregunta.enunciado,
    opciones: pregunta.opciones,
    numero: sala.preguntaActualIdx + 1,
    total: sala.preguntas.length,
    segundos: sala.timerActivo ? sala.segundosPorPregunta : 0
  };

  io.to(sala.codigo).emit('sala:nueva-pregunta', preguntaParaEstudiante);

  if (sala.timerActivo) {
    iniciarTimer(sala);
  }
}

function avanzarPregunta(sala) {
  limpiarTimers(sala);
  sala.preguntaActualIdx++;
  if (sala.preguntaActualIdx >= sala.preguntas.length) {
    terminarQuiz(sala);
  } else {
    emitirPreguntaActual(sala);
    // Notificar al admin el nuevo estado
    if (sala.adminSocketId) {
      io.to(sala.adminSocketId).emit('sala:estado-actualizado', obtenerEstadoSala(sala));
    }
  }
}

function terminarQuiz(sala) {
  limpiarTimers(sala);
  sala.estado = 'terminado';

  const resultados = sala.participantes
    .map(p => ({
      id: p.id,
      nombre: p.nombre,
      codigoEstudiante: p.codigoEstudiante,
      puntaje: p.respuestas.reduce((acc, r) => acc + (r.puntos || 0), 0),
      totalCorrectas: p.respuestas.filter(r => r.esCorrecta).length,
      totalPreguntas: sala.preguntas.length,
      respuestas: sala.preguntas.map((preg, idx) => {
        const r = p.respuestas[idx] || { respuesta: null, esCorrecta: false, puntos: 0, opcionDada: '' };
        return {
          ...r,
          enunciado: preg.enunciado?.substring(0, 80) || '',
          respuestaCorrecta: preg.respuesta_correcta,
          opcionCorrecta: preg.opciones[preg.respuesta_correcta] || '',
          explicacion: preg.explicacion || '',
          tema: preg.tema || ''
        };
      })
    }))
    .sort((a, b) => b.puntaje - a.puntaje);

  io.to(sala.codigo).emit('sala:quiz-terminado', { resultados });
}

function salaDeAdmin(socket) {
  if (socket.data.rol !== 'admin') return null;
  return salas.get(socket.data.codigoSala);
}

// --- Socket.io ---
io.on('connection', (socket) => {
  console.log(`[Socket] Conectado: ${socket.id}`);

  // Admin crea sala
  socket.on('admin:crear-sala', (data, callback) => {
    const { token, preguntaIds, timerActivo, segundosPorPregunta } = data || {};
    if (token !== ADMIN_TOKEN) {
      if (callback) callback({ ok: false, mensaje: 'No autorizado' });
      return;
    }
    // Las preguntas se toman del banco del servidor (el cliente solo envía los ids)
    const preguntas = (Array.isArray(preguntaIds) ? preguntaIds : [])
      .map(id => bancoPreguntas.find(p => p.id === id))
      .filter(Boolean);
    if (preguntas.length === 0) {
      if (callback) callback({ ok: false, mensaje: 'Selecciona al menos una pregunta' });
      return;
    }
    let codigo = generarCodigoSala();
    while (salas.has(codigo)) codigo = generarCodigoSala();

    const sala = {
      codigo,
      adminSocketId: socket.id,
      preguntas,
      participantes: [],
      preguntaActualIdx: 0,
      estado: 'esperando', // esperando | en-curso | terminado
      timerActivo: !!timerActivo,
      segundosPorPregunta: Math.min(120, Math.max(5, parseInt(segundosPorPregunta) || 30)),
      timerInterval: null,
      tiempoRestante: 0,
      tiempoAgotado: false,
      preguntaInicio: 0,
      avanceTimeout: null
    };

    salas.set(codigo, sala);
    socket.join(codigo);
    socket.data.rol = 'admin';
    socket.data.codigoSala = codigo;

    console.log(`[Sala] Creada: ${codigo} (${preguntas.length} preguntas)`);
    if (callback) callback({ ok: true, codigo });
  });

  // Estudiante se une
  socket.on('estudiante:unirse', (data, callback) => {
    const { nombre, codigoEstudiante, codigoSala } = data || {};

    if (typeof nombre !== 'string' || typeof codigoEstudiante !== 'string' ||
        !nombre.trim() || !codigoEstudiante.trim()) {
      if (callback) callback({ ok: false, mensaje: 'Nombre y código de estudiante son obligatorios.' });
      return;
    }

    if (!salas.has(codigoSala)) {
      if (callback) callback({ ok: false, mensaje: 'Sala no encontrada. Verifica el código.' });
      return;
    }

    const sala = salas.get(codigoSala);

    if (sala.estado === 'terminado') {
      if (callback) callback({ ok: false, mensaje: 'Esta sesión ya terminó.' });
      return;
    }

    if (sala.estado === 'en-curso') {
      if (callback) callback({ ok: false, mensaje: 'El quiz ya inició. No puedes unirte ahora.' });
      return;
    }

    if (sala.participantes.some(p => p.codigoEstudiante === codigoEstudiante.trim())) {
      if (callback) callback({ ok: false, mensaje: 'Ya hay un participante con ese código de estudiante en la sala.' });
      return;
    }

    const participante = {
      id: socket.id,
      nombre: nombre.trim(),
      codigoEstudiante: codigoEstudiante.trim(),
      puntaje: 0,
      respuestas: []
    };

    sala.participantes.push(participante);
    socket.join(codigoSala);
    socket.data.rol = 'estudiante';
    socket.data.codigoSala = codigoSala;
    socket.data.participanteId = socket.id;

    console.log(`[Sala ${codigoSala}] Estudiante unido: ${nombre} (${codigoEstudiante})`);

    // Notificar al admin
    if (sala.adminSocketId) {
      io.to(sala.adminSocketId).emit('sala:participante-unido', {
        participante: { id: socket.id, nombre, codigoEstudiante },
        totalParticipantes: sala.participantes.length
      });
    }

    // Notificar a todos en la sala (para la lista de espera)
    io.to(codigoSala).emit('sala:lista-participantes', sala.participantes.map(p => ({
      nombre: p.nombre,
      codigoEstudiante: p.codigoEstudiante
    })));

    if (callback) callback({ ok: true, nombre, codigoSala });
  });

  // Admin inicia quiz
  socket.on('admin:iniciar-quiz', (data, callback) => {
    const sala = salaDeAdmin(socket);
    if (!sala) { if (callback) callback({ ok: false }); return; }

    if (sala.estado !== 'esperando') { if (callback) callback({ ok: false }); return; }
    sala.estado = 'en-curso';
    sala.preguntaActualIdx = 0;
    console.log(`[Sala ${sala.codigo}] Quiz iniciado`);

    emitirPreguntaActual(sala);
    if (callback) callback({ ok: true });
  });

  // Admin siguiente pregunta
  socket.on('admin:siguiente-pregunta', (data, callback) => {
    const sala = salaDeAdmin(socket);
    if (!sala || sala.estado !== 'en-curso') { if (callback) callback({ ok: false }); return; }

    avanzarPregunta(sala);
    if (callback) callback({ ok: true });
  });

  // Admin termina quiz
  socket.on('admin:terminar-quiz', (data, callback) => {
    const sala = salaDeAdmin(socket);
    if (!sala) { if (callback) callback({ ok: false }); return; }

    terminarQuiz(sala);
    if (callback) callback({ ok: true });
  });

  // Estudiante responde
  socket.on('estudiante:responder', (data, callback) => {
    const { respuesta } = data || {};
    const codigoSala = socket.data.codigoSala;
    const sala = salas.get(codigoSala);

    if (!sala || sala.estado !== 'en-curso' || sala.tiempoAgotado) {
      if (callback) callback({ ok: false, mensaje: 'Ya no se puede responder' });
      return;
    }

    const participante = sala.participantes.find(p => p.id === socket.id);
    if (!participante) { if (callback) callback({ ok: false }); return; }

    const idxPregunta = sala.preguntaActualIdx;
    if (participante.respuestas[idxPregunta] !== undefined) {
      if (callback) callback({ ok: false, mensaje: 'Ya respondiste esta pregunta' });
      return;
    }

    const pregunta = sala.preguntas[idxPregunta];
    if (!Number.isInteger(respuesta) || respuesta < 0 || respuesta >= pregunta.opciones.length) {
      if (callback) callback({ ok: false, mensaje: 'Respuesta inválida' });
      return;
    }
    const esCorrecta = respuesta === pregunta.respuesta_correcta;
    const puntosBase = esCorrecta ? pregunta.puntos : 0;
    const bonus = esCorrecta ? calcularBonus(sala, pregunta.puntos) : 0;
    const puntos = puntosBase + bonus;

    participante.respuestas[idxPregunta] = {
      respuesta,
      esCorrecta,
      puntos,
      puntosBase,
      bonus,
      opcionDada: pregunta.opciones[respuesta] || ''
    };
    participante.puntaje += puntos;

    // Notificar al admin con detalle
    if (sala.adminSocketId) {
      io.to(sala.adminSocketId).emit('sala:respuesta-recibida', {
        participanteId: socket.id,
        nombre: participante.nombre,
        codigoEstudiante: participante.codigoEstudiante,
        idxPregunta,
        respuesta,
        esCorrecta,
        puntos,
        puntosBase,
        bonus,
        puntajeTotal: participante.puntaje,
        totalRespondieron: sala.participantes.filter(p => p.respuestas[idxPregunta] !== undefined).length,
        totalParticipantes: sala.participantes.length
      });
    }

    if (callback) callback({
      ok: true,
      esCorrecta,
      puntos,
      puntosBase,
      bonus,
      respuestaCorrecta: pregunta.respuesta_correcta,
      explicacion: pregunta.explicacion,
      tema: pregunta.tema
    });
  });

  // Admin pide estado actual
  socket.on('admin:pedir-estado', (data, callback) => {
    const sala = salaDeAdmin(socket);
    if (!sala) { if (callback) callback({ ok: false }); return; }
    if (callback) callback({ ok: true, sala: obtenerEstadoSala(sala) });
  });

  // Desconexión
  socket.on('disconnect', () => {
    const { rol, codigoSala } = socket.data;
    if (!codigoSala || !salas.has(codigoSala)) return;

    const sala = salas.get(codigoSala);

    if (rol === 'admin') {
      console.log(`[Sala ${codigoSala}] Admin desconectado`);
      // No eliminar la sala, puede reconectarse
    } else if (rol === 'estudiante') {
      // Marcar como desconectado pero mantener sus respuestas
      const p = sala.participantes.find(x => x.id === socket.id);
      if (p) {
        console.log(`[Sala ${codigoSala}] Estudiante desconectado: ${p.nombre}`);
        if (sala.adminSocketId) {
          io.to(sala.adminSocketId).emit('sala:participante-desconectado', {
            participanteId: socket.id,
            nombre: p.nombre
          });
        }
      }
    }
  });
});

httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(` Hello World Quiz ACEIS corriendo en http://localhost:${PORT}`);
  console.log(` API preguntas: http://localhost:${PORT}/api/preguntas`);
});