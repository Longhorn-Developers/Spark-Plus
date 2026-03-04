import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { McpAgent } from "agents/mcp";
import { z } from "zod";
import { test } from "./pcl-parsing";

// export class BasicTester extends McpAgentWrapper {
// 	binding = "RANDOM";
// 	url_prefix = "/basic-tester";
// 	title = "Basic Tester";
// 	version = "1.0.0";
// 	tools = [];

// 	// server = new McpServer({
// 	// 	name: "Basic Tester",
// 	// 	version: "1.0.0",
// 	// });

// 	// async init() {
// 	// 	// Simple addition tool
// 	// 	this.server.tool("queryLibCal", {}, async () => {
// 	// 		const data = await test();
// 	// 		return {
// 	// 			content: [{ type: "text", text: JSON.stringify(data) }],
// 	// 		};
// 	// 	});

// 	// 	this.server.tool(
// 	// 		"add",
// 	// 		{ a: z.number(), b: z.number() },
// 	// 		async ({ a, b }) => ({
// 	// 			content: [{ type: "text", text: String(a + b) }],
// 	// 		}),
// 	// 	);

// 	// 	// Calculator tool with multiple operations
// 	// 	this.server.tool(
// 	// 		"calculate",
// 	// 		{
// 	// 			operation: z.enum(["add", "subtract", "multiply", "divide"]),
// 	// 			a: z.number(),
// 	// 			b: z.number(),
// 	// 		},
// 	// 		async ({ operation, a, b }) => {
// 	// 			let result: number;
// 	// 			switch (operation) {
// 	// 				case "add":
// 	// 					result = a + b;
// 	// 					break;
// 	// 				case "subtract":
// 	// 					result = a - b;
// 	// 					break;
// 	// 				case "multiply":
// 	// 					result = a * b;
// 	// 					break;
// 	// 				case "divide":
// 	// 					if (b === 0)
// 	// 						return {
// 	// 							content: [
// 	// 								{
// 	// 									type: "text",
// 	// 									text: "Error: Cannot divide by zero",
// 	// 								},
// 	// 							],
// 	// 						};
// 	// 					result = a / b;
// 	// 					break;
// 	// 			}
// 	// 			return { content: [{ type: "text", text: String(result) }] };
// 	// 		},
// 	// 	);
// 	// }
// }

export class BasicTester extends McpAgent {
	// binding = "RANDOM";
	// url_prefix = "/basic-tester";
	// title = "Basic Tester";
	// version = "1.0.0";
	// tools = [];

	server = new McpServer({
		name: "Basic Tester",
		version: "1.0.0",
	});

	async init() {
		// Simple addition tool
		this.server.tool("queryLibCal", {}, async () => {
			const data = await test();
			return {
				content: [{ type: "text", text: JSON.stringify(data) }],
			};
		});

		this.server.tool(
			"add",
			{ a: z.number(), b: z.number() },
			async ({ a, b }) => ({
				content: [{ type: "text", text: String(a + b) }],
			}),
		);

		// Calculator tool with multiple operations
		this.server.tool(
			"calculate",
			{
				operation: z.enum(["add", "subtract", "multiply", "divide"]),
				a: z.number(),
				b: z.number(),
			},
			async ({ operation, a, b }) => {
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
			},
		);
	}
}

export const metadata = {
	title: "Basic Tester",
	version: "1.0.0",
	binding: "basic",
	url_prefix: "/basic-tester",
	server: BasicTester,
};
