import {
	BasicTester,
	metadata as basicTesterMetadata,
} from "./agents/basic-tester";
import { OtherServer, metadata as otherMetadata } from "./agents/other";
import { AgentMetadata } from "./shared/types";
export { BasicTester, OtherServer }; // Required for cloudflare behind the scenes functionality.

// An array of all the active agents. To add a new agent, add the metadata to this array.
const AGENTS = [basicTesterMetadata, otherMetadata] as AgentMetadata[];
export default {
	fetch(request: Request, env: Env, ctx: ExecutionContext) {
		const url = new URL(request.url);

		for (const agent of AGENTS) {
			if (url.pathname === agent.url_prefix) {
				return agent.server
					.serve(agent.url_prefix, { binding: agent.binding })
					.fetch(request, env, ctx);
			}
		}

		return new Response("Not found!!", { status: 404 });
	},
};
