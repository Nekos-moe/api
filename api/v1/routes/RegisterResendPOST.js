const RateLimiter = require('../../../structures/RateLimiter');
const crypto = require('crypto');

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
			return res.status(409).send({ message: 'This account has either already been verified or was deleted.' });

		// Get key doc
		let keyDoc = await this.database.VerifyKey.findOne({ userId: user.id });
		const newKey = crypto.randomBytes(16 / 2).toString('hex')

		if (!keyDoc)
			keyDoc = await this.database.VerifyKey.create({ userId: user.id, key: newKey });
		else {
			keyDoc.key = newKey;
			await keyDoc.save();
		}

		// Send verification email
		return this.mailTransport.sendHTMLMail('welcome', {
			to: user.email,
			subject: 'Verify your nekos.moe account',
			text: 'Open this link to verify your account: https://nekos.moe/api/v1/register/verify/' + keyDoc.key,
		}, {
			key: keyDoc.key,
			userId: user.id,
			username: user.username.replace(/</g, '&lt;').replace(/>/g, '&gt;')
		}).then(() => res.sendStatus(201)).catch(error => {
			console.error(error);
			return res.status(500).send({ message: 'Error sending verification email' });
		});
	}
}

module.exports = RegisterVerifyPOST;
