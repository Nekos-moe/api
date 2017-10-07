const RateLimiter = require('../../../structures/RateLimiter'),
	VALID_ROLES = ['admin', 'approver', 'reviewReports', 'editPosts'];

class UserRolesPATCH {
	constructor(controller) {
		this.path = '/user/:id/roles';
		this.router = controller.router;
		this.database = controller.database;
		this.authorize = controller.authorize;

		this.rateLimiter = new RateLimiter({ max: 10 }); // 10/10 limit

		this.router.patch(
			this.path,
			this.rateLimiter.limit.bind(this.rateLimiter),
			this.authorize.bind(this),
			this.run.bind(this)
		);
	}

	async run(req, res) {
		if (!req.user.roles || !req.user.roles.includes('admin'))
			return res.status(403).send({ message: 'You do not have permission to grant or revoke roles' });

		if (!VALID_ROLES.includes(req.body.role))
			return res.status(400).send({ message: 'Invalid role' });

		if (req.body.action === 'grant') {
			await this.database.User.update({ id: req.params.id }, { $addToSet: { roles: req.body.role } }, { runValidators: true });
			return res.status(200).send({ message: `Granted role "${req.body.role}"` });
		} else if (req.body.action === 'revoke') {
			await this.database.User.update({ id: req.params.id }, { $pull: { roles: req.body.role } }, { runValidators: true });
			return res.status(200).send({ message: `Revoked role "${req.body.role}"` });
		}

		return res.status(400).send({ message: 'Invalid action' });
	}
}

module.exports = UserRolesPATCH;
