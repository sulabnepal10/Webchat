require('dotenv').config();

const crypto = require('crypto');
const path = require('path');
const express = require('express');
const session = require('express-session');
const { createServer } = require('http');
const { Server } = require('socket.io');

const users = require('./store/users');
const { tooManyAttempts } = require('./store/rateLimit');

const USERNAME_RE = /^[a-zA-Z0-9_-]{3,20}$/;
const MAX_MESSAGE_LENGTH = 2000;
const MAX_HISTORY = 200;

if (!process.env.SESSION_SECRET) {
    console.warn('[warn] SESSION_SECRET is not set — using an insecure development default. Set it in .env for any real deployment.');
}

const app = express();
const server = createServer(app);
const io = new Server(server);

const sessionMiddleware = session({
    secret: process.env.SESSION_SECRET || 'dev-secret-change-me',
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        sameSite: 'lax',
        maxAge: 1000 * 60 * 60 * 24 * 7,
    },
});

app.use(express.json());
app.use(sessionMiddleware);
app.use(express.static(path.join(__dirname, 'public')));

function validateCredentials(username, password) {
    if (typeof username !== 'string' || !USERNAME_RE.test(username)) {
        return 'Username must be 3-20 characters: letters, numbers, underscores, or hyphens.';
    }
    if (typeof password !== 'string' || password.length < 8) {
        return 'Password must be at least 8 characters.';
    }
    return null;
}

app.post('/api/register', (req, res) => {
    const ip = req.ip;
    if (tooManyAttempts(`register:${ip}`)) {
        return res.status(429).json({ error: 'Too many attempts. Try again in a minute.' });
    }

    const { username, password } = req.body || {};
    const validationError = validateCredentials(username, password);
    if (validationError) return res.status(400).json({ error: validationError });

    if (users.findByUsername(username)) {
        return res.status(409).json({ error: 'That username is already taken.' });
    }

    const user = users.createUser(username, password);
    req.session.username = user.username;
    res.json({ username: user.username });
});

app.post('/api/login', (req, res) => {
    const ip = req.ip;
    if (tooManyAttempts(`login:${ip}`)) {
        return res.status(429).json({ error: 'Too many attempts. Try again in a minute.' });
    }

    const { username, password } = req.body || {};
    if (typeof username !== 'string' || typeof password !== 'string') {
        return res.status(400).json({ error: 'Username and password are required.' });
    }

    const user = users.findByUsername(username);
    if (!user || !users.verifyPassword(password, user.passwordHash)) {
        return res.status(401).json({ error: 'Invalid username or password.' });
    }

    req.session.username = user.username;
    res.json({ username: user.username });
});

app.post('/api/logout', (req, res) => {
    req.session.destroy(() => res.json({ ok: true }));
});

app.get('/api/me', (req, res) => {
    if (!req.session.username) return res.status(401).json({ error: 'Not logged in.' });
    res.json({ username: req.session.username });
});

io.engine.use(sessionMiddleware);

io.use((socket, next) => {
    const username = socket.request.session && socket.request.session.username;
    if (!username) return next(new Error('unauthorized'));
    socket.username = username;
    next();
});

const onlineUsers = new Map();
let chatHistory = [];

io.on('connection', (socket) => {
    onlineUsers.set(socket.id, socket.username);
    socket.broadcast.emit('user-joined', socket.username);
    io.emit('user-list', [...new Set(onlineUsers.values())]);
    socket.emit('chat-history', chatHistory);

    socket.on('send', (message) => {
        if (typeof message !== 'string') return;
        const trimmed = message.trim().slice(0, MAX_MESSAGE_LENGTH);
        if (!trimmed) return;

        const msgData = {
            id: crypto.randomUUID(),
            message: trimmed,
            name: socket.username,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };
        chatHistory.push(msgData);
        if (chatHistory.length > MAX_HISTORY) chatHistory = chatHistory.slice(-MAX_HISTORY);
        io.emit('receive', msgData);
    });

    socket.on('delete-message', (id) => {
        const index = chatHistory.findIndex((m) => m.id === id && m.name === socket.username);
        if (index === -1) return;
        chatHistory.splice(index, 1);
        io.emit('message-deleted', id);
    });

    socket.on('typing', () => {
        socket.broadcast.emit('typing', socket.username);
    });

    socket.on('stop-typing', () => {
        socket.broadcast.emit('stop-typing', socket.username);
    });

    socket.on('disconnect', () => {
        onlineUsers.delete(socket.id);
        socket.broadcast.emit('left', socket.username);
        io.emit('user-list', [...new Set(onlineUsers.values())]);
    });
});

const PORT = process.env.PORT || 8000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
