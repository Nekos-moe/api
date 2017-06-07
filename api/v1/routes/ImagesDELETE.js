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
		let image = await this.database.Image.findOne({ id: req.params.id });
		if (!image)
			return res.status(404).send({ message: 'Image not found' });

		if (req.user.id !== image.uploader.id)
			return res.status(403).send({ message: 'You are not the uploader of this image' });

		fs.unlinkSync(`${__dirname}/../../../image/${image.id}.jpg`);
		// Delete image from MongoDB
		await this.database.Image.remove({ id: image.id });
		req.user.uploads--;

		if (image.likes > 0) {
			await this.database.User.updateMany({ likes: { $in: [image.id] } }, { $pull: { likes: image.id } });
			req.user.likesReceived--;
		}

		if (image.favorites > 0) {
			await this.database.User.updateMany({ favorites: { $in: [image.id] } }, { $pull: { favorites: image.id } });
			req.user.favoritesReceived--;
		}

		await req.user.save();

		return res.sendStatus(204);
	}
}

module.exports = ImagesDELETE;
