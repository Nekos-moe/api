const RateLimiter = require('../../../structures/RateLimiter');

class RegisterVerifyPOST {
	constructor(controller) {
		this.path = '/register/resend';
		this.router = controller.router;
		this.database = controller.database;
		this.mailTransport = controller.mailTransport;

		this.rateLimiter = new RateLimiter({ windowMS: 10000, max: 1 }); // 1/10

		this.router.post(
			this.path,
			this.rateLimiter.limit.bind(this.rateLimiter),
			this.run.bind(this)
		);
	}

	async run(req, res) {
		if (!req.body || !req.body.email) {
			this.rateLimiter.unlimit(req, res);
			return res.status(400).send({ message: "Email required" });
		}

		let user = await this.database.User.findOne({ email: req.body.email }).select('+email');

		// No matching account found
		if (!user || user.verified)
			return res.status(409).send({ message: 'This account has already been verified' });

		// Send verification email
		return this.mailTransport.sendHTMLMail('verify', {
			to: user.email,
			subject: 'Verify your nekos.brussell.me account',
			text: 'Open this link to verify your account: https://nekos.brussell.me/api/v1/register/verify/' + user.key,
		}, {
			key: user.id
		}).then(() => res.sendStatus(201)).catch(error => {
			console.error(error);
			return res.status(500).send({ messsage: 'Error sending verification email' });
		});
	}
}

module.exports = RegisterVerifyPOST;
