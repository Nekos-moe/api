class RateLimiter {
	constructor(options) {
		this.options = Object.assign({}, {
			windowMS: 10 * 1000,
			max: 20,
			message : 'Too many requests, please try again later ニャー.',
			statusCode: 429,
			keyGenerator(req) {
				return req.ip;
			},
			skip() {
				return false;
			},
			handler(store, req, res) {
				let retry = store.reset - Date.now();
				res.set('Retry-After', retry);
				return res.status(this.statusCode).send({ message: this.message, retryAfter: retry });
			}
		}, options); // Overwrite defaults with options

		this.store = {
			requests: {},
			reset: Date.now() + options.windowMS,
			incr(key) {
				if (this.requests[key]) {
					this.requests[key]++;
					return this.requests[key];
				}
				this.requests[key] = 1;
				return 1;
			},
			decr(key) {
				if (this.requests[key]) {
					this.requests[key]--;
					return this.requests[key];
				}
				this.requests[key] = 0;
				return 0;
			},
			resetKey(key) {
				delete this.requests[key];
			},
			resetAll(options) {
				this.requests = {};
				this.reset = Date.now() + options.windowMS;
			}
		}

		setInterval(() => this.store.resetAll(this.options), this.options.windowMS);
	}

	limit(req, res, next) {
		if (this.options.skip(req, res))
			return next();

		let key = this.options.keyGenerator(req),
			requests = this.store.incr(key);

		req.rateLimit = {
			key,
			requests,
			limit: this.options.max,
			remaining: Math.max(this.options.max - requests, 0)
		}

		res.set('X-RateLimit-Limit', req.rateLimit.limit);
		res.set('X-RateLimit-Remaining', req.rateLimit.remaining);

		if (this.options.max && requests > this.options.max)
			return this.options.handler(this.store, req, res);

		return next();
	}

	unlimit(req, res) {
		this.store.decr(req.rateLimit.key);

		req.rateLimit.requests--;
		req.rateLimit.remaining++;

		res.set('X-RateLimit-Limit', req.rateLimit.limit);
		res.set('X-RateLimit-Remaining', req.rateLimit.remaining);

		return;
	}
}

module.exports = RateLimiter;
