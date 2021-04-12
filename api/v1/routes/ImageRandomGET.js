const RateLimiter = require('../../../structures/RateLimiter');

class ImageRandomGET {
	constructor(controller) {
		this.path = '/random/image';
		this.router = controller.router;
		this.database = controller.database;

		this.rateLimiter = new RateLimiter({ max: 5 }); // 5/10

		// NOTE: This is for backwards-compatibilitity
		this.router.get(
			this.path,
			this.rateLimiter.limit.bind(this.rateLimiter),
			this.run.bind(this)
		);
		
		this.router.post(
			this.path,
			this.rateLimiter.limit.bind(this.rateLimiter),
			this.run.bind(this)
		);
	}

	async run(req, res) {
		const body = req.body || req.query;		

		const agg = this.database.Image.aggregate().cursor({ });

		const options = { };

		if (body.nsfw !== undefined)
			options.nsfw = body.nsfw === 'true' || body.nsfw === true;

		if (Array.isArray(body.tags))
			body.tags = body.tags.join(', ');

		if (body.tags !== undefined && typeof body.tags === 'string' && body.tags.trim() !== '') {
			/* What we are doing here is bypassing a mongodb $text restriction.
			 * If you only include negate expressions then nothing will match so
			 * we turn it into a $not regex that matches negated tags and returns
			 * the rest. This is needed for tag blacklists.
			*/
			if (body.tags.split(/-"?[^",]+"?(?:, *)?/).join('').trim() === '') {
				options.tags = {
					$nin: body.tags.match(/(^|, *)-[^,]+/g).map(e => e.replace(/,? *-|"/g, ''))
				};
			} else {
				options.$text = { $search: body.tags };
			}
		}

		agg.match(options);

		if (body.count !== undefined && body.count != 0) {
			const count = parseInt(body.count, 10);
			agg.sample(!isNaN(count) && count <= 100 ? count : 1);
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
