import { Server as SocketIOServer } from 'socket.io';
import { Server as HttpServer } from 'http';
import passport from 'passport';
import { RequestHandler, Request, Response, NextFunction } from 'express';

let io: SocketIOServer;

export const initializeSockets = (server: HttpServer, sessionMiddleware: RequestHandler) => {
  io = new SocketIOServer(server, {
    cors: {
      origin: 'http://localhost:5173',
      credentials: true
    }
  });

  // Share session middleware array
  const wrap = (middleware: any) => (socket: any, next: any) => middleware(socket.request, {}, next);
  
  io.use(wrap(sessionMiddleware));
  io.use(wrap(passport.initialize()));
  io.use(wrap(passport.session()));

  io.use((socket: any, next) => {
    if (socket.request.user) {
      next();
    } else {
      next(new Error('Unauthorized'));
    }
  });

  io.on('connection', (socket: any) => {
    console.log(`[Socket] User Connected: ${socket.request.user.id}`);

    socket.on('join_project', (projectId: string) => {
      // Typically we should verify the user belongs to the project via team_members
      // For this demo context, we let the authenticated user subscribe.
      socket.join(`project:${projectId}`);
      console.log(`[Socket] Joined room: project:${projectId}`);
    });

    socket.on('disconnect', () => {
      console.log(`[Socket] User Disconnected`);
    });
  });

  return io;
};

export const getIO = () => {
  if (!io) {
    throw new Error('Socket.io not initialized!');
  }
  return io;
};
