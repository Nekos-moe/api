const express = require('express'),
	app = express(),
	bodyParser = require('body-parser'),
	morgan = require('morgan'),
	session = require('express-session'),
	MongoStore = require('connect-mongo')(session),
	// multer = require('multer'),
	// upload = multer({
	// 	storage: multer.memoryStorage(),
	// 	limits: {
	// 		files: 1,
	// 		fileSize: 5242880
	// 	}
	// }),
	toml = require('toml'),
	fs = require('fs'),
	settings = toml.parse(fs.readFileSync('./settings.toml')),
	Database = require('./structures/Database'),
	db = new Database(settings.mongo);

app.set('trust proxy', 'loopback');
app.set('env', 'production');
app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');
app.disable('x-powered-by');

app.locals.jwt_signingkey = fs.readFileSync(__dirname + '/jwt_signingkey.key');

app.use(morgan(':req[cf-connecting-ip] :method :url :status :response-time[0]ms', {
	skip: (req, res) => res.statusCode < 400 // Only log errors
}));
app.use(session({
	secret: settings.sessionSecret,
	cookie: {
		maxAge: 1000 * 60 * 60 * 24 * 3, // 3 days
		secure: true
	},
	resave: false,
	saveUninitialized: false,
	store: new MongoStore({
		mongooseConnection: db.db,
		stringify: false
	})
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
