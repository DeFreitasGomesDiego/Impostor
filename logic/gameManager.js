const { getPalabraAleatoria } = require('../db/words');

const partidas = new Map();

/* =====================
   Utilidades
===================== */

function generarCodigoUnico() {
  const letras = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let codigo;
  do {
    codigo = Array.from({ length: 4 }, () =>
      letras[Math.floor(Math.random() * letras.length)]
    ).join('');
  } while (partidas.has(codigo));
  return codigo;
}

/* =====================
   Gestión de partidas
===================== */

function crearPartida(socketId, nombreHost, rondasTotales) {
  const codigo = generarCodigoUnico();

  partidas.set(codigo, {
    hostId: socketId,
    jugadores: [{ id: socketId, nombre: nombreHost, puntos: 0 }],
    estado: 'esperando', // esperando | jugando | votacion | fin_ronda | finalizada
    palabra: null,
    impostorId: null,
    votos: {},
    configuracion: {
      rondasTotales,
      rondaActual: 0
    }
  });

  return codigo;
}

function unirseAPartida(codigo, socketId, nombre) {
  const partida = partidas.get(codigo);
  if (!partida) return { ok: false, error: 'Partida no encontrada' };
  if (partida.estado !== 'esperando')
    return { ok: false, error: 'La partida ya comenzó' };

  partida.jugadores.push({ id: socketId, nombre, puntos: 0 });
  return { ok: true, jugadores: partida.jugadores };
}

/* =====================
   Rondas
===================== */

function iniciarRonda(codigo) {
  const partida = partidas.get(codigo);
  if (!partida) return null;
  if (!['esperando', 'fin_ronda'].includes(partida.estado)) return null;

  partida.configuracion.rondaActual++;

  const palabra = getPalabraAleatoria();
  const impostor =
    partida.jugadores[Math.floor(Math.random() * partida.jugadores.length)];

  partida.estado = 'jugando';
  partida.palabra = palabra;
  partida.impostorId = impostor.id;
  partida.votos = {};

  return {
    palabra,
    ronda: partida.configuracion.rondaActual,
    jugadores: partida.jugadores.map(j => ({
      id: j.id,
      rol: j.id === impostor.id ? 'impostor' : 'vecino'
    }))
  };
}

function iniciarVotacion(codigo) {
  const partida = partidas.get(codigo);
  if (!partida) return false;
  if (partida.estado !== 'jugando') return false;

  partida.estado = 'votacion';
  partida.votos = {};
  return true;
}

/* =====================
   Votaciones
===================== */

function manejarVoto(codigo, quienVota, votadoId) {
  const partida = partidas.get(codigo);
  if (!partida) return { completo: false };
  if (partida.estado !== 'votacion') return { completo: false };

  partida.votos[quienVota] = votadoId;

  if (Object.keys(partida.votos).length < partida.jugadores.length) {
    return { completo: false };
  }

  // Conteo
  const conteo = {};
  Object.values(partida.votos).forEach(id => {
    conteo[id] = (conteo[id] || 0) + 1;
  });

  let masVotado = null;
  let maxVotos = 0;

  for (const [id, cantidad] of Object.entries(conteo)) {
    if (cantidad > maxVotos) {
      masVotado = id;
      maxVotos = cantidad;
    }
  }

  const impostorDescubierto = masVotado === partida.impostorId;

  // Puntuación
  partida.jugadores.forEach(j => {
    if (j.id === partida.impostorId && !impostorDescubierto) j.puntos++;
    if (j.id !== partida.impostorId && impostorDescubierto) j.puntos++;
  });

  partida.estado = 'fin_ronda';

  // ¿Fin de partida?
  if (partida.configuracion.rondaActual >= partida.configuracion.rondasTotales) {
    partida.estado = 'finalizada';

    const maxPuntos = Math.max(...partida.jugadores.map(j => j.puntos));
    const ganadores = partida.jugadores.filter(j => j.puntos === maxPuntos);

    return {
      completo: true,
      partidaFinalizada: true,
      ganadores,
      puntuaciones: partida.jugadores
    };
  }

  return {
    completo: true,
    partidaFinalizada: false,
    resultado: {
      impostorId: partida.impostorId,
      votos: partida.votos,
      ganaVecinos: impostorDescubierto,
      puntuaciones: partida.jugadores
    }
  };
}

/* =====================
   Exportaciones
===================== */

module.exports = {
  crearPartida,
  unirseAPartida,
  iniciarRonda,
  iniciarVotacion,
  manejarVoto
};
