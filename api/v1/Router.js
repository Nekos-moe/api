const fs = require('fs');

class APIv1 {
	constructor(settings, database, mailTransport, webhookTransport) {
		this.database = database;
		this.mailTransport = mailTransport;
		this.webhookTransport = webhookTransport;
		this.router = require('express').Router();
		this.routes = { };
		this.path = '/api/v1';
		this.settings = settings

		fs.readdir(__dirname + '/routes/', (error, files) => {
			if (error)
				throw error;

			for (const file of files) {
				if (!file.endsWith('js'))
					continue;

				let route = new (require(__dirname + '/routes/' + file))(this, settings.apiSettings.v1);
				this.routes[route.path] = route;
			}
		});

		// Must load after
		this.router.use((req, res, next) => {
			if (!req.headers['user-agent'])
				return next();

			statsd.increment('catgirls.express.useragents', 1, ['ua:' + req.headers['user-agent'].replace(/,/g, ''), 'route:' + req.path.replace('/api/v1', ''), 'method:' + req.method]);
			return next();
		});
	}

	async authorize(req, res, next) {
		if (!req.headers.authorization)
			return res.status(400).send({ message: "Authentication required" });

		req.user = await this.database.User.findOne({ token: req.headers.authorization }).select('+token +password');

		if (!req.user)
			return res.status(401).send({ message: "Invalid token" });

		return next();
	}
}

module.exports = APIv1;
