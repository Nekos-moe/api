const RateLimiter = require('../../../structures/RateLimiter');

class PostSuggestionReviewPOST {
	constructor(controller) {
		this.path = '/suggestions/:id/review';
		this.router = controller.router;
		this.database = controller.database;
		this.authorize = controller.authorize;
		this.mailTransport = controller.mailTransport;

		this.rateLimiter = new RateLimiter({ max: 10 }); // 10/10 limit

		this.router.post(
			this.path,
			this.rateLimiter.limit.bind(this.rateLimiter),
			this.authorize.bind(this),
			this.run.bind(this)
		);
	}

	async run(req, res) {
		if (!req.user.roles || !req.user.roles.includes('admin') && !req.user.roles.includes('approver'))
			return res.status(403).send({ message: 'You do not have permission to review post suggestions' });

		const suggestion = await this.database.PostSuggestion.findOne({ id: req.params.id });

		if (!suggestion)
			return res.status(404).send({ message: 'Post suggestion not found' });

		if (req.body.action === 'approve') {
			const post = await this.database.Image.findOne({ id: suggestion.postId });

			if (!post) {
				await suggestion.remove();

				return res.status(404).send({ message: 'Associated post not found' });
			}

			if (suggestion.nsfw === true || suggestion.nsfw === false)
				post.nsfw = suggestion.nsfw;

			if (suggestion.artist)
				post.artist = suggestion.artist;

			if (suggestion.tagsRemove && suggestion.tagsRemove.length > 0)
				post.tags = post.tags.filter(tag => !suggestion.tagsRemove.includes(tag));

			if (suggestion.tagsAdd && suggestion.tagsAdd.length > 0)
				post.tags = [...new Set(post.tags.concat(suggestion.tagsAdd))].sort((a, b) => a.localeCompare(b));

			await post.save();
			await suggestion.remove();

			return res.status(200).send({ message: 'Post suggestion applied' });
		} else if (req.body.action === 'deny') {
			if (!req.body.reason)
				return res.status(400).send({ message: 'A reason is required to deny a post suggestion' });

			await suggestion.remove();

			return res.status(200).send({ message: 'Post suggestion denied' });
		}

		return res.status(400).send({ message: 'Invalid action' });
	}
}

module.exports = PostSuggestionReviewPOST;
