import { McpAgent } from "agents/mcp";
import { McpAgentWrapper } from "./classes";

export type AgentWrapperCreator = new (...args: any[]) => McpAgentWrapper;

export type AgentCreator = new (...args: any[]) => McpAgent;
export type AgentMetadata = {
	title: string;
	version: string;
	binding: string;
	url_prefix: string;
	server: typeof McpAgent;
};
export type McpAgentServerStatic = {
	serve(prefix: string, options: { binding: string }): { fetch: typeof fetch };
};
export type ToolCall = {
	name: string;
	parameters: Record<string, any>;
	func<T extends any>(...args: any[]): Promise<T>;
};
