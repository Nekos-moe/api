const Mongoose = require('mongoose'),
	Schema = Mongoose.Schema;

Mongoose.Promise = global.Promise;

const userSchema = new Schema({
	uuid: String,
	email: { type: String, maxlength: 70, trim: true },
	password: { type: String, maxlength: 70 },
	username: { type: String, maxlength: 35, trim: true },
	token: String,
	verified: { type: Boolean, default: false },
	roles: [{ type: String, enum: ['admin', 'moderator'] }],
	uploads: { type: Number, default: 0 },
	likes: [String],
	favorites: [String],
	likesReceived: { type: Number, default: 0 },
	favoritesReceived: { type: Number, default: 0 },
	createdAt: { type: Date, default: Date.now }
});
const unverifiedUserSchema = new Schema({
	email: String,
	key: String
});

const imageSchema = new Schema({
	id: String,
	uploader: { type: String, required: true },
	nsfw: { type: Boolean, default: false },
	tags: String,
	createdAt: { type: Date, default: Date.now },
	artist: String,
	likes: { type: Number, default: 0 },
	favorites: { type: Number, default: 0 },
	comments: [{
		user: String,
		text: String
	}]
});

class Database {
	constructor(settings) {
		this.db = Mongoose.createConnection(`mongodb://localhost:${settings.port}/${settings.db}`, {
			user: settings.user,
			pass: settings.pass,
			auth: { authdb: 'admin' }
		});
		this.User = this.db.model('User', userSchema);
		this.UnverifiedUser = this.db.model('UnverifiedUser', unverifiedUserSchema);
		this.Image = this.db.model('Image', imageSchema);

		this.db.on('error', console.error.bind(console, 'Mongoose error:'));
		this.db.on('open', () => console.log('Mongoose Connected'));
	}
}

module.exports = Database;
