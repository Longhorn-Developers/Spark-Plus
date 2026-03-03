import { McpAgent } from "agents/mcp";
import {
	BasicTester,
	metadata as basicTesterMetadata,
} from "./agents/basic-tester";
import { OtherServer, metadata as otherMetadata } from "./agents/other";

// const AGENTS = [OtherServer, BasicTester];
const AGENTS = [basicTesterMetadata, otherMetadata] as {
	title: string;
	version: string;
	url_prefix: string;
	binding: string;
	server: typeof McpAgent;
}[];

export default {
	fetch(request: Request, env: Env, ctx: ExecutionContext) {
		const url = new URL(request.url);

		for (const agent of AGENTS) {
			console.log("prefix: ", agent.url_prefix);
			if (url.pathname === agent.url_prefix) {
				return agent.server
					.serve(agent.url_prefix, { binding: agent.binding })
					.fetch(request, env, ctx);
			}
		}

		return new Response("Not found!!", { status: 404 });
	},
};

export { BasicTester, OtherServer };
