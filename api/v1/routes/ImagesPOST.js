const fileType = require('file-type'),
	multer = require('multer'),
	upload = multer({ storage: multer.memoryStorage() }),
	jimp = require('jimp'),
	shortid = require('shortid'),
	fs = require('fs'),
	RateLimiter = require('../../../structures/RateLimiter');

class ImagesPOST {
	constructor(controller) {
		this.path = '/images';
		this.router = controller.router;
		this.database = controller.database;
		this.authorize = controller.authorize;

		this.rateLimiter = new RateLimiter({ max: 2 }); // 2/10 limit because compression is expensive

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

		if (req.file.size > 2097152)
			return res.status(400).send({ message: "Image size must be below 2MB" });

		if (req.body.tags) {
			// Remove spaces
			req.body.tags = req.body.tags.replace(/ *, */g, ',');

			if (req.body.tags.split(',').find(t => t.length > 30))
				return res.status(400).send({ message: "Tags have a maximum length of 30 characters" });
		}

		if (req.body.artist && req.body.artist.length > 30)
			return res.status(400).send({ message: "The artist field has a maximum length of 30 characters" });

		let filename = shortid.generate();

		let fn = async () => {
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
		}

		if (req.file.size <= 409600 && fileExtension.ext === 'jpg')
			return fs.writeFile(`${__dirname}/../../../image/${filename}.jpg`, req.file.buffer, fn);

		return jimp.read(req.file.buffer).then(image => {
			if (req.file.size > 409600) {
				// If image is large scale down by 25%
				if (image.bitmap.width > 2000 || image.bitmap.height > 2000)
					image.resize(image.bitmap.width * .75, jimp.AUTO, jimp.RESIZE_BICUBIC);

				// Save as JPG with quality of 90. This saves a ton of space and is usually unnoticable
				image.quality(90);
			}

			return image.write(`${__dirname}/../../../image/${filename}.jpg`, fn);
		}).catch(error => {
			console.error(error);
			return res.status(500).send({
				message: 'Error saving image'//,
				//error: error.message
			});
		});
	}
}

module.exports = ImagesPOST;
