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

  socket.on('join_room', (data) => {
    const { roomId, username } = data;
    socket.join(roomId);
    socket.username = username;

    let room = rooms.get(roomId);
    if (!room) {
      room = {
        id: roomId,
        hostId: socket.id,
        hostName: username,
        shapes: [],
        undoStack: [],
        redoStack: [],
        camera: { x: 0, y: 0, scale: 1 },
        users: [],
        allowedDrawers: [socket.id]
      };
      rooms.set(roomId, room);
    } else if (!room.hostId) {
      room.hostId = socket.id;
      room.hostName = username;
      if (!room.allowedDrawers.includes(socket.id)) {
        room.allowedDrawers.push(socket.id);
      }
    }

    // Add user to room list
    if (!room.users) room.users = [];
    room.users.push({ id: socket.id, username });

    // Send current room state to the user
    socket.emit('room_state', {
      shapes: room.shapes,
      hostId: room.hostId,
      hostName: room.hostName,
      camera: room.camera,
      isHost: room.hostId === socket.id,
      users: room.users,
      allowedDrawers: room.allowedDrawers
    });

    // Notify others
    socket.to(roomId).emit('user_joined', { userId: socket.id, username });
    io.to(roomId).emit('room_users', room.users);
  });

  socket.on('draw_shape', (data) => {
    const room = rooms.get(data.roomId);
    if (room && room.allowedDrawers.includes(socket.id)) {
      room.undoStack.push(JSON.parse(JSON.stringify(room.shapes)));
      room.redoStack = [];
      room.shapes.push(data.shape);
      socket.to(data.roomId).emit('new_shape', data.shape);
    }
  });

  socket.on('update_shape', (data) => {
    const room = rooms.get(data.roomId);
    if (room && room.allowedDrawers.includes(socket.id)) {
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
    if (room && room.allowedDrawers.includes(socket.id)) {
      room.undoStack.push(JSON.parse(JSON.stringify(room.shapes)));
      room.redoStack = [];
      room.shapes = [];
      io.to(roomId).emit('room_state_update', room.shapes);
    }
  });

  socket.on('undo', (roomId) => {
    const room = rooms.get(roomId);
    if (room && room.allowedDrawers.includes(socket.id) && room.undoStack.length > 0) {
      room.redoStack.push(JSON.parse(JSON.stringify(room.shapes)));
      room.shapes = room.undoStack.pop();
      io.to(roomId).emit('room_state_update', room.shapes);
    }
  });

  socket.on('redo', (roomId) => {
    const room = rooms.get(roomId);
    if (room && room.allowedDrawers.includes(socket.id) && room.redoStack.length > 0) {
      room.undoStack.push(JSON.parse(JSON.stringify(room.shapes)));
      room.shapes = room.redoStack.pop();
      io.to(roomId).emit('room_state_update', room.shapes);
    }
  });

  socket.on('toggle_draw_permission', (data) => {
    const { roomId, userId } = data;
    const room = rooms.get(roomId);
    if (room && room.hostId === socket.id) {
      if (room.allowedDrawers.includes(userId)) {
        room.allowedDrawers = room.allowedDrawers.filter(id => id !== userId);
      } else {
        room.allowedDrawers.push(userId);
      }
      io.to(roomId).emit('permissions_updated', room.allowedDrawers);
    }
  });

  const handleLeaveRoom = (socket, roomId) => {
    const room = rooms.get(roomId);
    if (room) {
      // Remove user from the list
      room.users = room.users.filter(u => u.id !== socket.id);
      room.allowedDrawers = room.allowedDrawers.filter(id => id !== socket.id);
      
      if (room.hostId === socket.id) {
        // Assign a new host if any users remain
        if (room.users.length > 0) {
          const newHost = room.users[0];
          room.hostId = newHost.id;
          room.hostName = newHost.username;
          if (!room.allowedDrawers.includes(room.hostId)) {
            room.allowedDrawers.push(room.hostId);
          }
          io.to(roomId).emit('host_changed', { hostId: room.hostId, hostName: room.hostName });
          io.to(roomId).emit('permissions_updated', room.allowedDrawers);
        } else {
          // Delete room if empty
          rooms.delete(roomId);
        }
      }
      
      // Broadcast updated user list
      io.to(roomId).emit('room_users', room.users);
      socket.leave(roomId);
    }
  };

  socket.on('leave_room', (roomId) => {
    handleLeaveRoom(socket, roomId);
  });

  socket.on('disconnecting', () => {
    for (const roomId of socket.rooms) {
      if (roomId !== socket.id) {
        handleLeaveRoom(socket, roomId);
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
