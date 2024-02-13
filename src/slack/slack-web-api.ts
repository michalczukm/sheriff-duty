import { Context } from '../context';
import { OperationResult, failureResult, successResult } from '../result';

type SlackWebApiResult<TData> =
	| ({ ok: true } & TData)
	| {
			ok: false;
			error: string;
	  };

type SlackWebApi = {
	'auth.test': {
		body: {};
		response: { url: string; user_id: string; user: string; team_id: string; team: string };
	};
	'chat.postMessage': {
		body: { channel: string; text: string; icon_emoji: string; username: string; thread_ts?: string };
		response: { ts: string };
	};
};

async function callApi<TMethod extends keyof SlackWebApi>(
	ctx: Context,
	method: TMethod,
	body: SlackWebApi[TMethod]['body']
): Promise<SlackWebApiResult<SlackWebApi[TMethod]['response']>> {
	return await fetch(`https://slack.com/api/${method}`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json; charset=utf-8',
			Authorization: `Bearer ${ctx.env.SLACK_BOT_OAUTH_TOKEN}`,
		},
		body: JSON.stringify(body),
	}).then((response) => response.json());
}

const postMessage = async (ctx: Context, { channel, text, thread }: { channel: string; text: string; thread?: string }) => {
	await callApi(ctx, 'chat.postMessage', {
		channel,
		icon_emoji: ':trident:',
		text,
		username: 'sheriff-bot',
		thread_ts: thread,
	});
};

const selfIdentity = async (ctx: Context): Promise<OperationResult<SlackWebApi['auth.test']['response']>> => {
	const response = await callApi(ctx, 'auth.test', {});

	return response.ok ? successResult(response) : failureResult([{ code: response.error }]);
};

export const slackWebApi = {
	postMessage,
	selfIdentity,
};
