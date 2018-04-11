const RateLimiter = require('../../../structures/RateLimiter');

class TagsGET {
	constructor(controller) {
		this.path = '/tags';
		this.router = controller.router;
		this.database = controller.database;

		this.rateLimiter = new RateLimiter({ max: 4 }); // 4/10 limit

		this.router.get(
			this.path,
			this.rateLimiter.limit.bind(this.rateLimiter),
			this.run.bind(this)
		);
	}

	async run(req, res) {
		let options = { };
		if (req.query.nsfw === 'true')
			options.nsfw = true;
		else if (req.query.nsfw === 'false')
			options.nsfw = false;

		return res.status(200).send({ options, tags: await this.database.Image.distinct('tags', options) });
	}
}

module.exports = TagsGET;
