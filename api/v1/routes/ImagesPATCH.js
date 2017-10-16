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
			// Convert new tags to old format for processing
			if (Array.isArray(req.body.tags))
				req.body.tags = req.body.tags.join(',');

			req.body.tags = req.body.tags.replace(/( *,[ ,]*(\r?\n)*|\r\n+|\n+)/g, ',').replace(/[-_]/g, ' ').replace(/(^,|,(?:,+|$))/g, '');

			if (req.body.tags.split(',').length > 80)
				return res.status(400).send({ message: "A post can only have up to 80 tags" });

			if (req.body.tags.split(',').find(t => t.length > 50))
				return res.status(400).send({ message: "Tags have a maximum length of 50 characters" });
		}

		if (req.body.artist && req.body.artist.length > 40)
			return res.status(400).send({ message: "The artist field has a maximum length of 40 characters" });

		let image = await this.database[req.body.pending ? 'PendingImage' : 'Image'].findOne({ id: req.params.id });

		if (!image)
			return res.status(404).send({ message: 'Image not found' });

		if (req.user.id !== image.uploader.id && !req.user.roles || !(req.user.roles.includes('admin') || req.user.roles.includes('approver')))
			return res.status(403).send({ message: 'You are not the uploader of this image' });

		image.tags = req.body.tags.split(/ *, */) || image.tags;
		image.artist = req.body.artist !== undefined ? req.body.artist.replace(/_/g, ' ') || undefined : image.artist;
		image.nsfw = !!(req.body.nsfw === undefined ? image.nsfw : req.body.nsfw);
		await image.save();

		return res.sendStatus(204);
	}
}

module.exports = ImagesPATCH;
