import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
const app = express();

app.use(cors());
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: '*',
    }
});

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);
  
    socket.on('line', (data) => {
        console.log(data);
        socket.broadcast.emit('line', data);
    });
  
    socket.on('undo', (data) => socket.broadcast.emit('undo', data));
    socket.on('redo', (data) => socket.broadcast.emit('redo', data));
    socket.on('clear', () => socket.broadcast.emit('clear'));

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
    });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
});
