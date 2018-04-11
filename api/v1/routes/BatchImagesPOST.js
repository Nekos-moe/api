const RateLimiter = require('../../../structures/RateLimiter');

class BatchImagesGET {
	constructor(controller) {
		this.path = '/batch/images';
		this.router = controller.router;
		this.database = controller.database;

		this.rateLimiter = new RateLimiter({ max: 4 }); // 3/10 limit

		this.router.post(
			this.path,
			this.rateLimiter.limit.bind(this.rateLimiter),
			this.run.bind(this)
		);
	}

	async run(req, res) {
		let images = await this.database.Image.find({ id: { $in: req.body.ids } }).select('-_id -__v').lean();

		return res.status(200).send({ images: images.sort((a, b) => req.body.ids.indexOf(a.id) - req.body.ids.indexOf(b.id)) });
	}
}

module.exports = BatchImagesGET;
