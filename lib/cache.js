/**
 * Simple in-memory cache with TTL.
 */
class Cache {
    constructor(defaultTtl = 5 * 60 * 1000) {
        this.store = new Map();
        this.defaultTtl = defaultTtl;
    }

    get(key) {
        const entry = this.store.get(key);
        if (!entry) return null;
        if (Date.now() > entry.expires) {
            this.store.delete(key);
            return null;
        }
        return entry.value;
    }

    set(key, value, ttl) {
        this.store.set(key, {
            value,
            expires: Date.now() + (ttl || this.defaultTtl),
        });
    }

    has(key) {
        return this.get(key) !== null;
    }

    clear() {
        this.store.clear();
    }
}

// Shared cache instances
const dnsCache = new Cache(10 * 60 * 1000);    // 10 min
const scraperCache = new Cache(30 * 60 * 1000); // 30 min
const domainCache = new Cache(60 * 60 * 1000);  // 1 hour

module.exports = { Cache, dnsCache, scraperCache, domainCache };
