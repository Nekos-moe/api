const multer = require('multer'),
	upload = multer({
		storage: multer.memoryStorage(),
		limits: { fileSize: 3145728 },
		fileFilter(req, file, cb) {
			if (!['png', 'jpg', 'jpeg'].includes(file.mimetype.replace('image/', '')))
				return cb('Invalid file type');
			return cb(null, true);
		}
	}).single('image'),
	sharp = require('sharp'),
	shortid = require('shortid'),
	md5 = require('md5'),
	RateLimiter = require('../../../structures/RateLimiter');

class ImagesPOST {
	constructor(controller, settings) {
		this.path = '/images';
		this.router = controller.router;
		this.database = controller.database;
		this.authorize = controller.authorize;
		this.webhookTransport = controller.webhookTransport;

		this.allowImageUploads = settings.allowImageUploads;
		this.imageSaveQuality = settings.imageSaveQuality;
		this.thumbnailSaveQuality = settings.thumbnailSaveQuality;
		this.imageMaxWidth = settings.imageMaxWidth;
		this.imageMaxHeight = settings.imageMaxHeight;

		this.rateLimiter = new RateLimiter({ max: 2 }); // 2/10 limit

		this.router.post(
			this.path,
			this.rateLimiter.limit.bind(this.rateLimiter),
			this.authorize.bind(this),
			this.run.bind(this)
		);
	}

	async run(req, res) {
		if (!this.allowImageUploads && !req.user.roles.includes('admin')) {
			this.rateLimiter.unlimit(req, res);
			return res.status(403).send({ message: "Image uploads not allowed" });
		}

		upload(req, res, async error => {
			if (error)
				return res.status(400).send({ message: error });

			if (!req.user.verified)
				return res.status(403).send({ message: 'You must have a verified account to post images' });

			if (req.body.tags) {
				if (!Array.isArray(req.body.tags)) {
					if (typeof req.body.tags !== 'string')
						return res.status(400).send({ message: 'Tags must be a string of tags or an array of strings' });

					req.body.tags = req.body.tags
						.replace(/( *,[ ,]*(\r|\n)*|\r+|\n+)/g, '') // Remove extra spacing
						.replace(/_+/g, ' ') // Replace with spaces
						.replace(/(^,|,(?:,+|$))/g, '') // Remove extra empty tags
						.toLowerCase()
						.split(',');
				} else {
					req.body.tags = req.body.tags
						.filter(t => typeof t === 'string') // Filter non-strings
						.map(t => t.replace(/, *|_+| {2,}/g, ' ').toLowerCase()) // Replace extra spacing and remove commas
						.filter(t => t !== '' && t.trim() !== ''); // Remove empty tags
				}

				if (req.body.tags.length > 80)
					return res.status(400).send({ message: "A post can only have up to 80 tags" });

				if (req.body.tags.find(t => t.length > 50))
					return res.status(400).send({ message: "Tags have a maximum length of 50 characters" });

				// Remove duplicates and sort alphabetically
				req.body.tags = [...new Set(req.body.tags)].sort((a, b) => a.localeCompare(b));
			}

			if (req.body.artist) {
				req.body.artist = req.body.artist.replace(/_/g, ' ');

				if (req.body.artist.length > 60)
					return res.status(400).send({ message: "The artist field has a maximum length of 60 characters" });

				if (req.body.artist.toLowerCase() === 'unknown')
					req.body.artist = undefined;
			}

			if (!req.file || !req.body)
				return res.status(400).send({ message: "No image and/or form attached" });

			let originalHash = md5(req.file.buffer);

			// Check if it's a duplicate
			let existing = await this.database.Image.findOne({ originalHash });
			if (existing)
				return res.status(409).send({ message: "Image already uploaded", id: existing.id });

			let filename = shortid.generate();

			await sharp(req.file.buffer)
				.resize(360, 420)
				.max()
				.withoutEnlargement()
				.background({ r: 255, g: 255, b: 255, alpha: 1 })
				.flatten()
				.jpeg({ quality: this.thumbnailSaveQuality })
				.toFile(`${__dirname}/../../../thumbnail/${filename}.jpg`);

			return sharp(req.file.buffer)
				.resize(this.imageMaxWidth, this.imageMaxHeight)
				.max()
				.withoutEnlargement()
				.background({ r: 255, g: 255, b: 255, alpha: 1 })
				.flatten()
				.jpeg({ quality: this.imageSaveQuality })
				.toFile(`${__dirname}/../../../image/${filename}.jpg`)
				.then(async () => {
					let image = await this.database.PendingImage.create({
						id: filename,
						originalHash,
						uploader: {
							id: req.user.id,
							username: req.user.username
						},
						nsfw: !!req.body.nsfw,
						artist: req.body.artist || undefined,
						tags: req.body.tags ? req.body.tags : []
					});

					this.webhookTransport.executeDiscordWebhook('onUpload', {
						embeds: [{
							title: 'New Post Pending Approval',
							url: 'https://nekos.moe/post/' + image.id,
							color: 9874412,
							timestamp: new Date().toISOString(),
							image: {
								url: 'https://nekos.moe/image/' + image.id,
							},
							fields: [{
								name: 'Uploader',
								value: image.uploader.username,
								inline: true
							}, {
								name: 'Artist',
								value: image.artist || 'Unknown',
								inline: true
							}, {
								name: 'Tags',
								value: image.tags.join(', ')
							}]
						}]
					});

					return res.status(201).location(`/image/${filename}.jpg`).send({
						image: {
							id: image.id,
							createdAt: image.createdAt,
							uploader: image.uploader,
							tags: image.tags,
							artist: image.artist,
							nsfw: image.nsfw
						},
						image_url: `https://nekos.brussell.me/image/${filename}.jpg`,
						post_url: `https://nekos.brussell.me/post/${filename}`
					});
				}).catch(error => {
					console.error(error);
					return res.status(500).send({ message: 'Error saving image' });
				});
		});
	}
}

module.exports = ImagesPOST;
