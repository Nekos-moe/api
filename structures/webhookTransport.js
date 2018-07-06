const axios = require('axios');
let webhookUrls = { };

function config(webhooks) {
	webhookUrls = webhooks;
}

function executeDiscordWebhook(type, data) {
	if (!webhookUrls.discord[type])
		return;

	return axios.post(webhookUrls.discord[type], data, {
		headers: { 'User-Agent': 'Nekos.moe API (https://github.com/brussell98/catgirls-api)' }
	}).catch(error => {
		console.error('Error executing Discord webhook:', error.response || error);
	});
}

module.exports = { config, executeDiscordWebhook };
