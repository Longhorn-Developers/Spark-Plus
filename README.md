# Building a Remote MCP Server on Cloudflare (Without Auth)

This example allows you to deploy a remote MCP server that doesn't require authentication on Cloudflare Workers.

## Get started:

[Deploy to Workers](https://deploy.workers.cloudflare.com/?url=https://github.com/cloudflare/ai/tree/main/demos/remote-mcp-authless)

This will deploy your MCP server to a URL like: `remote-mcp-server-authless.<your-account>.workers.dev/sse`

Alternatively, you can use the command line below to get the remote MCP Server created on your local machine:

```bash
npm create cloudflare@latest -- my-mcp-server --template=cloudflare/ai/demos/remote-mcp-authless
```

## Customizing your MCP Server

To add your own [tools](https://developers.cloudflare.com/agents/model-context-protocol/tools/) to the MCP server, define each tool inside the `init()` method of `src/index.ts` using `this.server.tool(...)`.

## Test with MCP Inspector (local)

This server uses **Streamable HTTP** at `/mcp`, not stdio. In the Inspector:

1. Run `npm run dev` so the Worker is at `http://localhost:8787` (or the port Wrangler prints).
2. Run `npx @modelcontextprotocol/inspector@latest` and open the URL it prints.
3. In the Inspector, choose **"Enter URL"** (or equivalent) — do **not** use "Run command (stdio)".
4. Enter `http://localhost:8787/mcp` and click Connect, then List tools.

Using "Run command" / stdio will fail with a 500 because this server is HTTP-only.

## Connect to Cloudflare AI Playground

You can connect to your MCP server from the Cloudflare AI Playground, which is a remote MCP client:

1. Go to [https://playground.ai.cloudflare.com/](https://playground.ai.cloudflare.com/)
2. Enter your deployed MCP server URL (`remote-mcp-server-authless.<your-account>.workers.dev/sse`)
3. You can now use your MCP tools directly from the playground!

## Connect Claude Desktop to your MCP server

You can also connect to your remote MCP server from local MCP clients, by using the [mcp-remote proxy](https://www.npmjs.com/package/mcp-remote).

To connect to your MCP server from Claude Desktop, follow [Anthropic's Quickstart](https://modelcontextprotocol.io/quickstart/user) and within Claude Desktop go to Settings > Developer > Edit Config.

Update with this configuration:

```json
{
	"mcpServers": {
		"calculator": {
			"command": "npx",
			"args": [
				"mcp-remote",
				"http://localhost:8787/sse" // or remote-mcp-server-authless.your-account.workers.dev/sse
			]
		}
	}
}
```

Restart Claude and you should see the tools become available.
