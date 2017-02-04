const bcrypt = require('bcrypt');

class AuthPOST {
	constructor(controller) {
		this.path = '/auth';
		this.router = controller.router;
		this.database = controller.database;

		this.rateLimiter = controller.rateLimitManager.limitRoute(this.path, { windowMS: 5000, max: 1 }); // Once every 5 seconds

		this.router.post(this.path, this.run.bind(this));
	}

	async run(req, res) {
		if (!req.body || !req.body.username || !req.body.password) {
			this.rateLimiter.unlimit(req, res);
			return res.status(401).send({ message: "Username, and password are required" });
		}

		let user = await this.database.User.findOne({ username: req.body.username });

		if (user && !user.verified)
			return res.status(400).send({ message: "You must verify your email before you can view your token." });

		// Check if the passwords match
		let correctCredentials = user ? await bcrypt.compare(req.body.password, user.password) : false;

		if (!correctCredentials)
			return res.status(400).send({ message: "Incorrect username or password" });

		return res.status(200).send({ token: user.token });
	}
}

module.exports = AuthPOST;
