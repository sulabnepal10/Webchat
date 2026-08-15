const attempts = new Map();

const WINDOW_MS = 60_000;
const MAX_ATTEMPTS = 10;

function tooManyAttempts(key) {
    const now = Date.now();
    const record = attempts.get(key);

    if (!record || now - record.windowStart > WINDOW_MS) {
        attempts.set(key, { windowStart: now, count: 1 });
        return false;
    }

    record.count += 1;
    return record.count > MAX_ATTEMPTS;
}

setInterval(() => {
    const now = Date.now();
    for (const [key, record] of attempts) {
        if (now - record.windowStart > WINDOW_MS) attempts.delete(key);
    }
}, WINDOW_MS).unref();

module.exports = { tooManyAttempts };
