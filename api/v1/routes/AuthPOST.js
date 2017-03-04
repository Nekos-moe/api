const bcrypt = require('bcrypt'),
	RateLimiter = require('../../../structures/RateLimiter');

class AuthPOST {
	constructor(controller) {
		this.path = '/auth';
		this.router = controller.router;
		this.database = controller.database;

		this.rateLimiter = new RateLimiter({ windowMS: 60000, max: 10 }); // 10 times per minute

		this.router.post(
			this.path,
			this.rateLimiter.limit.bind(this.rateLimiter),
			this.run.bind(this)
		);
	}

	async run(req, res) {
		if (!req.body || !req.body.username || !req.body.password) {
			this.rateLimiter.unlimit(req, res);
			return res.status(400).send({ message: "Username, and password are required" });
		}

		let user = await this.database.User.findOne({ username: req.body.username }).select('+password +token');

		if (user && !user.verified)
			return res.status(403).send({ message: "You must verify your email" });

		// Check if the passwords match
		let correctCredentials = user ? await bcrypt.compare(req.body.password, user.password) : false;

		if (!correctCredentials)
			return res.status(401).send({ message: "Incorrect username or password" });

		return res.status(200).send({ token: user.token });
	}
}

module.exports = AuthPOST;
