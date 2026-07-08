'use strict';

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cookieParser = require('cookie-parser');

module.exports = function createServer() {
  const app = express();
  const server = http.createServer(app);
  const io = new Server(server, {
    cors: {
      origin: process.env.NODE_ENV === 'production' ? (process.env.CORS_ORIGIN || false) : '*',
      credentials: true
    },
    pingInterval: 25000,
    pingTimeout: 60000,
    maxHttpBufferSize: 1e6
  });

  app.set('trust proxy', 1);

  const PORT = 3000;
  const HOST = '0.0.0.0';

  server.requestTimeout = 75000;
  server.headersTimeout = 70000;
  server.keepAliveTimeout = 65000;
  server.clientTrackingDisabled = false;

  // Body parsers and cookie (core early middleware)
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));
  app.use(cookieParser());

  return { app, server, io, PORT, HOST };
};
