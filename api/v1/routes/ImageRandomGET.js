const RateLimiter = require('../../../structures/RateLimiter');

class ImageRandomGET {
	constructor(controller) {
		this.path = '/random/image';
		this.router = controller.router;
		this.database = controller.database;

		this.rateLimiter = new RateLimiter({ max: 5 }); // 5/10

		this.router.get(
			this.path,
			this.rateLimiter.limit.bind(this.rateLimiter),
			this.run.bind(this)
		);
	}

	async run(req, res) {
		let agg = this.database.Image.aggregate();
		if (req.query.nsfw !== undefined)
			agg.match({ nsfw: req.query.nsfw == 'true' });

		if (req.query.count !== undefined && req.query.count != '0' && /^\d{1,3}$/.test(req.query.count)) {
			let count = parseInt(req.query.count, 10);
			agg.sample(count <= 100 ? count : 1);
		} else
			agg.sample(1);

		let images = await agg.exec();

		return res.status(200).send({ images });
	}
}

module.exports = ImageRandomGET;
