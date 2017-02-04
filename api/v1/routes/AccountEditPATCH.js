const uuid = require('uuid'),
	nJwt = require('njwt'),
	bcrypt = require('bcrypt'),
	HASH_ROUNDS = 10;

class AccountEditPOST {
	constructor(controller) {
		this.path = '/account/edit';
		this.router = controller.router;
		this.database = controller.database;
		this.transporter = controller.transporter;
		this.authorize = controller.authorize;

		this.router.patch(this.path, this.authorize.bind(this), this.run.bind(this));
	}

	async run(req, res) {
		if (!req.body || !req.body.password)
			return res.status(401).send({ message: "Password required" });

		if (!req.body.newPassword && !req.body.newEmail)
			return res.status(400).send({ message: "newPassword or newEmail required" });

		if (req.user && !req.user.verified)
			return res.status(400).send({ message: "You must verify your email before you can modify your account." });

		// Check if the passwords match
		let correctCredentials = await bcrypt.compare(req.body.password, req.user.password);

		if (!correctCredentials)
			return res.status(400).send({ message: "Incorrect password" });

		if (req.body.newPassword) {
			// Password requirements
			if (req.body.newPassword.length < 8 || !/[a-z]/.test(req.body.newPassword) || !/[A-Z]/.test(req.newPody.password) || !/[0-9]/.test(req.newPody.password))
				return res.status(400).send({
					messsage: 'Your password must be at least 8 characters, have uppercase and lowercase alphabetical letters, and contain numbers.'
				});

			// Set new password
			req.user.password = await bcrypt.hash(req.body.newPassword, HASH_ROUNDS);

			// Generate new token to force re-auth
			let UUID = uuid(),
				claims = { iss: UUID },
				jwt = nJwt.create(claims, req.app.locals.jwt_signingkey);
			jwt.setExpiration(); // Never expires
			let token = jwt.compact();

			req.user.uuid = UUID;
			req.user.token = token;
			await req.user.save();

			// Notify via email
			return this.mailTransport.sendMail('verify', {
				to: req.user.email,
				subject: 'Your password has been changed',
				text: `You password for nekos.brussell.me has been changed.
Username: ${req.user.username}
Time (UTC): ${new Date().toLocaleString({}, {timeZone: 'UTC'})}
IP: ${req.ip}`
			}).then(() => res.sendStatus(204)).catch(error => {
				console.error(error);
			});
		}
	}
}

module.exports = AccountEditPOST;
