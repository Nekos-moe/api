const fileType = require('file-type'),
	multer = require('multer'),
	upload = multer({ storage: multer.memoryStorage() }),
	sharp = require('sharp'),
	shortid = require('shortid'),
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
			upload.single('image'),
			this.run.bind(this)
		);
	}

	async run(req, res) {
		if (!req.file || !req.body)
			return res.status(400).send({ message: "No image and/or body attached" });

		let fileExtension = fileType(req.file.buffer);

		if (!['png', 'jpg', 'jpeg'].includes(fileExtension.ext))
			return res.status(400).send({ message: "Image must have type PNG, JPG, or JPEG" });

		if (req.file.size > 3145728)
			return res.status(400).send({ message: "Image size must be below 3MB" });

		if (req.body.tags) {
			// Remove spaces
			req.body.tags = req.body.tags.replace(/ *, */g, ',');

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
				await this.database.Image.create({
					id: filename,
					uploader: req.user.username,
					nsfw: !!req.body.nsfw,
					artist: req.body.artist || undefined,
					tags: req.body.tags || '',
					comments: []
				});

				req.user.uploads = req.user.uploads + 1;
				await req.user.save();

				return res.status(201).location(`/image/${filename}.jpg`).send({
					image_url: `https://nekos.brussell.me/image/${filename}.jpg`,
					post_url: `https://nekos.brussell.me/post/${filename}`
				});
			}).catch(error => {
				console.error(error);
				return res.status(500).send({ message: 'Error saving image' });
			});
	}
}

module.exports = ImagesPOST;
