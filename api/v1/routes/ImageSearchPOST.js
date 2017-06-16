const RateLimiter = require('../../../structures/RateLimiter');

function escapeRegExp(str) {
	return str.replace(/[-[\]/{}()*+?.\\^$|]/g, "\\$&");
}

class ImageSearchPOST {
	constructor(controller) {
		this.path = '/images/search';
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
		if (!req.body)
			return res.status(400).send({ message: "No body" });

		// If searching by ID skip search
		if (req.body.id) {
			return res.status(200).send({
				images: await this.database.Image.find({ id: req.body.id }).select('-_id -__v').lean().exec()
			});
		}

		let options = {},
			projection = { '_id': 0, '__v': 0 },
			sort = {};

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
			// Sometimes artist has an alternate name in ()
			// This allows users to search by using either name.
			options.artist = new RegExp(`(?:\\(|^)${escapeRegExp(req.body.artist)} *(?:\\)|$|\\(|)`, 'i');
		}
		if (req.body.tags !== undefined && req.body.tags !== '') {
			/* What we are doing here is bypassing a mongodb $text restriction.
			 * If you only include negate expressions then nothing will match so
			 * we turn it into a $not regex that matches negated tags and returns
			 * the rest. This is needed for tag blacklists.
			*/
			if (req.body.tags.split(/-"[^"]+"/).join('').trim() === '') {
				options.tags = {
					$not: new RegExp(
						"(,|^)(" +
						req.body.tags.split(/" -"/).join('|').substring(2).slice(0, -1) +
						")(,|$)"
					)
				};
			} else {
				options.$text = { $search: req.body.tags };
				projection.score = { $meta: 'textScore' };
				sort.score = { $meta: 'textScore' };
			}
		}
		if (req.body.sort) {
			if (req.body.sort === 'recent')
				sort._id = -1;
			else if (req.body.sort === 'likes')
				sort.likes = 1;
		}

		let query = this.database.Image.find(options).sort(sort);
		if (req.body.posted_before !== undefined)
			query.lt('createdAt', req.body.posted_before);
		if (req.body.posted_after !== undefined)
			query.gt('createdAt', req.body.posted_after);
		if (typeof req.body.skip === 'number' && req.body.skip >= 0)
			query.skip(req.body.skip);

		// Max limit of 50
		let limit = typeof req.body.limit === 'number' && req.body.limit < 50 ? req.body.limit : 20;

		return res.status(200).send({
			images: await query.select(projection).limit(limit).lean().exec()
		});
	}
}

module.exports = ImageSearchPOST;
