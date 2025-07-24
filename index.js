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

// Funkcja planująca wygaśnięcie sesji
function scheduleSessionCleanup(sessionId) {
  if (sessions[sessionId].timeout) clearTimeout(sessions[sessionId].timeout);
  sessions[sessionId].timeout = setTimeout(() => {
    console.log(`[MCP] Sesja wygasła: ${sessionId}`);
    sessions[sessionId].transport.close();
    sessions[sessionId].server.close();
    delete sessions[sessionId];
  }, SESSION_TIMEOUT);
}

// Obsługa POST /mcp
app.post("/mcp", async (req, res) => {
  const incomingSessionId = req.headers["mcp-session-id"];
  let session;

  // Reużycie istniejącej sesji
  if (incomingSessionId && sessions[incomingSessionId]) {
    session = sessions[incomingSessionId];
    scheduleSessionCleanup(incomingSessionId);
  }
  // Nowa sesja (initialize)
  else if (!incomingSessionId && isInitializeRequest(req.body)) {
    const newSessionId = randomUUID();

    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => newSessionId,
      onsessioninitialized: (sid) => {
        console.log(`[MCP] Sesja zainicjalizowana: ${sid}`);
      },
    });

    const server = new McpServer({
      name: "B-Zone Agent",
      description: "Server for handling B-Zone System tasks",
      version: "1.0.0",
    });

    registerTools(server);
    await server.connect(transport);

    sessions[newSessionId] = { transport, server };
    session = sessions[newSessionId];
    scheduleSessionCleanup(newSessionId);
  } else {
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

  // Obsłuż request JSON-RPC
  await session.transport.handleRequest(req, res, req.body);
});

// Obsługa SSE i DELETE
const handleSessionRequest = async (req, res) => {
  const sessionId = req.headers["mcp-session-id"];
  if (!sessionId || !sessions[sessionId]) {
    res.status(400).send("Invalid or missing session ID");
    return;
  }

  const session = sessions[sessionId];
  scheduleSessionCleanup(sessionId);

  await session.transport.handleRequest(req, res);
};

// GET dla SSE
app.get("/mcp", handleSessionRequest);

// DELETE dla zamknięcia sesji
app.delete("/mcp", (req, res) => {
  const sessionId = req.headers["mcp-session-id"];
  if (!sessionId || !sessions[sessionId]) {
    res.status(400).send("Invalid or missing session ID");
    return;
  }

  console.log(`[MCP] Połączenie zamknięte: ${sessionId}`);
  sessions[sessionId].transport.close();
  sessions[sessionId].server.close();
  delete sessions[sessionId];

  res.status(200).send("Session closed");
});

app.listen(process.env.PORT || 3000, () => {
  console.log(
    `MCP Stateless Streamable HTTP Server listening on port ${
      process.env.PORT || 3000
    }`
  );
});
