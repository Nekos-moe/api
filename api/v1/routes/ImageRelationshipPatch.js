const RateLimiter = require('../../../structures/RateLimiter');

class ImageRelationshipPATCH {
	constructor(controller) {
		this.path = '/image/:id/relationship';
		this.router = controller.router;
		this.database = controller.database;
		this.authorize = controller.authorize;

		this.rateLimiter = new RateLimiter({ max: 10 }); // 10/10

		this.router.patch(
			this.path,
			this.rateLimiter.limit.bind(this.rateLimiter),
			this.authorize.bind(this),
			this.run.bind(this)
		);
	}

	async run(req, res) {
		if (!req.body)
			return res.status(400).send({ message: "No body" });

		let image = await this.database.Image.findOne({ id: req.params.id });

		if (!image)
			return res.status(404).send({ message: 'Image not found' });

		let uploader = await this.database.User.findOne({ id: image.uploader.id });

		if (req.body.type === 'like') {
			if (req.body.create === true) {
				image.likes++;
				uploader.likesReceived++;
				req.user.likes.push(image.id);

				await image.save();
				await uploader.save();
				await req.user.save();
			} else if (req.body.create === false && req.user.likes.includes(image.id)) {
				image.likes--;
				uploader.likesReceived--;
				req.user.likes.splice(req.user.likes.indexOf(image.id), 1);

				await image.save();
				await uploader.save();
				await req.user.save();
			}

			return res.sendStatus(204);
		}

		if (req.body.type === 'favorite') {
			if (req.body.create === true) {
				image.favorites++;
				uploader.favoritesReceived++;
				req.user.favorites.push(image.id);

				await image.save();
				await uploader.save();
				await req.user.save();
			} else if (req.body.create === false && req.user.favorites.includes(image.id)) {
				image.favorites--;
				uploader.favoritesReceived--;
				req.user.favorites.splice(req.user.favorites.indexOf(image.id), 1);

				await image.save();
				await uploader.save();
				await req.user.save();
			}

			return res.sendStatus(204);
		}

		return res.status(400).send({ message: 'Invalid type' });
	}
}

module.exports = ImageRelationshipPATCH;
