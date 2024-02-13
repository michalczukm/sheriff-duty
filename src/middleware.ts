import { IRequest, error } from 'itty-router';

const encoder = new TextEncoder();
const decoder = new TextDecoder('utf8');

const bufferToHex = (buffer: ArrayBuffer) =>
	Array.from(new Uint8Array(buffer))
		.map((b) => b.toString(16).padStart(2, '0'))
		.join('');

const getBodyContent = async (request: IRequest) => {
	const reader = request.clone().body?.getReader();

	if (!reader) {
		return '';
	}

	let requestBody = '';
	let done = false;
	while (!done) {
		const result = await reader.read();
		done = result.done;
		requestBody += decoder.decode(result.value);
	}

	return requestBody;
};

// More about slack requests verification https://api.slack.com/authentication/verifying-requests-from-slack#making
export const verifySlackRequest = async (request: IRequest, env: Env) => {
	// HMAC is in hex format
	const hmac = request.headers.get('x-slack-signature')?.match(/^v0=(?<hmac>.*)$/)?.groups?.['hmac'];
	const timestamp = request.headers.get('x-slack-request-timestamp');

	// protect against replay attacks
	// check if the timestamp is recent (within 5 minutes)
	if (!hmac || !timestamp || +timestamp >= new Date().getTime() - 5 * 60_000) {
		console.log(`Request is not recent, possible replay attack. Request.timestamp=${timestamp}`);
		return error(403);
	}

	const secretKeyData = encoder.encode(env.SLACK_SIGNING_SECRET);

	const key = await crypto.subtle.importKey('raw', secretKeyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['verify', 'sign']);

	const body = await getBodyContent(request);
	const dataToAuthenticate = `v0:${timestamp}:${body}`;

	const signed = await crypto.subtle.sign('HMAC', key, encoder.encode(dataToAuthenticate));

	/**
	 * We cannot use crypto.subtle.verify here because crypto.subtle.verify assumes pre-imported key:
	 * This method operates on previously imported or generated keys,
	 * whereas Slack verification involves calculating the signature directly from the message and secret without key management.
	 */
	const verified = bufferToHex(signed) === hmac;

	if (!verified) {
		console.log(`Request not verified. HMAC=${hmac}`);
		return error(403);
	}
	return undefined;
};
