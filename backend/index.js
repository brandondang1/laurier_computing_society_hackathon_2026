// Node.js backend (Express)
const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);

// Initialize Socket.io with CORS
const io = new Server(server, {
  cors: {
    origin: "*", // Allow all origins for the hackathon project
    methods: ["GET", "POST"]
  }
});

// Enable CORS for React frontend
app.use(cors());

// Store the current state of the board
let boardState = [];

app.get('/api/data', (req, res) => {
  res.json({ message: 'Hello from Node!' });
});

// Real-time communication logic
io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);

  // Send the current board state to the newly connected user
  socket.emit('init-state', boardState);

  // When a user draws, update boardState and broadcast to all other clients
  socket.on('draw', (data) => {
    // Update local state: if line exists (by id), replace it; otherwise, add it.
    const index = boardState.findIndex((l) => l.id === data.id);
    if (index !== -1) {
      boardState[index] = data;
    } else {
      boardState.push(data);
    }
    socket.broadcast.emit('draw', data);
  });

  // When a user clears the board, clear boardState and broadcast it
  socket.on('clear', () => {
    boardState = [];
    socket.broadcast.emit('clear');
  });

  socket.on('disconnect', () => {
    console.log('A user disconnected:', socket.id);
  });
});

server.listen(8080, () => {
  console.log('Server running on port 8080');
}); 
 