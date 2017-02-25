class RegisterVerifyPOST {
	constructor(controller) {
		this.path = '/register/verify/:key';
		this.router = controller.router;
		this.database = controller.database;

		this.router.get(this.path, this.run.bind(this));
	}

	async run(req, res) {
		// Find the user being verified
		let unverifiedUser = await this.database.UnverifiedUser.findOne({ key: req.params.key });

		// No matching account found
		if (!unverifiedUser)
			return res.status(409).send({
				message: 'Invalid key. Either the account has already been validated or the key was misspelled'
			});

		let user = await this.database.User.findOne({ email: unverifiedUser.email }).select('+email');

		// Mark user as verified and save user. Then delete the unverified user doc
		user.verified = true;
		try {
			await this.database.UnverifiedUser.remove({ key: unverifiedUser.key });
			await user.save();
		} catch (e) {
			console.error(e.toString());
			return res.status(500).send({ message: 'Error updating database' });
		}

		return res.sendStatus(204);
	}
}

module.exports = RegisterVerifyPOST;
