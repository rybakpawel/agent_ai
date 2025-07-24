import express from "express";
import { randomUUID } from "node:crypto";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import dotenv from "dotenv";
dotenv.config();

const app = express();
app.use(express.json());

// Przechowujemy sesje: { sessionId: { transport, server } }
const sessions = {};

/**
 * Funkcja pomocnicza do rejestrowania narzędzi MCP
 */
function registerTools(server) {
  // Create Purchase Initiative
  server.registerTool(
    "createPurchaseInitiative",
    {
      title: "Create purchase initiative",
      description:
        "Create a new purchasing initiative with provided parameters. All parameters are optional, but when parameter is not provided, ask once if user wants to provide it. Always use the 'suppliersList' tool to find the IDs of the suppliers. If there is less than 10 suppliers added to list, always ask if the user wants to add more suppliers. If the user wants to add more suppliers, use the 'suppliersList' tool again. If the user wants to create the initiative, use the 'createPurchaseInitiative' to create a new purchasing initiative.",
      inputSchema: {
        initiativeName: z
          .string()
          .describe("The name of the purchase initiative.")
          .optional(),
        suppliersIds: z
          .array(z.string())
          .describe(
            "List of IDs of the suppliers assigned to the initiative. Use the 'suppliersList' tool to find the correct ID based on the spoken supplier name. There can be minimum 1 and maximum 5 suppliers assigned to the initiative."
          )
          .optional(),
      },
    },
    async ({ initiativeName, suppliersIds }) => {
      const res = await fetch(
        `https://skillandchill-dev.outsystemsenterprise.com/PR_Sandbox_BZONE/rest/AgentAI/CreateRequest`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            initiativeName,
            suppliersIds,
          }),
        }
      );

      const data = await res.json();

      return {
        content: [{ type: "text", text: data.message }],
      };
    }
  );

  // Get Suppliers
  server.registerTool(
    "getSuppliers",
    {
      title: "Get suppliers",
      description: "Retrieves a list of suppliers.",
    },
    async () => {
      const res = await fetch(
        `https://skillandchill-dev.outsystemsenterprise.com/PR_Sandbox_BZONE/rest/AgentAI/SuppliersList`,
        {
          method: "GET",
          headers: { "Content-Type": "application/json" },
        }
      );

      const jsonData = await res.json();
      const data = JSON.stringify(jsonData, null, 2);

      return {
        content: [{ type: "text", text: data }],
      };
    }
  );

  // Get Purchase Initiatives
  server.registerTool(
    "getPurchaseInitiatives",
    {
      title: "Get purchase initiatives",
      description: "Retrieves a list of purchase initiatives.",
    },
    async () => {
      const res = await fetch(
        `https://skillandchill-dev.outsystemsenterprise.com/PR_Sandbox_BZONE/rest/AgentAI/PurchaseInitiativesList`,
        {
          method: "GET",
          headers: { "Content-Type": "application/json" },
        }
      );

      const jsonData = await res.json();
      const data = JSON.stringify(jsonData, null, 2);

      return {
        content: [{ type: "text", text: data }],
      };
    }
  );
}

/**
 * POST /mcp – obsługa RPC i inicjalizacji
 */
app.post("/mcp", async (req, res) => {
  const sessionIdHeader = req.headers["mcp-session-id"];
  let sessionId = sessionIdHeader || null;

  try {
    let session;

    // Jeśli istnieje aktywna sesja
    if (sessionId && sessions[sessionId]) {
      session = sessions[sessionId];
    }
    // Jeśli to żądanie inicjalizacyjne
    else if (!sessionId && isInitializeRequest(req.body)) {
      sessionId = randomUUID();

      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => sessionId,
        onsessioninitialized: (sid) => {
          console.log(`[MCP] Sesja zainicjalizowana: ${sid}`);
        },
      });

      // Utwórz MCP server i zarejestruj narzędzia
      const server = new McpServer({
        name: "B-Zone Agent",
        description: "Server for handling B-Zone System tasks",
        version: "1.0.0",
      });
      registerTools(server);

      // Połącz serwer z transportem
      await server.connect(transport);

      // Zapisz sesję
      sessions[sessionId] = { transport, server };

      // Obsłuż zamknięcie połączenia
      res.on("close", () => {
        console.log(`[MCP] Połączenie zamknięte: ${sessionId}`);
        if (sessions[sessionId]) {
          sessions[sessionId].transport.close();
          sessions[sessionId].server.close();
          delete sessions[sessionId];
        }
      });

      session = sessions[sessionId];
    } else {
      // Brak sesji lub błędny request
      res.status(400).json({
        jsonrpc: "2.0",
        error: {
          code: -32000,
          message: "Bad Request: No valid session ID provided",
        },
        id: null,
      });
      return;
    }

    // Obsłuż żądanie przez transport
    await session.transport.handleRequest(req, res, req.body);
  } catch (err) {
    console.error("Error handling MCP request:", err);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: "2.0",
        error: {
          code: -32603,
          message: "Internal server error",
        },
        id: null,
      });
    }
  }
});

/**
 * GET /mcp – SSE dla powiadomień
 */
app.get("/mcp", async (req, res) => {
  const sessionId = req.headers["mcp-session-id"];
  if (!sessionId || !sessions[sessionId]) {
    res.status(400).send("Invalid or missing session ID");
    return;
  }
  await sessions[sessionId].transport.handleRequest(req, res);
});

/**
 * DELETE /mcp – zakończenie sesji
 */
app.delete("/mcp", async (req, res) => {
  const sessionId = req.headers["mcp-session-id"];
  if (!sessionId || !sessions[sessionId]) {
    res.status(400).send("Invalid or missing session ID");
    return;
  }

  sessions[sessionId].transport.close();
  sessions[sessionId].server.close();
  delete sessions[sessionId];

  res.status(200).send("Session closed");
});

app.listen(process.env.PORT || 3000, () => {
  console.log(`MCP Server listening on port ${process.env.PORT || 3000}`);
});
