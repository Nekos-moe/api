const RateLimiter = require('../../../structures/RateLimiter'),
	nJwt = require('njwt');

class UserGET {
	constructor(controller) {
		this.path = '/users/:id';
		this.router = controller.router;
		this.database = controller.database;

		this.rateLimiter = new RateLimiter({ max: 10 }); // 10/10 limit

		this.router.get(
			this.path,
			this.rateLimiter.limit.bind(this.rateLimiter),
			this.run.bind(this)
		);
	}

	async run(req, res) {
		if (req.params.id === '@me') {
			if (!req.headers.authorization)
				return res.status(400).send({ message: "Authentication required" });

			try {
				if (!nJwt.verify(req.headers.authorization, req.app.locals.jwt_signingkey))
					return res.status(401).send({ message: "Invalid token" });
			} catch(e) {
				return res.status(401).send({ message: "Invalid token", error: e });
			}

			const user = await this.database.User.findOne({ token: req.headers.authorization }).select('-_id -__v -password -uuid -token').lean();

			if (!user)
				return res.status(401).send({ message: "Invalid token" });

			return res.status(200).send({ user });
		}

		const user = await this.database.User.findOne({ id: req.params.id }).select('-_id -__v -password -uuid -token -email').lean();

		if (!user)
			return res.status(404).send({ message: "No user with that ID" });

		return res.status(200).send({ user });
	}
}

module.exports = UserGET;
