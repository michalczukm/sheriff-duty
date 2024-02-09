import { Context } from './context';
import { OperationResult, failureResult, successResult } from './result';

type SheriffDutyAccess = {
	get: () => Promise<OperationResult<SheriffDuty>>;
	put: (value: SheriffDuty) => Promise<SheriffDuty>;
	delete: () => Promise<void>;
};

type SheriffDuty = {
	current: {
		userId: string;
		started: Date;
	};
};

const buildKey = (teamId: string) => `${teamId}_sheriff`;

export const sheriffDutyStorage = (ctx: Context): SheriffDutyAccess => ({
	get: async () => {
		const sheriffDuty = await ctx.env.SHERIFF_DUTY.get<SheriffDuty>(buildKey(ctx.teamId), { type: 'json' });
		return sheriffDuty ? successResult(sheriffDuty) : failureResult([{ code: 'sheriff_not_found' }]);
	},
	put: async (value: SheriffDuty) => {
		await ctx.env.SHERIFF_DUTY.put(buildKey(ctx.teamId), JSON.stringify(value));
		return value;
	},
	delete: () => ctx.env.SHERIFF_DUTY.delete(buildKey(ctx.teamId)),
});
