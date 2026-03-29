// Node.js backend (Express)
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
  }
});

const rooms = new Map();

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('join_room', (roomId) => {
    socket.join(roomId);

    let room = rooms.get(roomId);
    if (!room) {
      room = {
        id: roomId,
        hostId: socket.id,
        shapes: [],
        camera: { x: 0, y: 0, scale: 1 }
      };
      rooms.set(roomId, room);
    } else if (!room.hostId) {
      room.hostId = socket.id;
    }

    // Send current room state to the user
    socket.emit('room_state', {
      shapes: room.shapes,
      hostId: room.hostId,
      camera: room.camera,
      isHost: room.hostId === socket.id
    });

    // Notify others
    socket.to(roomId).emit('user_joined', { userId: socket.id });
  });

  socket.on('draw_shape', (data) => {
    const room = rooms.get(data.roomId);
    if (room) {
      room.shapes.push(data.shape);
      socket.to(data.roomId).emit('new_shape', data.shape);
    }
  });

  socket.on('update_shape', (data) => {
    const room = rooms.get(data.roomId);
    if (room) {
      const shapeIndex = room.shapes.findIndex(s => s.id === data.shape.id);
      if (shapeIndex !== -1) {
        room.shapes[shapeIndex] = data.shape;
        socket.to(data.roomId).emit('shape_updated', data.shape);
      }
    }
  });

  socket.on('update_camera', (data) => {
    const room = rooms.get(data.roomId);
    if (room && room.hostId === socket.id) {
      room.camera = data.camera;
      socket.to(data.roomId).emit('camera_updated', data.camera);
    }
  });

  socket.on('clear_canvas', (roomId) => {
    const room = rooms.get(roomId);
    if (room && room.hostId === socket.id) {
      room.shapes = [];
      io.to(roomId).emit('canvas_cleared');
    }
  });

  socket.on('disconnecting', () => {
    for (const roomId of socket.rooms) {
      if (roomId !== socket.id) {
        const room = rooms.get(roomId);
        if (room && room.hostId === socket.id) {
          // If host leaves, assign a new host or leave it null
          room.hostId = null;
          io.to(roomId).emit('host_left');
        }
      }
    }
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

const PORT = 8080;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
