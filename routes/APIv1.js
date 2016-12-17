var express = require('express');
var router = express.Router();

router.get('/', (req, res) => {
	res.status(200).send({
		code: 200,
		message: 'Future home of the Catgirls API.'
	});
});

module.exports = {
	router,
	path: '/api/v1'
}
