const RateLimiter = require('../../../structures/RateLimiter');

function escapeRegExp(str) {
	return str.replace(/[-[\]/{}()*+?.\\^$|]/g, "\\$&");
}

class ImageRecommendationsPOST {
	constructor(controller) {
		this.path = '/images/recommended';
		this.router = controller.router;
		this.database = controller.database;

		this.rateLimiter = new RateLimiter({ max: 5 }); // 5/10

		this.router.post(
			this.path,
			this.rateLimiter.limit.bind(this.rateLimiter),
			this.run.bind(this)
		);
	}

	async run(req, res) {
		if (!req.body)
			return res.status(400).send({ message: 'No body' });

		const options = { tags: { } };
		const sort = { };

		// Add query options to the mongoose find query.
		if (req.body.nsfw !== undefined)
			options.nsfw = req.body.nsfw;

		if (req.body.uploader) {
			if (typeof req.body.uploader === 'string')
				options['uploader.username'] = req.body.uploader;
			else if (typeof req.body.uploader === 'object') {
				if (req.body.uploader.id)
					options['uploader.id'] = req.body.uploader.id;
				if (req.body.uploader.username)
					options['uploader.username'] = req.body.uploader.username;
			}
		}

		if (req.body.artist) {
			// Sometimes artist has an alternate name or group name in ()
			// This allows users to search by using either name.
			options.artist = new RegExp(`(?:\\(|^)${escapeRegExp(req.body.artist)} *(?:\\)|$|\\(|)`, 'i');
		}

		if (Array.isArray(req.body.tags) && req.body.tags.length !== 0) {
			if (Array.isArray(req.body.blacklist) && req.body.blacklist.length !== 0)
				options.tags.$nin = req.body.blacklist;

			options.tags.$in = req.body.tags;
		} else
			return res.status(400).send({ message: 'Unable to return recommendations when an array of tags is not given' });

		if (req.body.sort) {
			if (req.body.sort === 'oldest')
				sort.createdAt = 1;
			else if (req.body.sort === 'likes') {
				sort.likes = -1;
				sort.createdAt = -1;
			} else
				sort.createdAt = -1;
		}

		const query = this.database.Image.find(options).sort(sort);
		if (req.body.posted_before !== undefined)
			query.lt('createdAt', req.body.posted_before);
		if (req.body.posted_after !== undefined)
			query.gt('createdAt', req.body.posted_after);

		if (typeof req.body.skip === 'number' && req.body.skip >= 0) {
			if (req.body.skip > 2500)
				return res.status(400).send({ message: 'Cannot skip more than 2,500 images' });

			query.skip(req.body.skip);
		}

		// Max limit of 50
		const limit = typeof req.body.limit === 'number' && req.body.limit < 50 ? req.body.limit : 20;

		return res.status(200).send({
			images: await query.select({ '_id': 0, '__v': 0 }).limit(limit).lean()
		});
	}
}

module.exports = ImageRecommendationsPOST;
