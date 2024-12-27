const socket = io('http://localhost:8000', { transports: ['websocket'] });

const form = document.getElementById('send-container');
const messageInput = document.getElementById('messageInp');
const messageContainer = document.querySelector('.container');
const newChatButton = document.getElementById('new-chat-btn'); // Select the "New Chat" button
var audio = new Audio('ting.mp3');

// Get the logged-in username
const username = localStorage.getItem('username');

// Load existing messages for this user
document.addEventListener('DOMContentLoaded', () => {
    const chatHistory = JSON.parse(localStorage.getItem(`chatHistory_${username}`)) || [];
    chatHistory.forEach(({ message, position }) => append(message, position));
});

// Save message to localStorage for this user
const saveMessage = (message, position) => {
    const chatHistory = JSON.parse(localStorage.getItem(`chatHistory_${username}`)) || [];
    chatHistory.push({ message, position });
    localStorage.setItem(`chatHistory_${username}`, JSON.stringify(chatHistory));
};

// Append message to the chat container
const append = (message, position) => {
    const messageElement = document.createElement('div');
    messageElement.innerText = message;
    messageElement.classList.add('message');
    messageElement.classList.add(position);
    messageContainer.append(messageElement);

    // Automatically scroll to the bottom
    messageContainer.scrollTop = messageContainer.scrollHeight;
    
    if (position === 'left') {
        audio.play();
    }
    saveMessage(message, position);
};

// Handle form submission
form.addEventListener('submit', (e) => {
    e.preventDefault();
    const message = messageInput.value;
    append(`You: ${message}`, 'right');
    socket.emit('send', message);
    messageInput.value = '';
});

if (username) {
    append('You joined the chat', 'right');
    socket.emit('new-user-joined', username);
}

socket.on('user-joined', (name) => {
    append(`${name} joined the chat`, 'left');
});

socket.on('receive', (data) => {
    append(`${data.name}: ${data.message}`, 'left');
});

socket.on('left', (name) => {
    append(`${name} left the chat`, 'right');
});

// Clear chat and start a new conversation for this user
const clearChat = () => {
    localStorage.removeItem(`chatHistory_${username}`); // Remove chat history from localStorage
    messageContainer.innerHTML = ''; // Clear all chat messages
    append('New chat started.', 'center'); // Notify the user
};

// Add event listener for the "New Chat" button
newChatButton.addEventListener('click', clearChat);
