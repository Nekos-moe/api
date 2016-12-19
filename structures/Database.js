const Mongoose = require('mongoose'),
	Schema = Mongoose.Schema;

Mongoose.Promise = global.Promise;

const userSchema = new Schema({
	uuid: String,
	email: { type: String, maxlength: 70 },
	password: { type: String, maxlength: 70 },
	username: { type: String, maxlength: 35 },
	token: String
});
const unverifiedUserSchema = new Schema({
	email: String,
	key: String
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

		this.db.on('error', console.error.bind(console, 'Mongoose error:'));
		this.db.on('open', () => console.log('Mongoose Connected'));
	}
}

module.exports = Database;
