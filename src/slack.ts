import { Context } from './context';
import { OperationResult, failureResult, successResult } from './result';
import { sheriffDutyStorage } from './storage';

type SlackEventCallback = {
	type: 'app_mention';
	channel: string;
	text: string;
	user: string;
	thread_ts?: string;
};

export type SlackEvent = {
	team_id: string;
} & (
	| {
			type: 'url_verification';
			challenge: string;
	  }
	| {
			type: 'event_callback';
			event: SlackEventCallback;
	  }
);

async function slackWebApi(ctx: Context, method: 'chat.postMessage', body: object) {
	await fetch(`https://slack.com/api/${method}`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json; charset=utf-8',
			Authorization: `Bearer ${ctx.env.SLACK_BOT_OAUTH_TOKEN}`,
		},
		body: JSON.stringify(body),
	});
}

const USER_REGEX = /\<@(?<user_id>\w*)\|(?<username>\w*)>$/;

const setSheriffUser = async (ctx: Context, command: string) => {
	const match = command.match(USER_REGEX);
	if (!match) {
		return failureResult();
	}

	const userId = match.groups?.['user_id'];

	if (!userId) {
		return successResult({
			text: 'Cannot find user! Please use the format `/sheriff @user`.',
		});
	}

	await sheriffDutyStorage(ctx).put({
		current: {
			userId,
			started: new Date(),
		},
	});

	return successResult({
		text: `Duty change! <@${userId}> is now a sheriff 🔱 around here!`,
		response_type: 'in_channel',
	});
};

const eventCallback = async (ctx: Context, event: SlackEventCallback): Promise<OperationResult> => {
	switch (event.type) {
		case 'app_mention':
			try {
				const sheriffResult = await sheriffDutyStorage(ctx).get();

				if (sheriffResult.status === 'failure') {
					await slackWebApi(ctx, 'chat.postMessage', {
						channel: event.channel,
						icon_emoji: ':trident:',
						text: 'There is no sheriff around here! Set one using `/sheriff @user` command.',
						username: 'sheriff-bot',
						thread_ts: event.thread_ts,
					});
					return successResult({});
				}

				const currentSheriff = sheriffResult.data.current;

				await slackWebApi(ctx, 'chat.postMessage', {
					channel: event.channel,
					icon_emoji: ':trident:',
					text: `Hey <@${currentSheriff.userId}>, looks like you are a 🔱 sheriff around here!`,
					username: 'sheriff-bot',
					thread_ts: event.thread_ts,
				});

				return successResult({});
			} catch (error) {
				return failureResult([{ code: 'slack_error' }], error);
			}
		default:
			return successResult({});
	}
};

export const dispatchCommand = (ctx: Context, command: string) => {
	return setSheriffUser(ctx, command);
};

export const dispatchEvent = async (ctx: Context, event: SlackEvent): Promise<OperationResult> => {
	switch (event.type) {
		case 'url_verification':
			return successResult({ challenge: event.challenge });
		case 'event_callback':
			return eventCallback(ctx, event.event);
		default:
			return successResult({});
	}
};
