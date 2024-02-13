import { Router, error, json } from 'itty-router';
import { dispatchCommand, dispatchEvent, type SlackCommand, type SlackEvent } from './slack';
import { verifySlackRequest } from './middleware';

const router = Router();

router.all('*', verifySlackRequest);

router.post('/api/events', async (request, env: Env) => {
	const content = await request.json<SlackEvent>();

	if (!content) {
		return error(400, "Missing content");
	}

	const response = await dispatchEvent({ env, teamId: content.team_id }, content);
	return response.status === 'success' ? json(response.data) : error(400, response.errors);
});

router.post('/api/commands', async (request, env: Env) => {
	const content = await request.formData();
	const command = Object.fromEntries(content.entries()) as SlackCommand
	const teamId = command.team_id

	const response = await dispatchCommand({ env, teamId }, command);
	return response.status === 'success' ? json(response.data) : error(400, response.errors);
});

router.all('*', () => error(404, 'Not Found.'));

export default router;
