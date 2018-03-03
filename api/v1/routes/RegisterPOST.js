const bcrypt = require('bcrypt'),
	shortid = require('shortid'),
	crypto = require('crypto'),
	HASH_ROUNDS = 10,
	RateLimiter = require('../../../structures/RateLimiter');

class RegisterPOST {
	constructor(controller, settings) {
		this.path = '/register';
		this.router = controller.router;
		this.database = controller.database;
		this.mailTransport = controller.mailTransport;
		this.allowAccountCreation = settings.allowAccountCreation;

		this.rateLimiter = new RateLimiter({ windowMS: 60000, max: 1 }); // 1 per minute

		this.router.post(
			this.path,
			this.rateLimiter.limit.bind(this.rateLimiter),
			this.run.bind(this)
		);
	}

	async run(req, res) {
		if (!this.allowAccountCreation) {
			this.rateLimiter.unlimit(req, res);
			return res.status(403).send({ message: "Account creation not allowed" });
		}

		// Reject bad body
		if (!req.body || !req.body.username || !req.body.email || !req.body.password) {
			this.rateLimiter.unlimit(req, res);
			return res.status(400).send({ message: "Email, username, and password are required" });
		}

		// Username requirements
		if (/[@\r\n]/.test(req.body.username)) {
			this.rateLimiter.unlimit(req, res);
			return res.status(400).send({
				message: 'Your username must not contain a new line character or @ symbol.'
			});
		}

		if (req.body.email.length > 70 || req.body.password.length > 70 || req.body.username.length > 35) {
			this.rateLimiter.unlimit(req, res);
			return res.status(400).send({
				message: 'Please limit your email address and password to 70 characters, and your username to 35 characters.'
			});
		}

		if (!/^[^@]+@[^.@]+\.[^.@]+$/.test(req.body.email)) {
			this.rateLimiter.unlimit(req, res);
			return res.status(400).send({
				message: 'Invalid email'
			});
		}

		// Password requirements
		if (req.body.password.length < 8) {
			this.rateLimiter.unlimit(req, res);
			return res.status(400).send({
				message: 'Your password must be at least 8 characters.'
			});
		}

		const existingUser = await this.database.User.findOne({ $or: [{ username: req.body.username }, { email: req.body.email }] });
		if (existingUser) {
			this.rateLimiter.unlimit(req, res);
			return res.status(409).send({ message: existingUser.username === req.body.username
				? 'Please choose another username. "' + req.body.username + '" is already taken.'
				: 'There is already an account created using that email.'
			});
		}

		const hashedPassword = await bcrypt.hash(req.body.password, HASH_ROUNDS),
			token = crypto.randomBytes(32 / 2).toString('hex'), // Create a token for the user
			id = shortid.generate(); // User's identifier

		// Create new User
		const user = await this.database.User.create({
			token,
			id,
			username: req.body.username,
			email: req.body.email,
			password: hashedPassword
		}, error => {
			if (error)
				console.error(error);
		});

		const keyDoc = await this.database.VerifyKey.create({
			userId: user.id,
			key: crypto.randomBytes(16 / 2).toString('hex')
		});

		// Send verification email
		return this.mailTransport.sendHTMLMail('welcome', {
			to: user.email,
			subject: 'Welcome to nekos.moe!',
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

module.exports = RegisterPOST;
