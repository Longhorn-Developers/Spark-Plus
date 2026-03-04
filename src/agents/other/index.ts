import { z } from "zod";
import { defineAgent } from "../../shared/agent-creator";
import { defineTool } from "../../shared/types";

const { AgentClass: OtherServer, metadata } = defineAgent({
	name: "Other Server",
	version: "1.0.0",
	binding: "other",
	url_prefix: "/other",
	tools: [
		defineTool({
			name: "foo",
			inputSchema: { name: z.number() },
			function: async ({ name }) => ({
				content: [{ type: "text", text: name.toExponential().toString() }],
			}),
		}),
		defineTool({
			name: "Capitalize",
			inputSchema: { name: z.string() },
			function: async ({ name }) => ({
				content: [{ type: "text", text: name.toUpperCase() }],
			}),
		}),
	],
});

export { metadata, OtherServer };
