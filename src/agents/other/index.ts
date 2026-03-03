import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { McpAgent } from "agents/mcp";

// export class OtherServer extends McpAgentWrapper {
// 	title = "Other Server";
// 	version = "1.0.0";
// 	binding = "MCP_OBJECT";
// 	url_prefix = "/other";
// 	tools = [];

// 	// server = new McpServer({
// 	// 	name: "Other Server",
// 	// 	version: "1.0.0",
// 	// });

// 	// async init() {
// 	// 	// Simple addition tool
// 	// 	this.server.tool("foo", {}, async () => {
// 	// 		return {
// 	// 			content: [{ type: "text", text: "foo" }],
// 	// 		};
// 	// 	});
// 	// }
// }

export class OtherServer extends McpAgent {
	// title = "Other Server";
	// version = "1.0.0";
	// binding = "MCP_OBJECT";
	// url_prefix = "/other";
	// tools = [];

	server = new McpServer({
		name: "Other Server",
		version: "1.0.0",
	});

	async init() {
		// Simple addition tool
		this.server.tool("foo", {}, async () => {
			return {
				content: [{ type: "text", text: "foo" }],
			};
		});
	}
}

export const metadata = {
	title: "Other Server",
	version: "1.0.0",
	binding: "MCP_OBJECT",
	url_prefix: "/other",
	server: OtherServer,
};
