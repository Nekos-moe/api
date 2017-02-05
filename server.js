const express = require('express'),
	app = express(),
	bodyParser = require('body-parser'),
	morgan = require('morgan'),
	toml = require('toml'),
	fs = require('fs'),
	settings = toml.parse(fs.readFileSync('./settings.toml')),
	Database = require('./structures/Database'),
	mailTransport = require('./structures/mailTransport'),
	db = new Database(settings.mongo),
	raven = require('raven');

mailTransport.config({ from: settings.email.from });

if (process.env.NODE_ENV === 'production') {
	raven.disableConsoleAlerts();
	raven.config(settings.raven.url, {
		release: (require('./package.json')).version,
		autoBreadcrumbs: { 'http': true },
		captureUnhandledRejections: true
	}).install();
}

app.set('trust proxy', 'loopback');
app.set('env', 'production');
app.disable('x-powered-by');

app.locals.jwt_signingkey = fs.readFileSync(__dirname + '/jwt_signingkey.key');

app.use(raven.requestHandler());
app.use(raven.errorHandler());
app.use(morgan(':req[cf-connecting-ip] :method :url :status :response-time[0]ms', {
	skip: (req, res) => res.statusCode < 400 // Only log failed requests/responses
}));
// Parse data into req.body
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Load in the routes for express
let apiv1 = new (require('./api/v1/Router.js'))(settings, db, mailTransport);
app.use(apiv1.path, apiv1.router);

// Start the express server
app.listen(settings.port, error => {
	if (error)
		return console.log(error)
	console.log('Server online');
});
