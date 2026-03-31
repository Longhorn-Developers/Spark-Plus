import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
	AnySchema,
	ZodRawShapeCompat,
} from "@modelcontextprotocol/sdk/server/zod-compat.js";
import { McpAgent } from "agents/mcp";
import type {
	McpServerMetadata,
	RegisterToolDefinition,
	RegisterToolDefinitionFunction,
	Version,
} from "./general-types";

/**
 * All the things required for a MCP server. Tools holds all the real functionality of the MCP server.
 */
type McpConfig = {
	name: string;
	version: Version;
	binding: string;
	url_prefix: string;
	tools: RegisterToolDefinition<any, any>[]; // eslint-disable-line @typescript-eslint/no-explicit-any
};

/**
 * Creates a wrapper around `McpAgent` that defines a protocol with a server and tools.
 *
 * Notes
 * -----
 * The returned class is always named `McpServerClass`. Cloudflare requires MCP servers to
 * have unique exported names, so when destructuring the result you should rename
 * the class to something descriptive.
 *
 * Example:
 * ```ts
 * const { McpServerClass: MyMcpServer, metadata } = createMcpServer(config);
 * ```
 *
 * @param config Configuration for the protocol.
 * Includes:
 * - `name` – MCP server name
 * - `version` – MCP server version
 * - `binding` – Cloudflare binding
 * - `url_prefix` – MCP server route prefix
 * - `tools` – array of tools created with `defineTool`
 *
 * @returns Object containing:
 * - `McpServerClass` – the generated MCP server class
 * - `metadata` – associated metadata for the MCP server
 */
export function defineMcpServer(config: McpConfig) {
	const McpServerClass = class extends McpAgent {
		server = new McpServer({
			name: config.name,
			version: config.version,
		});

		async init() {
			for (const tool of config.tools) {
				// Bind callbacks so tools can access the agent runtime (`this`) when needed.
				this.server.registerTool(tool.name, tool.config, tool.cb.bind(this));
			}
		}
	};

	const metadata: McpServerMetadata = {
		title: config.name,
		version: config.version,
		binding: config.binding,
		url_prefix: config.url_prefix,
		server: McpServerClass as unknown as typeof McpAgent,
	};

	return { McpServerClass, metadata };
}

/**
 * Helper for defining MCP tools with improved type inference.
 *
 * This function wraps a `RegisterToolDefinitionFunction` and converts it into a
 * `RegisterToolDefinition`. It preserves strong typing for the tool's input and
 * output schemas while normalizing the structure expected by the MCP runtime.
 *
 * In particular, it:
 * - Infers input/output argument types from the provided schemas
 * - Maps the tool definition fields into the `{ name, config, cb }` format
 * - Returns a correctly typed `RegisterToolDefinition` suitable for MCP server registration
 *
 * @param def Tool definition describing the tool's metadata, schemas, and handler.
 *
 * @returns A normalized `RegisterToolDefinition` object suitable for MCP server registration
 */
export function defineTool<
	OutputArgs extends ZodRawShapeCompat | AnySchema,
	InputArgs extends undefined | ZodRawShapeCompat | AnySchema = undefined,
>(def: RegisterToolDefinitionFunction<OutputArgs, InputArgs>) {
	return {
		name: def.name,
		config: {
			title: def.title,
			description: def.description,
			inputSchema: def.inputSchema,
			outputSchema: def.outputSchema,
			annotations: def.annotations,
			_meta: def._meta,
		},
		cb: def.function,
	} as RegisterToolDefinition<OutputArgs, InputArgs>;
}
