import { Context } from './context';
import { OperationResult, failureResult, successResult } from './result';
import { sheriffDutyStorage } from './storage';

type SlackEventCallback = {
	type: 'app_mention';
	channel: string;
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

const USER_REGEX = /\<@(?<user_id>\w*)\|(?<username>\w*)>$/;

const setSheriffUser = async ({ env, teamId }: Context, command: string) => {
	const match = command.match(USER_REGEX);
	if (!match) {
		return failureResult();
	}

	const userId = match.groups?.['user_id'];

	if (!userId) {
		return failureResult();
	}

	await env.SHERIFF_DUTY.put(`${teamId}_sheriff`, userId);

	return successResult({
		text: `Ok! <@${userId}> is now a sheriff 🪪 around here!`,
	});
};

const eventCallback = async (ctx: Context, event: SlackEventCallback): Promise<OperationResult> => {
	switch (event.type) {
		case 'app_mention':
			try {
				const sheriffUserId = await sheriffDutyStorage(ctx).get();
				await fetch('https://slack.com/api/chat.postMessage', {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json; charset=utf-8',
						Authorization: `Bearer ${ctx.env.SLACK_BOT_OAUTH_TOKEN}`,
					},
					body: JSON.stringify({
						channel: event.channel,
						icon_emoji: ':robot_face:',
						text: `Hey <@${sheriffUserId}>, looks like you are a sheriff 🪪 around here!`,
						username: 'sheriff-bot',
					}),
				});

				return successResult({});
			} catch (error) {
				return failureResult([{ code: 'slack_error' }]);
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
