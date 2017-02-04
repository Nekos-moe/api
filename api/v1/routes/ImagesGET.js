class ImagesGET {
	constructor(controller) {
		this.path = '/images/:id';
		this.router = controller.router;
		this.database = controller.database;
		this.authorize = controller.authorize;

		controller.rateLimitManager.limitRoute(this.path, { max: 10 });

		this.router.get(this.path, this.authorize.bind(this), this.run.bind(this));
	}

	async run(req, res) {
		let image = await this.database.Image.findOne({ id: req.params.id }).select('-_id -__v').lean().exec();
		if (!image)
			return res.status(404).send({ message: 'Image not found' });

		return res.status(200).send({ image });
	}
}

module.exports = ImagesGET;
