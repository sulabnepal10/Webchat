const express = require('express');
const path = require('path');
const { createServer } = require('http');
const { Server } = require('socket.io');

const app = express();
const server = createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",  
        methods: ["GET", "POST"],
        credentials: true
    }
});

app.use(express.static(path.join(__dirname, '../../')));

const users = {};
const chatHistory = [];  

io.on('connection', (socket) => {
    socket.on('new-user-joined', (name) => {
        users[socket.id] = name;
        socket.broadcast.emit('user-joined', name);
        io.emit('user-list', Object.values(users));
        socket.emit('chat-history', chatHistory);
    });

    socket.on('send', (message) => {
        if (!message.trim()) return;
        const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const msgData = { message, name: users[socket.id], timestamp };
        chatHistory.push(msgData);
        socket.broadcast.emit('receive', msgData);
    });

    socket.on('typing', () => {
        socket.broadcast.emit('typing', users[socket.id]);
    });

    socket.on('stop-typing', () => {
        socket.broadcast.emit('stop-typing', users[socket.id]);
    });

    socket.on('user-logout', (name) => {
        socket.broadcast.emit('left', name);
        delete users[socket.id];
        io.emit('user-list', Object.values(users));
    });

    socket.on('disconnect', () => {
        if (users[socket.id]) {
            socket.broadcast.emit('left', users[socket.id]);
            delete users[socket.id];
            io.emit('user-list', Object.values(users));
        }
    });
});

const PORT = process.env.PORT || 8000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});