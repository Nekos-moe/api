const RateLimiter = require('../../../structures/RateLimiter');

class ImagesPATCH {
	constructor(controller) {
		this.path = '/account/settings';
		this.router = controller.router;
		this.database = controller.database;
		this.authorize = controller.authorize;

		this.rateLimiter = new RateLimiter({ max: 5 }); // 5/10

		this.router.patch(
			this.path,
			this.rateLimiter.limit.bind(this.rateLimiter),
			this.authorize.bind(this),
			this.run.bind(this)
		);
	}

	async run(req, res) {
		if (!req.body) {
			this.rateLimiter.unlimit(req, res);
			return res.status(400).send({ message: 'No body' });
		}

		if (req.body.savedTags) {
			if (!Array.isArray(req.body.savedTags) || !req.body.savedTags.every(el => typeof el === 'string')) {
				this.rateLimiter.unlimit(req, res);
				return res.status(400).send({ message: '"savedTags" must be an array of strings' });
			}

			if (req.body.savedTags.length > 100)
				return res.status(400).send({ message: '"savedTags" has a maximum length of 100' });

			if (req.body.savedTags.find(t => t.length > 50))
				return res.status(400).send({ message: 'Tags in "savedTags" have a maximum length of 50 characters' });

			// Remove duplicates and sort alphabetically
			req.body.savedTags = [...new Set(req.body.savedTags)].sort((a, b) => a.localeCompare(b));

			req.user.savedTags = req.body.savedTags;

			await req.user.save();
		}

		return res.sendStatus(204);
	}
}

module.exports = ImagesPATCH;
