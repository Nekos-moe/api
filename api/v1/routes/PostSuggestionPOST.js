const shortid = require('shortid');
const RateLimiter = require('../../../structures/RateLimiter');

class PostSuggestionPOST {
	constructor(controller) {
		this.path = '/images/:id/suggest';
		this.router = controller.router;
		this.database = controller.database;
		this.authorize = controller.authorize;

		this.rateLimiter = new RateLimiter({ max: 3 }); // 3/10

		this.router.post(
			this.path,
			this.rateLimiter.limit.bind(this.rateLimiter),
			this.authorize.bind(this),
			this.run.bind(this)
		);
	}

	processTags(tags) {
		if (!Array.isArray(tags))
			return { message: 'Tags must be an array of tags' };

		tags = tags
			.filter(t => typeof t === 'string') // Filter non-strings
			.map(t => t.replace(/, *|_+| {2,}/g, ' ').toLowerCase()) // Replace extra spacing and remove commas
			.filter(t => t !== '' && t.trim() !== ''); // Remove empty tags

		if (tags.length > 120)
			return { message: 'A post can only have up to 120 tags' };

		if (tags.find(t => t.length > 50))
			return { message: 'Tags have a maximum length of 50 characters' };

		// Remove duplicates and sort alphabetically
		tags = [...new Set(tags)].sort((a, b) => a.localeCompare(b));

		return tags;
	}

	async run(req, res) {
		if (!req.body)
			return res.status(400).send({ message: 'No body' });

		if (req.body.nsfw !== undefined && typeof req.body.nsfw !== 'boolean')
			return res.status(400).send({ message: 'NSFW must be a boolean' });

		if (req.body.tagsAdd) {
			const tags = this.processTags(req.body.tagsAdd)
			if (tags.message !== undefined)
				return res.status(400).send(tags);

			req.body.tagsAdd = tags;
		}

		if (req.body.tagsRemove) {
			const tags = this.processTags(req.body.tagsRemove)
			if (tags.message !== undefined)
				return res.status(400).send(tags);

			req.body.tagsRemove = tags;
		}

		if (req.body.artist && req.body.artist.length > 60)
			return res.status(400).send({ message: 'The artist field has a maximum length of 60 characters' });

		let post = await this.database.Image.findOne({ id: req.params.id });

		if (!post)
			return res.status(404).send({ message: 'Image not found' });

		// if (req.user.id === post.uploader.id)
		// 	return res.status(403).send({ message: 'You can not suggest edits to a post you own' });

		await this.database.PostSuggestion.create({
			id: shortid.generate(),
			postId: post.id,
			user: {
				id: req.user.id,
				username: req.user.username
			},
			nsfw: req.body.nsfw !== undefined ? req.body.nsfw : undefined,
			artist: req.body.artist ? req.body.artist : undefined,
			tagsAdd: req.body.tagsAdd ? req.body.tagsAdd : undefined,
			tagsRemove: req.body.tagsRemove ? req.body.tagsRemove : undefined
		});

		return res.sendStatus(204);
	}
}

module.exports = PostSuggestionPOST;
