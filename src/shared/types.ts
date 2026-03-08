import type { ToolCallback } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { AnySchema, ZodRawShapeCompat } from "@modelcontextprotocol/sdk/server/zod-compat.js";
import type { ToolAnnotations } from "@modelcontextprotocol/sdk/types.js";
import { McpAgent } from "agents/mcp";

export type Version = `${number}.${number}.${number}`;

export type MCPResponseType = "text" | "audio" | "image" | "recourse" | "recourse_link";

/**
 * The type for a MCP response. Useful for external tool functions that return a complete response.
 *
 * @param T - The type of the response. Can be "text", "audio", "image", "recourse", or "recourse_link".
 * @returns A Promise that resolves to a MCP response object
 */
export type MCPResponse<T extends MCPResponseType> = Promise<{
	content: { type: T; text: string }[];
}>;

/**
 * The type for an agent metadata object.
 *
 * @param title - The title of the agent to display in the mcp server
 * @param version - The version of the agent
 * @param url_prefix - The URL prefix to use on the mcp server for the agent
 * @param binding - The durable object binding for the agent used in the worker
 * @param server - The actual mcp agent for calling .serve()
 */
export type AgentMetadata = {
	title: string;
	version: string;
	url_prefix: string;
	binding: string;
	server: typeof McpAgent;
};

/**
 * The type for a tool definition.
 *
 * @param OutputArgs - The output schema for the tool
 * @param InputArgs - The input schema for the tool
 * @returns A RegisterToolDefinition object
 */
export type RegisterToolDefinition<
	OutputArgs extends ZodRawShapeCompat | AnySchema,
	InputArgs extends undefined | ZodRawShapeCompat | AnySchema = undefined,
> = {
	name: string;
	config: {
		title?: string;
		description?: string;
		inputSchema?: InputArgs;
		outputSchema?: OutputArgs;
		annotations?: ToolAnnotations;
		_meta?: Record<string, unknown>;
	};
	cb: ToolCallback<InputArgs>;
};

// Same as RegisterToolDefinition, but with a function instead of a callback for nicer typing
export type RegisterToolDefinitionFunction<
	OutputArgs extends ZodRawShapeCompat | AnySchema,
	InputArgs extends undefined | ZodRawShapeCompat | AnySchema = undefined,
> = {
	name: string;
	title?: string;
	description?: string;
	inputSchema?: InputArgs;
	outputSchema?: OutputArgs;
	annotations?: ToolAnnotations;
	_meta?: Record<string, unknown>;
	function: ToolCallback<InputArgs>;
};
