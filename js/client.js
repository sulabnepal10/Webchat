const socket = io({ transports: ['websocket', 'polling'] });

const form = document.getElementById('send-container');
const messageInput = document.getElementById('messageInp');
const messageContainer = document.querySelector('.container');
const newChatButton = document.getElementById('new-chat-btn');
const logoutButton = document.getElementById('logout-btn');
const userListElement = document.createElement('div');
userListElement.id = 'user-list';
userListElement.style.margin = '10px';
document.body.insertBefore(userListElement, messageContainer);

var audio = new Audio('ting.mp3');
const username = localStorage.getItem('username');
let typingTimeout;
const typingUsers = new Set(); 
let typingIndicator = null;

const getInitials = (name) => {
    if (!name) return '?';
    const words = name.trim().split(' ');
    if (words.length === 1) return words[0][0].toUpperCase();
    return words.slice(0, 2).map(word => word[0].toUpperCase()).join('');
};

const append = (msgData, position) => {
    const { message, name, timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) } = msgData;
    const messageElement = document.createElement('div');
    messageElement.classList.add('message', position);

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

        if (position === 'right') {
            const deleteBtn = document.createElement('button');
            deleteBtn.classList.add('delete-btn');
            deleteBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m-8 4v10m4-10v10m4-10v10M5 6l1 14a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-14H5z"/></svg>`;
            deleteBtn.onclick = () => messageElement.remove();
            messageElement.appendChild(deleteBtn);
        }
    }

    messageContainer.append(messageElement);
    messageContainer.scrollTop = messageContainer.scrollHeight;
    if (position === 'left' && !message.includes('is typing')) audio.play();
    if (position !== 'center') saveMessage(msgData, position);
};

const updateTypingIndicator = () => {
    if (typingIndicator) {
        typingIndicator.remove();
        typingIndicator = null;
    }

    if (typingUsers.size > 0) {
        const usersArray = Array.from(typingUsers);
        const message = usersArray.length === 1
            ? `${usersArray[0]} is typing...`
            : `${usersArray.slice(0, -1).join(', ')} and ${usersArray[usersArray.length - 1]} are typing...`;

        typingIndicator = document.createElement('div');
        typingIndicator.classList.add('message', 'left');
        typingIndicator.innerHTML = `
            <span class="message-content">${message}</span>
            <span class="message-timestamp">${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
        `;
        messageContainer.append(typingIndicator);
        messageContainer.scrollTop = messageContainer.scrollHeight;
    }
};

const saveMessage = (msgData, position) => {
    const chatHistory = JSON.parse(localStorage.getItem(`chatHistory_${username}`)) || [];
    chatHistory.push({ ...msgData, position, timestamp: msgData.timestamp || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) });
    localStorage.setItem(`chatHistory_${username}`, JSON.stringify(chatHistory));
};

document.addEventListener('DOMContentLoaded', () => {
    const localHistory = JSON.parse(localStorage.getItem(`chatHistory_${username}`)) || [];
    localHistory.forEach(({ message, name, timestamp, position }) => {
        append({ message, name, timestamp: timestamp || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }, position);
    });
});

form.addEventListener('submit', (e) => {
    e.preventDefault();
    const message = messageInput.value.trim();
    if (!message) return;
    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    append({ message, timestamp }, 'right');
    socket.emit('send', message);
    messageInput.value = '';
});

messageInput.addEventListener('input', () => {
    socket.emit('typing');
    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => socket.emit('stop-typing'), 1000);
});

socket.on('connect', () => {
    userListElement.innerHTML = `<strong>Status:</strong> Connected | <strong>Online Users:</strong> Loading...`;
});

socket.on('disconnect', () => {
    userListElement.innerHTML = `<strong>Status:</strong> Disconnected | <strong>Online Users:</strong> -`;
});

if (username) {
    append({ message: 'You joined the chat', timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }, 'center');
    socket.emit('new-user-joined', username);
}

socket.on('user-joined', (name) => {
    append({ message: `${name} joined the chat`, timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }, 'center');
});

socket.on('receive', (data) => {
    append({ ...data, timestamp: data.timestamp || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }, 'left');
});

socket.on('left', (name) => {
    append({ message: `${name} left the chat`, timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }, 'center');
});

socket.on('chat-history', (history) => {
    history.forEach(msg => append({ ...msg, timestamp: msg.timestamp || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }, 'left'));
});

socket.on('user-list', (users) => {
    userListElement.innerHTML = `<strong>Status:</strong> Connected | <strong>Online Users:</strong> ${users.join(', ')}`;
});

socket.on('typing', (name) => {
    typingUsers.add(name);
    updateTypingIndicator();
});

socket.on('stop-typing', (name) => {
    typingUsers.delete(name);
    updateTypingIndicator();
});

let isNewChatListenerAdded = false;
if (!isNewChatListenerAdded) {
    newChatButton.addEventListener('click', () => {
        localStorage.removeItem(`chatHistory_${username}`);
        messageContainer.innerHTML = '';
        append({ message: 'New chat started.', timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }, 'center');
    });
    isNewChatListenerAdded = true;
}

let isLogoutListenerAdded = false;
if (!isLogoutListenerAdded && logoutButton) {
    logoutButton.addEventListener('click', () => {
        socket.emit('user-logout', username);
        localStorage.removeItem('username');
        localStorage.removeItem(`chatHistory_${username}`);
        socket.disconnect();
        window.location.href = 'login.html';
    });
    isLogoutListenerAdded = true;
}