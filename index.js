const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');


const {
  crearPartida,
  unirseAPartida,
  iniciarRonda,
  iniciarVotacion,
  manejarVoto
} = require('./logic/gameManager');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' } // desarrollo
});



app.use(express.static(path.join(__dirname, 'public')));



io.on('connection', socket => {
  console.log('Conectado:', socket.id);

  /* ==========
     PARTIDAS
  ========== */

  socket.on('crear_partida', ({ nombre, rondasTotales }, cb) => {
    const codigo = crearPartida(socket.id, nombre, rondasTotales);
    socket.join(codigo);
    cb({ codigo });
  });

  socket.on('unirse_partida', ({ codigo, nombre }, cb) => {
    const res = unirseAPartida(codigo, socket.id, nombre);
    if (!res.ok) return cb(res);

    socket.join(codigo);
    io.to(codigo).emit('jugadores_actualizados', res.jugadores);
    cb({ ok: true });
  });

  /* ==========
     JUEGO
  ========== */

  socket.on('iniciar_ronda', ({ codigo }) => {
    const info = iniciarRonda(codigo);
    if (!info) return;

    info.jugadores.forEach(j => {
      io.to(j.id).emit('rol_asignado', {
        rol: j.rol,
        palabra: j.rol === 'vecino' ? info.palabra : null,
        ronda: info.ronda
      });
    });
  });

  socket.on('iniciar_votacion', ({ codigo }) => {
    const ok = iniciarVotacion(codigo);
    if (ok) io.to(codigo).emit('votacion_iniciada');
  });

  socket.on('votar', ({ codigo, votadoId }) => {
    const res = manejarVoto(codigo, socket.id, votadoId);
    if (!res.completo) return;

    if (res.partidaFinalizada) {
      io.to(codigo).emit('partida_finalizada', res);
    } else {
      io.to(codigo).emit('resultado_ronda', res.resultado);
    }
  });

  socket.on('disconnect', () => {
    console.log('Desconectado:', socket.id);
  });
});
const PORT=process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0',() =>{
	console.log('Servidor escuchando en el puerto'+PORT);
});

});
