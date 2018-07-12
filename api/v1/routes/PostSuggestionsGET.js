const RateLimiter = require('../../../structures/RateLimiter');

class PostSuggestionsGET {
	constructor(controller) {
		this.path = '/suggestions/list';
		this.router = controller.router;
		this.database = controller.database;
		this.authorize = controller.authorize;

		this.rateLimiter = new RateLimiter({ max: 5 }); // 5/10 limit

		this.router.get(
			this.path,
			this.rateLimiter.limit.bind(this.rateLimiter),
			this.authorize.bind(this),
			this.run.bind(this)
		);
	}

	async run(req, res) {
		if ((!req.user.roles || !req.user.roles.includes('admin') && !req.user.roles.includes('approver')))
			return res.status(403).send({ message: "You do not have permission to see post suggestions" });

		return res.status(200).send({ suggestions: await this.database.PostSuggestion.find().select('-_id -__v').lean() });
	}
}

module.exports = PostSuggestionsGET;
