class RateLimitManager { // class b1nzy {
	constructor(defaults = {}) {
		this.defaults = {
			windowMS: defaults.windowMS || 10 * 1000,
			max: defaults.max || 20,
			message : defaults.message || 'Too many requests, please try again later にゃー.',
			statusCode: defaults.statusCode || 429,
			keyGenerator: defaults.keyGenerator || function(req) {
				return req.ip;
			},
			skip: defaults.skip || function() {
				return false;
			},
			handler: defaults.handler || function(store, req, res) {
				let retry = store.reset - Date.now();
				res.set('Retry-After', retry);
				return res.status(this.statusCode).send({ message: this.message, retryAfter: retry });
			}
		};

		this.routes = {};
	}

	limitRoute(route, options = {}) {
		let rl = new RateLimit(Object.assign({}, this.defaults, options));
		this.routes[route] = rl;
		return rl;
	}

	install(app) {
		app.use((req, res, next) => {
			if (this.routes[req.path])
				return this.routes[req.path].rateLimit(req, res, next);

			return next();
		});
	}
}

class RateLimit {
	constructor(options) {
		this.options = options;
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

	rateLimit(req, res, next) {
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

		res.set('X-RateLimit-Limit', req.rateLimit.max);
		res.set('X-RateLimit-Remaining', req.rateLimit.remaining);

		if (this.options.max && requests > this.options.max)
			return this.options.handler(this.store, req, res);

		return next();
	}

	unlimit(req, res) {
		this.store.decr(req.rateLimit.key);

		req.rateLimit.requests--;
		req.rateLimit.remaining++;

		res.set('X-RateLimit-Limit', req.rateLimit.max);
		res.set('X-RateLimit-Remaining', req.rateLimit.remaining);

		return;
	}
}

module.exports = RateLimitManager;
