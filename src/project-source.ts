import { BasicTester, basicTesterData } from "./servers/basic-tester/main";
import {
	GrantsResearchServer,
	grantsResearchData,
} from "./servers/grants-research/main";
import { OtherServer, otherData } from "./servers/other/main";

import { McpServerMetadata } from "./shared/general-types";

// + ------------------------------------------------------------------------------------------------ +
// |   An array of all the active MCP servers. To add a new MCP server, add the metadata to this array.   |
// + ------------------------------------------------------------------------------------------------ +
const MCP_SERVERS = [
	basicTesterData,
	otherData,
	grantsResearchData,
] as McpServerMetadata[];

export default {
	fetch(request: Request, env: Env, ctx: ExecutionContext) {
		const url = new URL(request.url);

		for (const mcpServer of MCP_SERVERS) {
			if (url.pathname === mcpServer.url_prefix) {
				return mcpServer.server
					.serve(mcpServer.url_prefix, { binding: mcpServer.binding })
					.fetch(request, env, ctx);
			}
		}

		return new Response("Not found!!", { status: 404 });
	},
};

// + ------------------------------------------------------------- +
// |   NOTE: Update this with all the MCP servers' class exports   |
// + ------------------------------------------------------------- +
export { BasicTester, OtherServer, GrantsResearchServer }; // Required for cloudflare behind the scenes functionality.
