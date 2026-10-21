require('dotenv').config({ quiet: true });
const express = require('express');
const cors = require('cors');
const { createServer } = require('http');
const { Server } = require('socket.io');

const port = Number(process.env.PORT || 8080);
const SOCKET_SECRET = process.env.SOCKET_SECRET;

const app = express();

app.use(express.json());
app.use(cors({ origin: true, credentials: true }));

const httpServer = createServer(app);

// Evita conexiones colgadas / acumulación de listeners por keep-alive
httpServer.keepAliveTimeout = 5000;
httpServer.headersTimeout = 6000;

// Red de seguridad adicional por si algo más sube el conteo de listeners
httpServer.on('connection', (socket) => {
  socket.setMaxListeners(25);
});

const io = new Server(httpServer, {
  cors: { origin: true, credentials: true },
});

io.on('connection', (socket) => {
  const userId = socket.handshake.auth?.userId;
  if (userId) socket.join(`user:${String(userId)}`);
});

const validateHeaders = (req, res, next) => {
  const secret = req.get('x-socket-secret');
  if (secret !== SOCKET_SECRET) return res.sendStatus(401);
  next();
};

const emitUserId = (event) => (req, res) => {
  const { userId, ...rest } = req.body || {};
  if (!userId) return res.sendStatus(400);

  io.to(`user:${String(userId)}`).emit(event, {
    userId: String(userId),
    ...rest,
  });

  return res.sendStatus(204);
};

app.get('/', (req, res) => {
  res.json({ server: 'online' });
});

app.post('/emit/payment', [validateHeaders], emitUserId('payment'));
app.post('/emit/logout', [validateHeaders], emitUserId('logout'));

app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed' || err instanceof SyntaxError) {
    return res.status(400).json({ error: 'JSON inválido' });
  }
  next(err);
});

httpServer.on('error', (error) => {
  console.error(`No se pudo iniciar el servidor de sockets en el puerto ${port}: ${error.code}`);
  process.exit(1);
});

httpServer.listen(port, '0.0.0.0', () => {
  console.log('Servidor corriendo Puerto: ' + port);
});
