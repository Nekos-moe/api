class RegisterVerifyPOST {
	constructor(controller) {
		this.path = '/register/verify/:key';
		this.router = controller.router;
		this.database = controller.database;

		this.router.get(this.path, this.run.bind(this));
	}

	async run(req, res) {
		// Get key doc
		const key = await this.database.VerifyKey.findOne({ key: req.params.key });

		// Invalid key
		if (!key)
			return res.status(409).send({ message: 'Invalid key' });

		// Find the user being verified
		const user = await this.database.User.findOne({ id: key.userId });

		// No matching account found
		if (!user || user.verified)
			return res.status(409).send({
				message: 'User is either already verified or the account has been deleted.'
			});

		// Mark user as verified and save user. Then delete the key doc
		user.verified = true;
		try {
			await key.remove();
			await user.save();
		} catch (error) {
			console.error(error.toString());
			return res.status(500).send({ message: 'Error updating database' });
		}

		if (req.accepts('html'))
			return res.redirect('https://nekos.moe/')
		return res.sendStatus(204);
	}
}

module.exports = RegisterVerifyPOST;
