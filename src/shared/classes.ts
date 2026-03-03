import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ToolCall } from "./types";

interface CORSOptions {
	origin?: string;
	methods?: string;
	headers?: string;
	maxAge?: number;
	exposeHeaders?: string;
}

type BaseTransportType = "sse" | "streamable-http";

interface ServeOptions {
	binding?: string;
	corsOptions?: CORSOptions;
	transport?: BaseTransportType;
	jurisdiction?: DurableObjectJurisdiction;
}

export abstract class McpAgentWrapper {
	static title: string;
	static binding: string;
	static url_prefix: string;
	static version?: string;
	static tools: ToolCall[];

	server = new McpServer({
		name: "Basic Tester",
		version: "1.0.0",
	});

	async init() {
		// this.server.tool("foo", {}, async () => {
		// 	return {
		// 		content: [{ type: "text", text: "foo" }],
		// 	};
		// });
		for (const tool of McpAgentWrapper.tools) {
			this.server.tool(tool.name, tool.parameters, tool.func);
		}
	}
}
