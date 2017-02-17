const nJwt = require('njwt'),
	fs = require('fs');

class APIv1 {
	constructor(settings, database, mailTransport) {
		this.database = database;
		this.mailTransport = mailTransport;
		this.router = require('express').Router();
		this.routes = {};
		this.path = '/api/v1';
		this.settings = settings

		fs.readdir(__dirname + '/routes/', (error, files) => {
			if (error)
				throw error;

			for (const file of files) {
				if (!file.endsWith('js'))
					continue;

				let route = new (require(__dirname + '/routes/' + file))(this);
				this.routes[route.path] = route;
			}
		});
	}

	async authorize(req, res, next) {
		if (!req.headers.authorization)
			return res.status(400).send({ message: "Authentication required" });

		try {
			if (!nJwt.verify(req.headers.authorization, req.app.locals.jwt_signingkey))
				return res.status(401).send({ message: "Invalid token" });
		} catch(e) {
			return res.status(401).send({ message: "Invalid token", error: e });
		}

		req.user = await this.database.User.findOne({ token: req.headers.authorization });

		if (!req.user)
			return res.status(401).send({ message: "Invalid token" });

		return next();
	}
}

module.exports = APIv1;
