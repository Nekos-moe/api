class ImageSearchPOST {
	constructor(controller) {
		this.path = '/images/search';
		this.router = controller.router;
		this.database = controller.database;
		this.authorize = controller.authorize;

		controller.rateLimitManager.limitRoute(this.path, { max: 10 }); // 10/10

		this.router.post(this.path, this.authorize.bind(this), this.run.bind(this));
	}

	async run(req, res) {
		if (!req.body)
			return res.status(400).send({ message: "No body" });

		// If searching by ID skip search
		if (req.body.id) {
			return res.status(200).send({
				images: await this.database.Image.find({ id: req.body.id }).select('-_id -__v').lean().exec()
			});
		}

		let options = {},
			projection = { '_id': 0, '__v': 0 };

		// Add query options to the mongoose find query.
		if (req.body.nsfw !== undefined)
			options.nsfw = req.body.nsfw;
		if (req.body.uploader)
			options.uploader = req.body.uploader;
		if (req.body.artist)
			options.artist = req.body.artist;
		if (req.body.tags !== undefined) {
			options.$text = { $search: req.body.tags };
			projection.score = { $meta: 'textScore' };
		}

		let query = this.database.Image.find(options);
		if (req.body.tags !== undefined) // Tag search
			query.sort({ score: { $meta: 'textScore' } });
		if (req.body.posted_before !== undefined)
			query.lt('createdAt', req.body.posted_before);
		if (req.body.posted_after !== undefined)
			query.gt('createdAt', req.body.posted_after);

		// Max limit of 50
		let limit = typeof req.body.limit === 'number' && req.body.limit < 50 ? req.body.limit : 20;

		return res.status(200).send({
			images: await query.select(projection).limit(limit).exec()
		});
	}
}

module.exports = ImageSearchPOST;
