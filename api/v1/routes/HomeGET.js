class HomeGET {
	constructor(controller) {
		this.path = '/';
		this.router = controller.router;
		this.database = controller.database;

		this.router.get(this.path, this.run.bind(this));
	}

	async run(req, res) {
		return res.status(200).json({
			docs: 'https://docs.nekos.moe/',
			version: 1
		});
	}
}

module.exports = HomeGET;
