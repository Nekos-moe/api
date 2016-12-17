const express = require('express'),
	app = express(),
	bodyParser = require('body-parser'),
	morgan = require('morgan'),
	session = require('express-session'),
	Mongoose = require('mongoose'),
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
	settings = toml.parse(fs.readFileSync('./settings.toml'));

Mongoose.connect(`mongodb://${settings.mongo.user}:${settings.mongo.pass}@localhost:${settings.mongo.port}/${settings.mongo.db}`);
Mongoose.Promise = global.Promise;
Mongoose.connection.on('error', console.error.bind(console, 'Mongoose error:'));
Mongoose.connection.once('open', () => console.log('Mongoose Connected'));

app.set('trust proxy', 'loopback');
app.set('env', 'production');
app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');
app.disable('x-powered-by');

app.use(morgan(':req[cf-connecting-ip] :method :url :status :response-time[0]ms', {
	skip: (req, res) => res.statusCode < 400
}));
app.use(session({
	secret: settings.sessionSecret,
	cookie: {
		maxAge: 1000 * 60 * 60 * 24 * 3 // 3 days
	},
	resave: false,
	saveUninitialized: false,
	store: new MongoStore({
		mongooseConnection: Mongoose.connection,
		stringify: false
	})
}));
// This is where we would serve static files but nginx does that for us.
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

fs.readdir('./routes/').then(files => {
	for (const file of files) {
		if (!file.endsWith('.js'))
			continue;

		let route = require('./routes/' + file);
		app.use(route.path, route.router);
	}
});
