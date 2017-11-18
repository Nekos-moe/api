const isDev = process.env.NODE_ENV !== 'production';
const nodemailer = require('nodemailer'),
	fs = require('fs'),
	emails = {
		welcome: fs.readFileSync(__dirname + '/../assets/welcome.html').toString()
	},
	transport = !isDev
		? nodemailer.createTransport({
			name: 'no-reply',
			port: 25,
			tls: { rejectUnauthorized: false }
		})
		: null;

let from;

function config(settings) {
	from = settings.from;

	if (isDev && settings.test) {
		nodemailer.createTransport({
			host: 'smtp.ethereal.email',
			port: 587,
			secure: false,
			auth: {
				user: settings.test.user,
				pass: settings.test.pass
			}
		});
	}
}

function sendMail(options) {
	return new Promise((resolve, reject) => {
		options.from = options.from || `"Catgirls" <${from}>`;

		return transport.sendMail(options, (error, info) => {
			if (error)
				return reject(error);

			if (isDev)
				console.log('Email sent, view at: ', nodemailer.getTestMessageUrl(info));

			return resolve(info);
		});
	});
}

function sendHTMLMail(template, options, values) {
	return new Promise((resolve, reject) => {
		options.from = options.from || `"Catgirls" <${from}>`;
		options.html = emails[template].replace(/{{(\w+?)}}/g, (match, key) => values[key]);

		return transport.sendMail(options, (error, info) => {
			if (error)
				return reject(error);

			if (isDev)
				console.log('Email sent, view at: ', nodemailer.getTestMessageUrl(info));

			return resolve(info);
		});
	});
}

module.exports = { config, sendMail, sendHTMLMail };
