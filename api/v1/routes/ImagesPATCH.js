const RateLimiter = require('../../../structures/RateLimiter');

class ImagesPATCH {
	constructor(controller) {
		this.path = '/images/:id';
		this.router = controller.router;
		this.database = controller.database;
		this.authorize = controller.authorize;

		this.rateLimiter = new RateLimiter({ max: 10 }); // 10/10

		this.router.patch(
			this.path,
			this.rateLimiter.limit.bind(this.rateLimiter),
			this.authorize.bind(this),
			this.run.bind(this)
		);
	}

	async run(req, res) {
		if (!req.body)
			return res.status(400).send({ message: "No body" });

		if (req.body.tags) {
			req.body.tags = req.body.tags.replace(/ *, */g, ',');

			if (req.body.tags.split(',').length > 50)
				return res.status(400).send({ message: "A post can only have up to 50 tags" });

			if (req.body.tags.split(',').find(t => t.length > 40))
				return res.status(400).send({ message: "Tags have a maximum length of 40 characters" });
		}

		if (req.body.artist && req.body.artist.length > 30)
			return res.status(400).send({ message: "The artist field has a maximum length of 30 characters" });

		let image = await this.database.Image.findOne({ id: req.params.id });

		if (req.user.id !== image.uploader.id)
			return res.status(403).send({ message: 'You are not the uploader of this image' });

		image.tags = req.body.tags || image.tags;
		image.artist = req.body.artist !== undefined ? req.body.artist || undefined : image.artist;
		image.nsfw = !!(req.body.nsfw === undefined ? image.nsfw : req.body.nsfw);
		await image.save();

		return res.sendStatus(204);
	}
}

module.exports = ImagesPATCH;
