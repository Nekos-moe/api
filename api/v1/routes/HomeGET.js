class HomeGET {
	constructor(controller) {
		this.path = '/';
		this.router = controller.router;
		this.database = controller.database;

		this.router.get(this.path, this.run.bind(this));
	}

	async run(req, res) {
		return res.status(200).send({
			endpoints: {
				"GET /": "<- You are here",
				"POST /register": "Create an unverified account",
				"GET /register/verify/:key": "Verify an account",
				"POST /register/resend": "Resend a verification email",
				"POST /auth": "Get token from username and password",
				"POST /auth/regen": "Reset an account's token",
				"PATCH /account/edit": "Edit account information",
				"GET /images/:id": "Get an image",
				"PATCH /images/:id": "Update an image's metadata",
				"DELETE /images/:id": "Delete an image",
				"POST /images": "Upload a catgirl",
				"POST /images/search": "Search images",
				"GET /users/:id": "Get a user or @me"
			},
			version: 1,
			releaseWhen: "SoonTM"
		});
	}
}

module.exports = HomeGET;
