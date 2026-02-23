/**
 * Upstash Redis REST API 專用的 express-session Store
 * 用於 Vercel 等 serverless 環境，支援 UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN
 */
const session = require('express-session');

class UpstashSessionStore extends session.Store {
  constructor(options = {}) {
    super();
    this.prefix = options.prefix || 'sess:';
    this.serializer = options.serializer || JSON;
    this.ttl = options.ttl || 86400; // 預設 24 小時
    this.redis = options.redis;
    if (!this.redis) {
      throw new Error('UpstashSessionStore requires options.redis (@upstash/redis instance)');
    }
  }

  getTTL(sess) {
    if (typeof this.ttl === 'function') return this.ttl(sess);
    if (sess?.cookie?.expires) {
      const ms = Number(new Date(sess.cookie.expires)) - Date.now();
      return Math.max(0, Math.ceil(ms / 1000));
    }
    return this.ttl;
  }

  get(sid, cb) {
    const key = this.prefix + sid;
    this.redis
      .get(key)
      .then((data) => {
        if (!data) return cb(null, null);
        try {
          const sess = typeof data === 'string' ? this.serializer.parse(data) : data;
          cb(null, sess);
        } catch (e) {
          cb(e, null);
        }
      })
      .catch((err) => cb(err, null));
  }

  set(sid, sess, cb) {
    const key = this.prefix + sid;
    const ttl = this.getTTL(sess);
    if (ttl <= 0) return this.destroy(sid, cb);
    try {
      const val = this.serializer.stringify(sess);
      this.redis
        .setex(key, ttl, val)
        .then(() => cb(null))
        .catch((err) => cb(err));
    } catch (e) {
      cb(e);
    }
  }

  destroy(sid, cb) {
    const key = this.prefix + sid;
    this.redis
      .del(key)
      .then(() => cb(null))
      .catch((err) => cb(err));
  }

  touch(sid, sess, cb) {
    const key = this.prefix + sid;
    const ttl = this.getTTL(sess);
    if (ttl <= 0) return cb(null);
    this.redis
      .expire(key, ttl)
      .then(() => cb(null))
      .catch((err) => cb(err));
  }
}

module.exports = { UpstashSessionStore };
