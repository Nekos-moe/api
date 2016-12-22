const express = require('express'),
	app = express(),
	bodyParser = require('body-parser'),
	morgan = require('morgan'),
	toml = require('toml'),
	fs = require('fs'),
	settings = toml.parse(fs.readFileSync('./settings.toml')),
	Database = require('./structures/Database'),
	db = new Database(settings.mongo);

app.set('trust proxy', 'loopback');
app.set('env', 'production');
app.disable('x-powered-by');

app.locals.jwt_signingkey = fs.readFileSync(__dirname + '/jwt_signingkey.key');

app.use(morgan(':req[cf-connecting-ip] :method :url :status :response-time[0]ms', {
	skip: (req, res) => res.statusCode < 400 // Only log errors
}));
// Parse data into req.body
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Load in the routes for express
fs.readdir('./routes/', (error, files) => {
	if (error)
		throw error;
	for (const file of files) {
		if (!file.endsWith('.js')) // Ignore if not a js file
			continue;

		let route = new (require('./routes/' + file))(settings, db);
		app.use(route.path, route.router);
	}
});

// Start the express server
app.listen(settings.port, error => {
	if (error)
		return console.log(error)
	console.log('Server online');
});
