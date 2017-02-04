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
			handler: defaults.handler || function(options, req, res) {
				return res.status(this.statusCode).send({ message: this.message });
			}
		};

		this.routes = {};
	}

	limitRoute(route, options = {}) {
		let rl = new RateLimit(Object.assign({}, this.defaults, options));
		this.routes[route] = rl;
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
			incr(key) {
				if (this.requests[key]) {
					this.requests[key]++;
					return this.requests[key];
				}
				this.requests[key] = 1;
				return 1;
			},
			resetKey(key) {
				delete this.requests[key];
			},
			resetAll() {
				this.requests = {};
			}
		}

		setInterval(() => this.store.resetAll(), this.options.windowMS);
	}

	rateLimit(req, res, next) {
		if (this.options.skip(req, res))
			return next();

		let key = this.options.keyGenerator(req),
			requests = this.store.incr(key);

		req.rateLimit = {
			limit: this.options.max,
			remaining: Math.max(this.options.max - requests, 0)
		}

		res.set('X-RateLimit-Limit', req.rateLimit.max);
		res.set('X-RateLimit-Remaining', req.rateLimit.remaining);

		if (this.options.max && requests > this.options.max)
			return this.options.handler(req, res);

		return next();
	}
}

module.exports = RateLimitManager;
