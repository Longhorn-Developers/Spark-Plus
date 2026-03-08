import { z } from "zod";
import { defineAgent, defineTool } from "../../shared/agent-creator";

async function getQuote(page: number) {
	const response = await fetch(
		`https://gutenberg.org/cache/epub/1342/pg1342.txt`,
	);
	const text = await response.text();
	const lines = text.split("\n");
	return lines[page];
}

export const { AgentClass: OtherServer, metadata } = defineAgent({
	name: "Other Server",
	version: "1.0.0",
	binding: "other",
	url_prefix: "/other",
	tools: [
		defineTool({
			name: "randomNumber",
			inputSchema: { range: z.number().min(0).max(100) },
			function: async ({ range }) => ({
				content: [
					{ type: "text", text: Math.floor(Math.random() * range).toString() },
				],
			}),
		}),
		defineTool({
			name: "getQuote",
			inputSchema: { page: z.number() },
			function: async ({ page }) => ({
				content: [{ type: "text", text: await getQuote(page) }],
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
