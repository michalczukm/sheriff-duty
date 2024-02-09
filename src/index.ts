import apiRouter from './router';

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		const url = new URL(request.url);

		if (url.pathname.startsWith('/api/')) {
			return apiRouter.handle(request, env, ctx);
		}

		return new Response(`<h1>👋 Sheriff duty slack app</hi>`, { headers: { 'Content-Type': 'text/html' } });
	},
};
