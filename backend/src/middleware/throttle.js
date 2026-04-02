import { config } from "../config.js";

const throttleStore = new Map();

function getClientKey(req) {
  return `${req.ip}:${req.baseUrl}${req.path}`;
}

export function rateLimit() {
  return (req, res, next) => {
    const now = Date.now();
    const key = getClientKey(req);
    const entry = throttleStore.get(key) || {
      count: 0,
      windowStart: now,
    };

    if (now - entry.windowStart >= config.requestWindowMs) {
      entry.count = 0;
      entry.windowStart = now;
    }

    entry.count += 1;
    throttleStore.set(key, entry);

    if (entry.count > config.requestLimitPerWindow) {
      return res.status(429).json({
        message: "Too many requests. Please slow down and retry.",
      });
    }

    return next();
  };
}

