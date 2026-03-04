// shared/classes.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { McpAgent } from "agents/mcp";
import type { AgentMetadata, RegisterToolDefinition } from "./types";

// All the things required for an agent. Tools holds all the real functionality of the agent.
type AgentConfig = {
	name: string;
	version: string;
	binding: string;
	url_prefix: string;
	tools: RegisterToolDefinition<any, any>[];
};

/**
 * A simple wrapper around the McpAgent class to create a new agent class with a server and tools.
 * NOTE: The name of the agent is always "AgentClass" by default, but cloudflare requires all agents
 * have special names so when you destructure the results, rename that argument to something more descriptive.
 *
 * @param config - The configuration for the agent
 * @returns An AgentClass and it's associated metadata object. Use this to export the agent and metadata from the agent file.
 */
export function defineAgent(config: AgentConfig) {
	const AgentClass = class extends McpAgent {
		server = new McpServer({
			name: config.name,
			version: config.version,
		});

		async init() {
			for (const tool of config.tools) {
				this.server.registerTool(tool.name, tool.config, tool.cb);
			}
		}
	};

	const metadata: AgentMetadata = {
		title: config.name,
		version: config.version,
		binding: config.binding,
		url_prefix: config.url_prefix,
		server: AgentClass as unknown as typeof McpAgent,
	};

	return { AgentClass, metadata };
}
