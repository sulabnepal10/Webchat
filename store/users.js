const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = path.join(__dirname, '..', 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');

function ensureStore() {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    if (!fs.existsSync(USERS_FILE)) fs.writeFileSync(USERS_FILE, '[]');
}

function readUsers() {
    ensureStore();
    try {
        return JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
    } catch {
        return [];
    }
}

function writeUsers(users) {
    ensureStore();
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

function hashPassword(password) {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.scryptSync(password, salt, 64).toString('hex');
    return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
    const [salt, hash] = stored.split(':');
    const candidate = crypto.scryptSync(password, salt, 64).toString('hex');
    const a = Buffer.from(hash, 'hex');
    const b = Buffer.from(candidate, 'hex');
    return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function findByUsername(username) {
    const lower = username.toLowerCase();
    return readUsers().find((u) => u.username.toLowerCase() === lower);
}

function createUser(username, password) {
    const users = readUsers();
    const user = {
        id: crypto.randomUUID(),
        username,
        passwordHash: hashPassword(password),
        createdAt: new Date().toISOString(),
    };
    users.push(user);
    writeUsers(users);
    return user;
}

module.exports = { findByUsername, createUser, verifyPassword };
