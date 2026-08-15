const form = document.getElementById('send-container');
const messageInput = document.getElementById('messageInp');
const messageContainer = document.querySelector('.container');
const newChatButton = document.getElementById('new-chat-btn');
const logoutButton = document.getElementById('logout-btn');
const welcomeMessage = document.getElementById('welcome-message');
const userListElement = document.createElement('div');
userListElement.id = 'user-list';
userListElement.style.margin = '10px';
document.body.insertBefore(userListElement, messageContainer);

const audio = new Audio('ting.mp3');
let username = null;
let typingTimeout;
const typingUsers = new Set();
let typingIndicator = null;

const formatTime = () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

const getInitials = (name) => {
    if (!name) return '?';
    const words = name.trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) return '?';
    if (words.length === 1) return words[0][0].toUpperCase();
    return words.slice(0, 2).map((word) => word[0].toUpperCase()).join('');
};

const append = (msgData, position, { playSound = true } = {}) => {
    const { id, message, name, timestamp = formatTime() } = msgData;
    const messageElement = document.createElement('div');
    messageElement.classList.add('message', position);
    if (id) messageElement.dataset.id = id;

    if (position === 'center') {
        const contentElement = document.createElement('div');
        contentElement.classList.add('message-content');
        contentElement.innerText = message;
        messageElement.appendChild(contentElement);
    } else {
        const initials = name ? getInitials(name) : '';
        const fullMessage = name ? `${initials}: ${message}` : message;
        const contentElement = document.createElement('div');
        contentElement.classList.add('message-content');
        contentElement.innerText = fullMessage;

        const timeElement = document.createElement('span');
        timeElement.classList.add('message-timestamp');
        timeElement.innerText = timestamp;

        const avatarElement = document.createElement('span');
        avatarElement.classList.add('message-avatar');
        avatarElement.innerText = initials;

        if (position === 'left') {
            messageElement.append(avatarElement, contentElement, timeElement);
        } else {
            messageElement.append(contentElement, timeElement);
        }

        if (position === 'right' && id) {
            const deleteBtn = document.createElement('button');
            deleteBtn.classList.add('delete-btn');
            deleteBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m-8 4v10m4-10v10m4-10v10M5 6l1 14a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-14H5z"/></svg>`;
            deleteBtn.onclick = () => socket.emit('delete-message', id);
            messageElement.appendChild(deleteBtn);
        }
    }

    messageContainer.append(messageElement);
    messageContainer.scrollTop = messageContainer.scrollHeight;
    if (playSound && position === 'left') audio.play().catch(() => {});
};

const updateTypingIndicator = () => {
    if (typingIndicator) {
        typingIndicator.remove();
        typingIndicator = null;
    }

    if (typingUsers.size > 0) {
        const usersArray = Array.from(typingUsers);
        const text = usersArray.length === 1
            ? `${usersArray[0]} is typing...`
            : `${usersArray.slice(0, -1).join(', ')} and ${usersArray[usersArray.length - 1]} are typing...`;

        typingIndicator = document.createElement('div');
        typingIndicator.classList.add('message', 'left');

        const contentElement = document.createElement('span');
        contentElement.classList.add('message-content');
        contentElement.textContent = text;

        const timeElement = document.createElement('span');
        timeElement.classList.add('message-timestamp');
        timeElement.textContent = formatTime();

        typingIndicator.append(contentElement, timeElement);
        messageContainer.append(typingIndicator);
        messageContainer.scrollTop = messageContainer.scrollHeight;
    }
};

let socket;

async function init() {
    let me;
    try {
        const response = await fetch('/api/me');
        if (!response.ok) throw new Error('unauthorized');
        me = await response.json();
    } catch {
        window.location.href = 'login.html';
        return;
    }

    username = me.username;
    welcomeMessage.innerText = `Welcome to Sacred Room, ${username}`;

    socket = io({ transports: ['websocket', 'polling'] });

    form.addEventListener('submit', (e) => {
        e.preventDefault();
        const message = messageInput.value.trim();
        if (!message) return;
        socket.emit('send', message);
        messageInput.value = '';
    });

    messageInput.addEventListener('input', () => {
        socket.emit('typing');
        clearTimeout(typingTimeout);
        typingTimeout = setTimeout(() => socket.emit('stop-typing'), 1000);
    });

    let firstConnect = true;
    socket.on('connect', () => {
        userListElement.innerHTML = `<strong>Status:</strong> Connected | <strong>Online Users:</strong> Loading...`;
        if (firstConnect) {
            append({ message: 'You joined the chat', timestamp: formatTime() }, 'center', { playSound: false });
            firstConnect = false;
        }
    });

    socket.on('disconnect', () => {
        userListElement.innerHTML = `<strong>Status:</strong> Disconnected | <strong>Online Users:</strong> -`;
    });

    socket.on('connect_error', (err) => {
        if (err.message === 'unauthorized') window.location.href = 'login.html';
    });

    socket.on('user-joined', (name) => {
        append({ message: `${name} joined the chat`, timestamp: formatTime() }, 'center', { playSound: false });
    });

    socket.on('receive', (data) => {
        const position = data.name === username ? 'right' : 'left';
        append(data, position);
    });

    socket.on('left', (name) => {
        append({ message: `${name} left the chat`, timestamp: formatTime() }, 'center', { playSound: false });
    });

    socket.on('chat-history', (history) => {
        history.forEach((msg) => {
            const position = msg.name === username ? 'right' : 'left';
            append(msg, position, { playSound: false });
        });
    });

    socket.on('message-deleted', (id) => {
        const element = messageContainer.querySelector(`[data-id="${CSS.escape(id)}"]`);
        if (element) element.remove();
    });

    socket.on('user-list', (users) => {
        userListElement.innerHTML = `<strong>Status:</strong> Connected | <strong>Online Users:</strong> ${users.join(', ')}`;
    });

    socket.on('typing', (name) => {
        if (name === username) return;
        typingUsers.add(name);
        updateTypingIndicator();
    });

    socket.on('stop-typing', (name) => {
        typingUsers.delete(name);
        updateTypingIndicator();
    });

    newChatButton.addEventListener('click', () => {
        messageContainer.innerHTML = '';
        append({ message: 'New chat started.', timestamp: formatTime() }, 'center', { playSound: false });
    });

    logoutButton.addEventListener('click', async () => {
        try {
            await fetch('/api/logout', { method: 'POST' });
        } finally {
            socket.disconnect();
            window.location.href = 'login.html';
        }
    });
}

init();
