const bcrypt = require('bcrypt'),
	nJwt = require('njwt'),
	nodemailer = require('nodemailer'),
	uuid = require('uuid'),
	fs = require('fs'),
	emailHTML = fs.readFileSync(__dirname + '/assets/verify.html').toString(),
	fileType = require('file-type'),
	multer = require('multer'),
	upload = multer({ storage: multer.memoryStorage() }),
	jimp = require('jimp'),
	shortid = require('shortid');

const HASH_ROUNDS = 10;

class APIv1 {
	constructor(settings, database) {
		this.database = database;
		this.router = require('express').Router();
		this.path = '/api/v1';
		this.emailFrom = settings.email.from;
		this.settings = settings

		this.transporter = nodemailer.createTransport({
			name: 'no-repy',
			tls: { rejectUnauthorized: false }
		});

		this.router.get('/', (req, res) => {
			return res.status(200).send({
				code: 200,
				message: 'Future home of the Catgirls API.'
			});
		});

		this.router.post('/register', async (req, res) => {
			// Reject bad body
			if (!req.body || !req.body.username || !req.body.email || !req.body.password)
				return res.status(400).send({
					code: 400,
					message: "Email, username, and password are required"
				});

			if (req.body.email.length > 70 || req.body.password.length > 70 || req.body.username.length > 35)
				return res.status(400).send({
					code: 400,
					messsage: 'Please limit your email address and password to 70 characters, and your username to 35 characters.'
				});

			// Password requirements
			if (req.body.password.length < 8 || !/[a-z]/.test(req.body.password) || !/[A-Z]/.test(req.body.password) || !/[0-9]/.test(req.body.password))
				return res.status(400).send({
					code: 400,
					messsage: 'Your password must be at least 8 characters, have uppercase and lowercase alphabetical letters, and contain numbers.'
				});

			let existingUser = await this.database.User.findOne({ $or: [{ username: req.body.username }, { email: req.body.email }] });
			if (existingUser)
				return res.status(409).send({
					code: 409,
					messsage: existingUser.username === req.body.username
						? 'Please choose another username. "' + req.body.username + '" is already taken.'
						: 'There is already an account created using that email.'
				});

			let hashedPassword = await bcrypt.hash(req.body.password, HASH_ROUNDS),
				UUID = uuid(); // Create user id

			// Create a token for the user
			let claims = { iss: UUID },
				jwt = nJwt.create(claims, req.app.locals.jwt_signingkey);
			jwt.setExpiration(); // Never expires
			let token = jwt.compact();

			// Create new User
			this.database.User.create({
				uuid: UUID,
				username: req.body.username,
				email: req.body.email,
				password: hashedPassword,
				token
			}, error => {
				if (error)
					console.error(error);
			});

			// Create unverified user for email verification
			let unverifiedUser = await this.database.UnverifiedUser.create({
				email: req.body.email,
				key: UUID.replace(/-/g, '')
			});

			// Send verification email
			this.transporter.sendMail({
				from: `"Catgirls" <${this.emailFrom}>`,
				to: unverifiedUser.email,
				subject: 'Verify your email for neko.brussell.me',
				text: 'Follow this link to verify your email address: https://neko.brussell.me/register/verify/' + unverifiedUser.key,
				html: emailHTML.replace('VERIFY_KEY', unverifiedUser.key)
			}, error => {
				if (error)
					return res.status(500).send({
						code: 500,
						messsage: 'Error sending verification email: ' + error.message
					});
				res.send({
					code: 200,
					messsage: 'An email has been sent to the provided email with a link to verify your account.'
				});
			});
		});

		this.router.get('/register/verify/:key', async (req, res) => {
			// Find the user being verified
			let unverifiedUser = await this.database.UnverifiedUser.findOne({ key: req.params.key });

			// No matching account found
			if (!unverifiedUser)
				return res.status(409).send({
					code: 409,
					message: 'Invalid key. Either the account has already been validated or the key was misspelled'
				});

			let user = await this.database.User.findOne({ email: unverifiedUser.email });

			// Mark user as verified and save user. Then delete the unverified user doc
			user.verified = true;
			try {
				await user.save();
				await unverifiedUser.remove();
			} catch (e) {
				return res.status(500).send({
					code: 500,
					message: e.toString()
				});
			}

			return res.send({
				code: 200,
				message: 'Your account has been verified'
			})
		});

		this.router.post('/register/resend', async (req, res) => {
			if (!req.body || !req.body.email)
				return res.status(400).send({
					code: 400,
					message: "Email required"
				});

			let unverifiedUser = await this.database.UnverifiedUser.findOne({ key: req.body.email });

			// No matching account found
			if (!unverifiedUser)
				return res.status(409).send({
					code: 409,
					message: 'This account has already been verified'
				});

			// Send verification email
			this.transporter.sendMail({
				from: `"Catgirls" <${this.emailFrom}>`,
				to: unverifiedUser.email,
				subject: 'Verify your email for neko.brussell.me',
				text: 'Follow this link to verify your email address: https://neko.brussell.me/register/verify/' + unverifiedUser.key,
				html: emailHTML.replace('VERIFY_KEY', unverifiedUser.key)
			}, error => {
				if (error)
					return res.status(500).send({
						code: 500,
						messsage: 'Error sending verification email: ' + error.message
					});
				res.send({
					code: 200,
					messsage: 'An email has been sent to the provided email with a link to verify your account.'
				});
			});
		});

		this.router.post('/auth', async (req, res) => {
			if (!req.body || !req.body.username || !req.body.password)
				return res.status(401).send({
					code: 401,
					message: "Username, and password are required"
				});

			let user = await this.database.User.findOne({ username: req.body.username });

			if (user && !user.verified)
				return res.status(400).send({
					code: 400,
					message: "You must verify your email before you can view your token."
				});

			// Check if the passwords match
			let correctCredentials = user ? await bcrypt.compare(req.body.password, user.password) : false;

			if (!correctCredentials)
				return res.status(400).send({
					code: 400,
					message: "Incorrect username or password"
				});

			return res.status(200).send({
				code: 200,
				message: "Authenticated",
				token: user.token
			});
		});

		this.router.post('/auth/regen', (req, res, next) => this.authorize(req, res, next), async (req, res) => {
			// Generate new token
			let UUID = uuid();
			let claims = { iss: UUID },
				jwt = nJwt.create(claims, req.app.locals.jwt_signingkey);
			jwt.setExpiration(); // Never expires
			let token = jwt.compact();

			req.user.uuid = UUID;
			req.user.token = token;
			await req.user.save();

			return res.status(200).send({
				code: 200,
				message: "A new token has been generated. You will need to re-authenticate to make further requests."
			});
		});

		this.router.post('/images', (req, res, next) => this.authorize(req, res, next), upload.single('image'), async (req, res) => {
			if (!req.file || !req.body)
				return res.status(400).send({
					code: 400,
					message: "No image and/or body attached"
				});

			let fileExtension = fileType(req.file.buffer);

			if (!['png', 'jpg', 'jpeg'].includes(fileExtension.ext))
				return res.status(400).send({
					code: 400,
					message: "Image must have type PNG, JPG, or JPEG"
				});

			if (req.file.size > 2097152)
				return res.status(400).send({
					code: 400,
					message: "Image size must be below 2MB"
				});

			if (req.body.tags && req.body.tags.split(/ *, */).find(t => t.length > 20))
				return res.status(400).send({
					code: 400,
					message: "Tags have a maximum length of 20 characters"
				});

			if (req.body.artist && req.body.artist.length > 30)
				return res.status(400).send({
					code: 400,
					message: "The artist field has a maximum length of 30 characters"
				});

			let filename = shortid.generate();

			// Compress if above 512000
			jimp.read(req.file.buffer).then(image => {
				// If image is large scale down by 25%
				if (image.bitmap.width > 2000 || image.bitmap.height > 2000)
					image.resize(image.bitmap.width * .75, jimp.AUTO, jimp.RESIZE_BICUBIC);

				// Save as JPG with quality of 85. This saves a ton of space and is usually unnoticable
				image.quality(85).write(`${__dirname}/../image/${filename}.jpg`, async () => {
					await this.database.Image.create({
						id: filename,
						uploader: req.user.username,
						nsfw: !!req.body.nsfw,
						artist: req.body.artist || undefined,
						tags: req.body.tags || '',
						comments: []
					});

					return res.status(201).send({
						code: 201,
						message: 'Image uploaded',
						image_url: `https://neko.brussell.me/image/${filename}.jpg`,
						post_url: `https://neko.brussell.me/post/${filename}`
					});
				});
			}).catch(error => {
				console.error(error);
				return res.status(500).send({
					code: 500,
					message: 'Error saving image',
					error: error.message
				});
			});
		});
	}

	async authorize(req, res, next) {
		if (!req.headers.authorization)
			return res.status(400).send({
				code: 400,
				message: "Authentication required"
			});

		let nJwtVerified = false;

		try {
			nJwtVerified = nJwt.verify(req.headers.authorization, req.app.locals.jwt_signingkey);
		} catch(e) {
			return res.status(401).send({
				code: 401,
				message: "Invalid token",
				error: e
			});
		}

		req.user = await this.database.User.findOne({ token: req.headers.authorization });

		if (!req.headers.authorization || !nJwtVerified || !req.user)
			return res.status(401).send({
				code: 401,
				message: "Invalid token"
			});

		return next();
	}
}

module.exports = APIv1;
