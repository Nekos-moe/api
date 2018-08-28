const fs = require('fs'),
	RateLimiter = require('../../../structures/RateLimiter');

class ImagesDELETE {
	constructor(controller) {
		this.path = '/images/:id';
		this.router = controller.router;
		this.database = controller.database;
		this.authorize = controller.authorize;

		this.rateLimiter = new RateLimiter({ max: 10 }); // 10/10

		this.router.delete(
			this.path,
			this.rateLimiter.limit.bind(this.rateLimiter),
			this.authorize.bind(this),
			this.run.bind(this)
		);
	}

	async run(req, res) {
		const pending = req.query.pending === 'true';
		let image = await this.database[pending ? 'PendingImage' : 'Image'].findOne({ id: req.params.id });
		if (!image)
			return res.status(404).send({ message: 'Image not found' });

		if (req.user.id !== image.uploader.id && !req.user.roles || !req.user.roles.includes('admin'))
			return res.status(403).send({ message: 'You are not the uploader of this image' });

		fs.unlinkSync(`${__dirname}/../../../image/${image.id}.jpg`);
		fs.unlinkSync(`${__dirname}/../../../thumbnail/${image.id}.jpg`);
		// Delete image from MongoDB
		await image.remove();

		if (!pending) {
			let uploader = req.user;
			if (image.uploader.id !== req.user.id)
				uploader = await this.database.User.findOne({ id: image.uploader.id });

			uploader.uploads--;

			if (image.likes > 0) {
				await this.database.User.updateMany({ likes: { $in: [image.id] } }, { $pull: { likes: image.id } });
				uploader.likesReceived -= image.likes;
			}

			if (image.favorites > 0) {
				await this.database.User.updateMany({ favorites: { $in: [image.id] } }, { $pull: { favorites: image.id } });
				uploader.favoritesReceived -= image.favorites;
			}

			await uploader.save();

			await this.database.PostSuggestion.deleteMany({ postId: image.id });
		}

		return res.sendStatus(204);
	}
}

module.exports = ImagesDELETE;
