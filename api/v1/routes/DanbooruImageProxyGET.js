const axios = require('axios');
const RateLimiter = require('../../../structures/RateLimiter');

class DanbooruImageProxy {
	constructor(controller) {
		this.path = '/proxy/danbooru';
		this.router = controller.router;
		this.database = controller.database;
		this.authorize = controller.authorize;

		this.rateLimiter = new RateLimiter({ max: 3 }); // 3/10

		this.router.get(
			this.path,
			this.rateLimiter.limit.bind(this.rateLimiter),
			this.authorize.bind(this),
			this.run.bind(this)
		);
	}

	async run(req, res) {
		if (req.headers.referer !== 'https://nekos.moe/upload')
			return res.sendStatus(403);

		if (!req.query.url || !/^https?:\/\/\w+\.donmai\.us\//.test(req.query.url))
			return res.status(400).send({ message: 'Valid danbooru URL required' });

		try {
			const danbooruRes = await axios.get(req.query.url, {
				headers: { 'Accept': 'image/*' },
				responseType: 'arraybuffer'
			});

			return res.json({
				data: danbooruRes.data.toString('base64'),
				type: danbooruRes.headers['content-type']
			});
		} catch (error) {
			if (!error.response) {
				console.error('[DanbooruImageProxy]', error);
				return res.status(500).json({ message: 'Internal server error' });
			}
			return res.status(error.response.status).json({ message: 'Unexpected response from Danbooru' });
		}
	}
}

module.exports = DanbooruImageProxy;
