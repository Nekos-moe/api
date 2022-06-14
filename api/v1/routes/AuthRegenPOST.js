const crypto = require('crypto'),
	RateLimiter = require('../../../structures/RateLimiter');

class AuthRegenPOST {
	constructor(controller) {
		this.path = '/auth/regen';
		this.router = controller.router;
		this.database = controller.database;
		this.authorize = controller.authorize;

		this.rateLimiter = new RateLimiter({ windowMS: 10000, max: 1 }); // 1 per 10 seconds

		this.router.post(
			this.path,
			this.rateLimiter.limit.bind(this.rateLimiter),
			this.authorize.bind(this),
			this.run.bind(this)
		);
	}

	async run(req, res) {
		// Generate and save new token
		req.user.token = crypto.randomBytes(32 / 2).toString('hex').slice(0, 32);
		await req.user.save();

		return res.sendStatus(204);
	}
}

module.exports = AuthRegenPOST;
