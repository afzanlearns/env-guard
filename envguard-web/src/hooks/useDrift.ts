import { useEffect, useState } from 'react';
import { getSocket } from '../lib/socket';

export const useDrift = (projectId: string | null) => {
  const [driftPayload, setDriftPayload] = useState<any | null>(null);

  useEffect(() => {
    if (!projectId) return;

    const socket = getSocket();

    // Join the project's room
    socket.emit('join_project', projectId);

    const onDriftUpdate = (payload: any) => {
      console.log('Drift update received:', payload);
      setDriftPayload(payload);
    };

    socket.on('drift:update', onDriftUpdate);

    return () => {
      socket.off('drift:update', onDriftUpdate);
    };
  }, [projectId]);

  return { driftPayload, resetDriftAlert: () => setDriftPayload(null) };
};
