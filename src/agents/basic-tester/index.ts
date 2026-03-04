import { z } from "zod";
import { defineAgent } from "../../shared/agent-creator";
import { defineTool, MCPResponse } from "../../shared/types";
import { test } from "./pcl-parsing";

async function calculate(
	operation: "add" | "subtract" | "multiply" | "divide",
	a: number,
	b: number,
): MCPResponse<"text"> {
	let result: number;
	switch (operation) {
		case "add":
			result = a + b;
			break;
		case "subtract":
			result = a - b;
			break;
		case "multiply":
			result = a * b;
			break;
		case "divide":
			if (b === 0)
				return {
					content: [
						{
							type: "text",
							text: "Error: Cannot divide by zero",
						},
					],
				};
			result = a / b;
			break;
	}
	return { content: [{ type: "text", text: String(result) }] };
}

const { AgentClass: BasicTester, metadata } = defineAgent({
	name: "Basic Tester",
	version: "1.0.0",
	binding: "basic",
	url_prefix: "/basic-tester",
	tools: [
		defineTool({
			name: "queryLibCal",
			inputSchema: {},
			function: async ({}) => {
				const data = await test();
				return {
					content: [{ type: "text", text: data }],
				};
			},
		}),
		defineTool({
			name: "add",
			inputSchema: { a: z.number(), b: z.number() },
			function: async ({ a, b }) => ({
				content: [{ type: "text", text: String(a + b) }],
			}),
		}),
		defineTool({
			name: "subtract",
			inputSchema: { a: z.number(), b: z.number() },
			function: async ({ a, b }) => ({
				content: [{ type: "text", text: String(a - b) }],
			}),
		}),
		defineTool({
			name: "calculate",
			inputSchema: {
				operation: z.enum(["add", "subtract", "multiply", "divide"]),
				a: z.number(),
				b: z.number(),
			},
			function: ({ operation, a, b }) => calculate(operation, a, b),
		}),
	],
});

export { BasicTester, metadata };

// // import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
// // import { McpAgent } from "agents/mcp";
// // import { z } from "zod";
// // import { test } from "./pcl-parsing";

// // export class BasicTester extends McpAgent {
// // 	server = new McpServer({
// // 		name: "Basic Tester",
// // 		version: "1.0.0",
// // 	});

// // 	async init() {
// // 		// Simple addition tool
// // 	this.server.registerTool(
// // 		"queryLibCal",
// // 		{
// // 			description: "queryLibCal",
// // 			inputSchema: {},
// // 		},
// // 		async () => {
// // 			const data = await test();
// // 			return {
// // 				content: [{ type: "text", text: JSON.stringify(data) }],
// // 			};
// // 		},
// // 	);

// // 	this.server.registerTool(
// // 		"add",
// // 		{
// // 			description: "add",
// // 			inputSchema: { a: z.number(), b: z.number() },
// // 		},
// // 		async ({ a, b }) => ({
// // 			content: [{ type: "text", text: String(a + b) }],
// // 		}),
// // 	);

// // 	this.server.registerTool(
// // 		"add",
// // 		{
// // 			description: "add",
// // 			inputSchema: { a: z.number(), b: z.number() },
// // 		},
// // 		async ({ a, b }) => ({
// // 			content: [{ type: "text", text: String(a + b) }],
// // 		}),
// // 	);

// // 	// Calculator tool with multiple operations
// // 	this.server.registerTool(
// // 		"calculate",
// // 		{
// // 			description: "calculate",
// // 			inputSchema: {
// // 				operation: z.enum(["add", "subtract", "multiply", "divide"]),
// // 				a: z.number(),
// // 				b: z.number(),
// // 			},
// // 		},
// // 		async ({ operation, a, b }) => {
// // 			let result: number;
// // 			switch (operation) {
// // 				case "add":
// // 					result = a + b;
// // 					break;
// // 				case "subtract":
// // 					result = a - b;
// // 					break;
// // 				case "multiply":
// // 					result = a * b;
// // 					break;
// // 				case "divide":
// // 					if (b === 0)
// // 						return {
// // 							content: [
// // 								{
// // 									type: "text",
// // 									text: "Error: Cannot divide by zero",
// // 								},
// // 							],
// // 						};
// // 					result = a / b;
// // 					break;
// // 			}
// // 			return { content: [{ type: "text", text: String(result) }] };
// // 		},
// // 	);
// // }
// // }

// // export const metadata = {
// // 	title: "Basic Tester",
// // 	version: "1.0.0",
// // 	binding: "basic",
// // 	url_prefix: "/basic-tester",
// // 	server: BasicTester,
// // };
