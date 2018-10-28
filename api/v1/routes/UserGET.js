const RateLimiter = require('../../../structures/RateLimiter');

class UserGET {
	constructor(controller) {
		this.path = '/user/:id';
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
		const userMe = req.headers.authorization
			? await this.database.User.findOne({ token: req.headers.authorization }).select('-_id -__v -password -token').lean()
			: null;

		if (req.params.id === '@me' || (userMe && req.params.id === userMe.id)) {
			if (!req.headers.authorization)
				return res.status(400).send({ message: "Authentication required" });

			if (!userMe)
				return res.status(401).send({ message: "Invalid token" });

			return res.status(200).send({ user: userMe });
		}

		const user = await this.database.User.findOne({ id: req.params.id, verified: true }).select('-_id -__v -password -token -email -savedTags -verified').lean();

		if (!user)
			return res.status(404).send({ message: "No user with that id" });

		return res.status(200).send({ user });
	}
}

module.exports = UserGET;
