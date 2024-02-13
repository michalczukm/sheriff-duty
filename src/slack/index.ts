import { Context } from '../context';
import { OperationResult, failureResult, successResult } from '../result';
import { slackWebApi } from './slack-web-api';
import { sheriffDutyStorage } from '../storage';
import { match, P } from 'ts-pattern';

export type SlackCommand = {
	command: '/sheriff-duty';
	team_id: string;
	team_domain: string;
	channel_id: string;
	channel_name: string;
	user_id: string;
	user_name: string;
	text: string;
	response_url: string;
};

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

const USER_REGEX = /\<@(?<user_id>\w*)\|(?<username>\w*)>$/;

const setSheriffUser = async (ctx: Context, command: SlackCommand) => {
	// TODO: move command `/sheriff` from response texts to a constant
	const match = command.text.match(USER_REGEX);
	const userId = match?.groups?.['user_id'];

	if (!userId) {
		return successResult({
			text: 'Please provide a user handler who will be next sheriff! Example: `/sheriff @user.`',
		});
	}

	const identity = await slackWebApi.selfIdentity(ctx);

	if (identity.status === 'failure') {
		return failureResult(identity.errors);
	}

	if (userId === identity.data.user_id) {
		return successResult({
			text: `I'm sorry, <@${userId}>, but you cannot be a sheriff and a bot at the same time. 😅`,
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

const removeSheriffUser = async (ctx: Context, _: SlackCommand) => {
	await sheriffDutyStorage(ctx).delete();

	return successResult({
		text: 'Sheriff duty has been removed! Who will be our hero 😱?',
		response_type: 'in_channel',
	});
};

const handleAppMention = async (ctx: Context, event: SlackEventCallback) => {
	try {
		const sheriffResult = await sheriffDutyStorage(ctx).get();

		if (sheriffResult.status === 'failure') {
			await slackWebApi.postMessage(ctx, {
				channel: event.channel,
				text: 'There is no sheriff around here! Set one using `/sheriff @user` command.',
				thread: event.thread_ts,
			});
			return successResult({});
		}

		const currentSheriff = sheriffResult.data.current;

		await slackWebApi.postMessage(ctx, {
			channel: event.channel,
			text: `Hey <@${currentSheriff.userId}>, looks like you are a 🔱 sheriff around here!`,
			thread: event.thread_ts,
		});

		return successResult({});
	} catch (error) {
		return failureResult([{ code: 'slack_error' }], error);
	}
};

const eventCallback = async (ctx: Context, event: SlackEventCallback): Promise<OperationResult> => {
	return match(event)
		.with({ type: 'app_mention' }, (event) => handleAppMention(ctx, event))
		.otherwise(() => successResult({}));
};

export const dispatchCommand = async (ctx: Context, slackCommand: SlackCommand): Promise<OperationResult> => {
	if (slackCommand.command !== '/sheriff-duty') {
		return successResult({
			response_type: 'ephemeral',
			text: `Whops, I don't know how to handle this command: "${slackCommand.command}"!`,
		});
	}

	return await match(slackCommand.text)
		.with('remove', () => removeSheriffUser(ctx, slackCommand))
		.with(P.string.regex(USER_REGEX), () => setSheriffUser(ctx, slackCommand))
		.otherwise(() => successResult({ text: "I don't understand this command. Please use `/sheriff @user` or `/sheriff remove`." }));
};

export const dispatchEvent = async (ctx: Context, event: SlackEvent): Promise<OperationResult> => {
	return match(event)
		.with({ type: 'url_verification' }, (event) => successResult({ challenge: event.challenge }))
		.with({ type: 'event_callback' }, (event) => eventCallback(ctx, event.event))
		.otherwise(() => successResult({}));
};
