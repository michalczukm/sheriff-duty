import { Router } from 'itty-router';

const router = Router();

// TODO: add slack requests verification using https://api.slack.com/authentication/verifying-requests-from-slack#making
router.post('/api/events', async (request, env: Env) => {
	console.log('here!', new Date().toISOString());
	const content = await request.json();

	if (content.type == 'url_verification' && content?.challenge) {
		return new Response(content.challenge);
	}
	switch (content.event.type) {
		case 'app_mention':
			const sheriffUserId = await env.SHERIFF_DUTY.get(`${content['team_id']}_sheriff`);

			await fetch('https://slack.com/api/chat.postMessage', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json; charset=utf-8',
					Authorization: `Bearer ${env.SLACK_BOT_OAUTH_TOKEN}`,
				},
				body: JSON.stringify({
					channel: content.event.channel,
					icon_emoji: ':robot_face:',
					text: `Hey <@${sheriffUserId}>, looks like you are a sheriff 🪪 around here!`,
					username: 'sheriff-bot',
				}),
			});
			break;
		default:
			break;
	}

	return new Response('', { status: 200 });
});

const USER_REGEX = /\<@(?<user_id>\w*)\|(?<username>\w*)>$/;
const make400Response = () =>
	new Response(
		JSON.stringify({
			response_type: 'in_channel',
			text: `Please provide a user to search for.`,
		}),
		{ headers: { 'Content-type': 'application/json' }, status: 400 }
	);

router.post('/api/interactions', async (request, env: Env) => {
	const content = await request.formData();
	const textParam = content.get('text');
	const teamId = content.get('team_id');

	if (!textParam || typeof textParam !== 'string' || !teamId || typeof teamId !== 'string') {
		return make400Response();
	}

	const match = textParam.match(USER_REGEX);
	if (!match) {
		return make400Response();
	}

	const userId = match.groups?.['user_id'];

	if (!userId) {
		return make400Response();
	}

	await env.SHERIFF_DUTY.put(`${teamId}_sheriff`, userId);

	return new Response(
		JSON.stringify({
			response_type: 'in_channel',
			text: `Ok! <@${userId}> is now a sheriff 🪪 around here!`,
		}),
		{ headers: { 'Content-type': 'application/json' } }
	);
});

// 404 for everything else
router.all('*', () => new Response('Not Found.', { status: 404 }));

export default router;
