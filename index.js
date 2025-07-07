import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

console.log("B-Zone Agent");

// Funkcja biznesowa: tworzenie inicjatywy
async function createPurchaseInitiative({ name }) {
  await fetch(
    "https://skillandchill-dev.outsystemsenterprise.com/PR_Sandbox_BZONE/rest/AgentAI/CreateRequest",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    }
  );

  return {
    status: true,
    message: `Inicjatywa zakupowa '${name}' została utworzona!`,
  };
}

// Definicja serwera MCP
const mcpServer = new McpServer({
  info: {
    name: "B-Zone Agent",
    description: "Server for handling B-Zone System tasks",
    version: "1.0.0",
  },
});

// Rejestracja narzędzia
mcpServer.tool(
  "createPurchaseInitiative",
  "Create a new purchasing initiative with provided name.",
  {
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "The name of the initiative." },
      },
    },
    handler: createPurchaseInitiative,
  }
);

// Uruchomienie serwera MCP na stdio
const transport = new StdioServerTransport();
mcpServer.connect(transport);
