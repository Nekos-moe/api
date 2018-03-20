const RateLimiter = require('../../../structures/RateLimiter');

class PendingImagesGET {
	constructor(controller) {
		this.path = '/pending/list';
		this.router = controller.router;
		this.database = controller.database;
		this.authorize = controller.authorize;

		this.rateLimiter = new RateLimiter({ max: 10 }); // 10/10 limit

		this.router.get(
			this.path,
			this.rateLimiter.limit.bind(this.rateLimiter),
			this.authorize.bind(this),
			this.run.bind(this)
		);
	}

	async run(req, res) {
		if ((!req.user.roles || !req.user.roles.includes('admin') && !req.user.roles.includes('approver')) && req.user.id !== req.query.user)
			return res.status(403).send({ message: "You do not have permission to see other user's pending posts" });

		const query = req.query.user ? { ['uploader.id']: req.query.user } : { };
		const images = await this.database.PendingImage.find(query).select('-_id -__v').lean().exec();

		return res.status(200).send({ images });
	}
}

module.exports = PendingImagesGET;
