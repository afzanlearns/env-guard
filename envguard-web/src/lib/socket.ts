import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export const getSocket = () => {
  if (!socket) {
    socket = io('http://localhost:3000', {
      withCredentials: true,
      autoConnect: true,
    });

    socket.on('connect', () => {
      console.log('Socket connected gracefully.');
    });

    socket.on('disconnect', () => {
      console.log('Socket disconnected from server.');
    });
  }
  return socket;
};
