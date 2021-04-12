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
		let agg = this.database.Image.aggregate().cursor({ });

		let options = {},
			projection = { '_id': 0, '__v': 0 },
			sort = { };

		if (req.query.nsfw !== undefined)
			options.nsfw = ['true','True',true].includes(req.query.nsfw);

		/* code copied from ImageSearchPOST.js
		 * written by brussell98
		*/
		if (Array.isArray(req.body.tags))
			req.body.tags = req.body.tags.join(', ');

		if (req.body.tags !== undefined && req.body.tags.trim() !== '') {
			/* What we are doing here is bypassing a mongodb $text restriction.
			 * If you only include negate expressions then nothing will match so
			 * we turn it into a $not regex that matches negated tags and returns
			 * the rest. This is needed for tag blacklists.
			*/
			if (req.body.tags.split(/-"?[^",]+"?(?:, *)?/).join('').trim() === '') {
				options.tags = {
					$nin: req.body.tags.match(/(^|, *)-[^,]+/g).map(e => e.replace(/,? *-|"/g, ''))
				};
			} else {
				options.$text = { $search: req.body.tags };

				if (req.body.sort && req.body.sort === 'relevance') {
					projection.score = { $meta: 'textScore' };
					sort.score = { $meta: 'textScore' };
				}
			}
		}

		agg.match(options)

		if (req.query.count !== undefined && req.query.count != '0' && /^\d{1,3}$/.test(req.query.count)) {
			let count = parseInt(req.query.count, 10);
			agg.sample(count <= 100 ? count : 1);
		} else
			agg.sample(1);

		const images = await this.handleCursor(agg.exec());

		return res.status(200).send({ images });
	}

	handleCursor(cursor) {
		let data = [];

		return new Promise(resolve => {
			cursor.on('data', d => {
				delete d._id;
				delete d.__v;
				data.push(d);
			}).once('end', () => resolve(data));
		});
	}
}

module.exports = ImageRandomGET;
