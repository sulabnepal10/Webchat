# Sacred Room Chat

A real-time chat room built with Express and Socket.IO: registered accounts, a single shared room, typing indicators, and delete-for-everyone on your own messages.

## Setup

```bash
npm install
cp .env.example .env   # then edit SESSION_SECRET
npm run dev             # nodemon, auto-restarts on change
# or
npm start
```

The server listens on `PORT` (default `8000`).

## Environment variables

| Variable         | Description                                             |
|-------------------|---------------------------------------------------------|
| `PORT`            | HTTP port to listen on. Defaults to `8000`.              |
| `SESSION_SECRET`  | Secret used to sign session cookies. **Required** for any real deployment — set it in `.env`. |

## Architecture notes

- `public/` is the only directory served over HTTP; `index.js`, `store/`, and `data/` (server code and user data) are never exposed to clients.
- Accounts are stored in `data/users.json` with per-user salted `scrypt` password hashes (Node's built-in `crypto`, no external hashing dependency).
- Identity is established server-side via a session cookie (`express-session`), shared with Socket.IO through `io.engine.use(sessionMiddleware)` — the server, not the client, decides who you are on every socket event.
- Chat history is kept in memory, capped at the most recent 200 messages, and is the single source of truth (the client no longer caches its own copy).

## Known limitations

This is a small single-process app, so a few things are intentionally simple rather than "distributed-system production":

- Sessions and chat history are in-memory — both reset on server restart, and neither works if you run more than one server instance (would need a shared session store like Redis and a real database for multi-instance deployments).
- One global chat room; no private messages or multiple rooms.
