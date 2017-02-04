const nJwt = require('njwt'),
	fs = require('fs'),
	RateLimitManager = require('../../structures/RateLimitManager');

class APIv1 {
	constructor(settings, database, mailTransport) {
		this.database = database;
		this.mailTransport = mailTransport;
		this.router = require('express').Router();
		this.routes = {};
		this.rateLimitManager = new RateLimitManager();
		this.path = '/api/v1';
		this.settings = settings

		fs.readdir('./routes/', (error, files) => {
			if (error)
				throw error;

			for (const file of files) {
				if (!file.endsWith('js'))
					continue;

				let route = new (require('./routes/' + file))(this);
				this.routes[route.path] = route;
			}

			this.rateLimitManager.install(this.router);
		});
	}

	async authorize(req, res, next) {
		if (!req.headers.authorization)
			return res.status(400).send({
				code: 400,
				message: "Authentication required"
			});

		let nJwtVerified = false;

		try {
			nJwtVerified = nJwt.verify(req.headers.authorization, req.app.locals.jwt_signingkey);
		} catch(e) {
			return res.status(401).send({
				code: 401,
				message: "Invalid token",
				error: e
			});
		}

		req.user = await this.database.User.findOne({ token: req.headers.authorization });

		if (!req.headers.authorization || !nJwtVerified || !req.user)
			return res.status(401).send({ code: 401, message: "Invalid token" });

		return next();
	}
}

module.exports = APIv1;
