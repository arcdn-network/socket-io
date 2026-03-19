require('dotenv').config({ quiet: true });
const express = require('express');
const cors = require('cors');
const { createServer } = require('http');
const { Server } = require('socket.io');

const port = 8080;
const SOCKET_SECRET = process.env.SOCKET_SECRET;

const app = express();

app.use(express.json());
app.use(cors({ origin: true, credentials: true }));

const httpServer = createServer(app);

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

httpServer.listen(port, '0.0.0.0', () => {
  console.log('Servidor corriendo Puerto: ' + port);
});
