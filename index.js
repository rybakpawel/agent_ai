import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
// import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
// import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";

console.log("B-Zone Agent");

// Definicja serwera MCP
const mcpServer = new McpServer({
  name: "B-Zone Agent",
  description: "Server for handling B-Zone System tasks",
  version: "1.0.0",
});

// Rejestracja narzędzia
mcpServer.registerTool(
  "createPurchaseInitiativeV15",
  {
    title: "Create purchase initiative",
    description: "Create a new purchasing initiative with provided name.",
    inputSchema: { name: z.string() },
  },
  async ({ name }) => {
    const res = await fetch(
      `https://skillandchill-dev.outsystemsenterprise.com/PR_Sandbox_BZONE/rest/AgentAI/CreateRequest?name=${name}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      }
    );

    const data = await res.json();

    return {
      content: [{ type: "text", text: data.message }],
    };
  }
);

// Uruchomienie serwera MCP na stdio
async function init() {
  // const transport = new StdioServerTransport();
  const transport = new StreamableHTTPServerTransport({ port: 3000 });
  await mcpServer.connect(transport);
}

init();
