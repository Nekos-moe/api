const RateLimiter = require('../../../structures/RateLimiter');

function escapeRegExp(str) {
	return str.replace(/[-[\]/{}()*+?.\\^$|]/g, "\\$&");
}

class UserSearchPOST {
	constructor(controller) {
		this.path = '/users/search';
		this.router = controller.router;
		this.database = controller.database;

		this.rateLimiter = new RateLimiter({ max: 5 }); // 10/10

		this.router.post(
			this.path,
			this.rateLimiter.limit.bind(this.rateLimiter),
			this.run.bind(this)
		);
	}

	async run(req, res) {
		try {
			if (!req.body)
				return res.status(400).send({ message: "No body" });

			let resp;

			if (typeof req.body.query === 'string' && req.body.query) {
				resp = await this.database.User.find({ username: new RegExp(escapeRegExp(req.body.query), 'i'), verified: true })
					.sort({ likesReceived: -1, favoritesReceived: -1 }).select('-_id -__v').lean().exec();

				resp.sort((a, b) => (a.username.length - req.body.query.length) - (b.username.length - req.body.query.length));

				if (typeof req.body.skip === 'number' && req.body.skip >= 0)
					resp = resp.slice(req.body.skip, req.body.skip + (typeof req.body.limit === 'number' && req.body.limit < 100 ? req.body.limit : 20));
				else
					resp = resp.slice(0, typeof req.body.limit === 'number' && req.body.limit < 100 ? req.body.limit : 20);
			} else {
				let query = this.database.User.find({ verified: true }).sort({ likesReceived: -1, favoritesReceived: -1 });

				if (typeof req.body.skip === 'number' && req.body.skip >= 0)
					query.skip(req.body.skip);

				query.limit(typeof req.body.limit === 'number' && req.body.limit < 100 ? req.body.limit : 20);

				resp = await query.select('-_id -__v').lean().exec();
			}

			return res.status(200).send({ users: resp });
		} catch (error) {
			console.error(error);
			res.status(500).send({ message: 'There was an error executing the query' });
		}
	}
}

module.exports = UserSearchPOST;
