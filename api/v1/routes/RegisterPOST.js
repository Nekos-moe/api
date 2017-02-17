const bcrypt = require('bcrypt'),
	nJwt = require('njwt'),
	uuid = require('uuid'),
	HASH_ROUNDS = 10,
	RateLimiter = require('../../../structures/RateLimiter');

class RegisterPOST {
	constructor(controller) {
		this.path = '/register';
		this.router = controller.router;
		this.database = controller.database;
		this.mailTransport = controller.mailTransport;

		this.rateLimiter = new RateLimiter({ windowMS: 60000, max: 1 }); // 1 per minute

		this.router.post(
			this.path,
			this.rateLimiter.limit.bind(this.rateLimiter),
			this.run.bind(this)
		);
	}

	async run(req, res) {
		// Reject bad body
		if (!req.body || !req.body.username || !req.body.email || !req.body.password) {
			this.rateLimiter.unlimit(req, res);
			return res.status(400).send({ message: "Email, username, and password are required" });
		}

		// Username requirements
		if (/[@\n]/.test(req.body.username)) {
			this.rateLimiter.unlimit(req, res);
			return res.status(400).send({
				messsage: 'Your username must not contain a new line character or @ symbol.'
			});
		}

		if (req.body.email.length > 70 || req.body.password.length > 70 || req.body.username.length > 35) {
			this.rateLimiter.unlimit(req, res);
			return res.status(400).send({
				messsage: 'Please limit your email address and password to 70 characters, and your username to 35 characters.'
			});
		}

		// Password requirements
		if (req.body.password.length < 8 || !/[a-z]/.test(req.body.password) || !/[A-Z]/.test(req.body.password) || !/[0-9]/.test(req.body.password)) {
			this.rateLimiter.unlimit(req, res);
			return res.status(400).send({
				messsage: 'Your password must be at least 8 characters, have uppercase and lowercase alphabetical letters, and contain numbers.'
			});
		}

		let existingUser = await this.database.User.findOne({ $or: [{ username: req.body.username }, { email: req.body.email }] });
		if (existingUser) {
			this.rateLimiter.unlimit(req, res);
			return res.status(409).send({ messsage: existingUser.username === req.body.username
				? 'Please choose another username. "' + req.body.username + '" is already taken.'
				: 'There is already an account created using that email.'
			});
		}

		let hashedPassword = await bcrypt.hash(req.body.password, HASH_ROUNDS),
			UUID = uuid(); // Create user id

		// Create a token for the user
		let claims = { iss: UUID },
			jwt = nJwt.create(claims, req.app.locals.jwt_signingkey);
		jwt.setExpiration(); // Never expires
		let token = jwt.compact();

		// Create new User
		await this.database.User.create({
			uuid: UUID,
			username: req.body.username,
			email: req.body.email,
			password: hashedPassword,
			token
		}, error => {
			if (error)
				console.error(error);
		});

		// Create unverified user for email verification
		let unverifiedUser = await this.database.UnverifiedUser.create({
			email: req.body.email,
			key: UUID.replace(/-/g, '')
		});

		// Send verification email
		return this.mailTransport.sendHTMLMail('verify', {
			to: unverifiedUser.email,
			subject: 'Verify your nekos.brussell.me account',
			text: 'Open this link to verify your account: https://nekos.brussell.me/register/verify/' + unverifiedUser.key,
		}, {
			key: unverifiedUser.key
		}).then(() => res.sendStatus(201)).catch(error => {
			console.error(error);
			return res.status(500).send({ messsage: 'Error sending verification email' });
		});
	}
}

module.exports = RegisterPOST;
