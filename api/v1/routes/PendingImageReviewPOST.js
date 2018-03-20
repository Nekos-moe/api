const fs = require('fs'),
	RateLimiter = require('../../../structures/RateLimiter');

class PendingImageReviewPOST {
	constructor(controller) {
		this.path = '/pending/:id/review';
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
			return res.status(403).send({ message: "You do not have permission to approve posts" });

		let image = await this.database.PendingImage.findOne({ id: req.params.id }).select('+originalHash');

		if (!image)
			return res.status(404).send({ message: 'Image not found' });

		let user = await this.database.User.findOne({ id: image.uploader.id }).select('+email');

		if (req.body.action === 'approve') {
			await this.database.Image.create({
				id: image.id,
				originalHash: image.originalHash,
				uploader: image.uploader,
				approver: {
					id: req.user.id,
					username: req.user.username
				},
				nsfw: image.nsfw,
				artist: image.artist,
				tags: image.tags,
				comments: [],
				createdAt: image.createdAt
			});

			user.uploads++;
			await user.save();

			await image.remove();

			return res.status(200).send({ message: 'Post approved' });
		} else if (req.body.action === 'deny') {
			if (!req.body.reason)
				return res.status(404).send({ message: 'Reason required to deny a post' });

			await this.mailTransport.sendHTMLMail('denied', {
				to: user.email,
				subject: 'You post to nekos.moe has been denied',
				text: `Your post has been denied.\n\nID: ${image.id}\nReason: ${req.body.reason}\nReviewed by: ${req.user.username}`,
				attachments: [{
					filename: image.id + '.jpg',
					content: fs.createReadStream(`${__dirname}/../../../image/${image.id}.jpg`),
					cid: image.originalHash
				}]
			}, {
				cid: image.originalHash,
				reason: req.body.reason.replace(/\n/g, '<br>'),
				reviewer: req.user.username,
				id: image.id,
				username: user.username
			});

			fs.unlinkSync(`${__dirname}/../../../image/${image.id}.jpg`);
			fs.unlinkSync(`${__dirname}/../../../thumbnail/${image.id}.jpg`);

			await image.remove();

			return res.status(200).send({ message: 'Post denied' });
		}

		return res.status(400).send({ message: 'Invalid action' });
	}
}

module.exports = PendingImageReviewPOST;
