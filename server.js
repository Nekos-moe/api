const express = require('express');
const app = express();
const morgan = require('morgan');
const toml = require('toml');
const fs = require('fs');
const settings = toml.parse(fs.readFileSync('./settings.toml'));
const Database = require('./structures/Database');
const mailTransport = require('./structures/mailTransport');
const webhookTransport = require('./structures/webhookTransport');
const db = new Database(settings.mongo);
const sentry = require('@sentry/node');
const hotShots = require('hot-shots');

mailTransport.config({ from: settings.email.from, test: settings.email.test });
webhookTransport.config(settings.webhooks);

if (process.env.NODE_ENV === 'production') {
	sentry.init({
		dsn: settings.raven.url,
		release: (require('./package.json')).version,
		attachStacktrace: true,
		maxBreadcrumbs: 50,
		beforeSend(event) {
			return process.env.NODE_ENV === 'production' ? event : null;
		},
		defaultIntegrations: [
			new sentry.Integrations.Console(),
			new sentry.Integrations.Http({
				breadcrumbs: true,
				tracing: false
			}),
			new sentry.Integrations.OnUncaughtException(),
			new sentry.Integrations.OnUnhandledRejection()
		]
	});

	app.use(sentry.Handlers.requestHandler());

	new hotShots({
		host: settings.statsd.host,
		port: settings.statsd.port,
		globalize: true,
		cacheDNS: true,
		errorHandler(error) {
			console.error('[hot-shots]', error);
			sentry.captureException(error);
		}
	});

	var datadog = require('connect-datadog')({
		dogstatsd: statsd,
		tags: ['app:catgirls-api'],
		response_code: true,
		path: true,
		method: true
	});

	app.use(datadog);
} else {
	global.statsd = new Proxy({ }, {
		get() { return function() { } }
	});
}

app.set('trust proxy', 'loopback');
app.set('env', 'production');
app.disable('x-powered-by');

app.use(morgan(':req[cf-connecting-ip] :method :url :status :response-time[0]ms', {
	skip: (req, res) => res.statusCode < 400 // Only log failed requests/responses
}));
// Parse data into req.body
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// In dev we need a way to get images
if (process.env.NODE_ENV === 'development') {
	app.use('/image', express.static('image', { index: false, extensions: ['jpg'] }));
	app.use('/thumbnail', express.static('thumbnail', { index: false, extensions: ['jpg'] }));
}

app.use((req, res, next) => {
	res.set('Access-Control-Allow-Origin', '*');
	res.set('Access-Control-Allow-Credentials', 'true');
	res.set('Access-Control-Allow-Methods', 'GET,OPTIONS,POST,PUT,PATCH,DELETE');
	res.set('Access-Control-Allow-Headers', 'Access-Control-Allow-Headers, Origin, Accept, X-Requested-With, Content-Type, Access-Control-Request-Method, Access-Control-Request-Headers, Authorization');
	return next();
});

// Load in the routes for express
let apiv1 = new (require('./api/v1/Router.js'))(settings, db, mailTransport, webhookTransport);
app.use(apiv1.path, apiv1.router);

if (process.env.NODE_ENV === 'production')
	app.use(sentry.Handlers.errorHandler());

// Start the express server
app.listen(settings.port, error => {
	if (error)
		return console.log(error);

	console.log('Server online');
});
