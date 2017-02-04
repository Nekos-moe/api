const uuid = require('uuid'),
	nJwt = require('njwt');

class AuthRegenPOST {
	constructor(controller) {
		this.path = '/auth/regen';
		this.router = controller.router;
		this.database = controller.database;
		this.authorize = controller.authorize;

		controller.rateLimitManager.limitRoute(this.path, { windowMS: 10000, max: 1 }); // 1 per 10 seconds

		this.router.post(this.path, this.authorize.bind(this), this.run.bind(this));
	}

	async run(req, res) {
		// Generate new token
		let UUID = uuid(),
			claims = { iss: UUID },
			jwt = nJwt.create(claims, req.app.locals.jwt_signingkey);
		jwt.setExpiration(); // Never expires
		let token = jwt.compact();

		req.user.uuid = UUID;
		req.user.token = token;
		await req.user.save();

		return res.sendSatus(204);
	}
}

module.exports = AuthRegenPOST;
