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
	constructor(controller) {
		this.path = '/images';
		this.router = controller.router;
		this.database = controller.database;
		this.authorize = controller.authorize;

		this.rateLimiter = new RateLimiter({ max: 2 }); // 2/10 limit

		this.router.post(
			this.path,
			this.rateLimiter.limit.bind(this.rateLimiter),
			this.authorize.bind(this),
			this.run.bind(this)
		);
	}

	async run(req, res) {
		upload(req, res, async error => {
			if (error)
				return res.status(400).send({ message: error });

			if (!req.file || !req.body)
				return res.status(400).send({ message: "No image and/or form attached" });

			let originalHash = md5(req.file.buffer);

			// Check if it's a duplicate
			let existing = await this.database.Image.findOne({ originalHash });
			if (existing)
				return res.status(409).send({ message: "Image already uploaded", id: existing.id });

			if (req.body.tags) {
				req.body.tags = req.body.tags.replace(/ *, */g, ','); // Remove spaces around commas

				if (req.body.tags.split(',').find(t => t.length > 30))
					return res.status(400).send({ message: "Tags have a maximum length of 30 characters" });
			}

			if (req.body.artist && req.body.artist.length > 30)
				return res.status(400).send({ message: "The artist field has a maximum length of 30 characters" });

			let filename = shortid.generate();

			return sharp(req.file.buffer)
				.resize(2000, 2000)
				.max()
				.withoutEnlargement()
				.jpeg({ quality: 90 })
				.toFile(`${__dirname}/../../../image/${filename}.jpg`)
				.then(async () => {
					let image = await this.database.Image.create({
						id: filename,
						originalHash,
						uploader: {
							id: req.user.id,
							username: req.user.username
						},
						nsfw: !!req.body.nsfw,
						artist: req.body.artist || undefined,
						tags: req.body.tags || '',
						comments: []
					});

					req.user.uploads = req.user.uploads + 1;
					await req.user.save();

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
