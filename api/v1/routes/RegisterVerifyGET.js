class RegisterVerifyPOST {
	constructor(controller) {
		this.path = '/register/verify/:key';
		this.router = controller.router;
		this.database = controller.database;

		this.router.get(this.path, this.run.bind(this));
	}

	async run(req, res) {
		// Find the user being verified
		let user = await this.database.User.findOne({ id: req.params.key }).select('+email');

		// No matching account found
		if (!user || user.verified)
			return res.status(409).send({
				message: 'Invalid key. Either the account has already been validated or the key was misspelled'
			});

		// Mark user as verified and save user. Then delete the unverified user doc
		user.verified = true;
		try {
			await user.save();
		} catch (e) {
			console.error(e.toString());
			return res.status(500).send({ message: 'Error updating database' });
		}

		if (req.accepts('html'))
			return res.redirect('https://nekos.brussell.me/')
		return res.sendStatus(204);
	}
}

module.exports = RegisterVerifyPOST;
