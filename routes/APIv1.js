const bcrypt = require('bcrypt'),
	nJwt = require('njwt'),
	nodemailer = require('nodemailer'),
	uuid = require('uuid'),
	fs = require('fs'),
	emailHTML = fs.readFileSync(__dirname + '/assets/verify.html');

const HASH_ROUNDS = 10;

class APIv1 {
	constructor(settings, database) {
		this.database = database;
		this.router = require('express').Router();
		this.path = '/api/v1';
		this.emailFrom = settings.email.from;

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
				from: `"Catgirls" <${settings.emailUser}>`,
				to: unverifiedUser.email,
				subject: 'Verify your email for nekos.brussell.me',
				text: 'Follow this link to verify your email address: https://nekos.brussell.me/verify/' + unverifiedUser.key,
				html: emailHTML.replace('VERIFY_KEY', unverifiedUser.key)
			}, error => {
				if (error)
					console.error(error);
			});

			return res.send({
				code: 200,
				messsage: 'An email has been sent to the provided email with a link to verify your account.'
			});
		});
	}
}

module.exports = APIv1;
