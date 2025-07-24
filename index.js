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

const transports = {};

app.post("/mcp", async (req, res) => {
  const sessionId = req.headers["mcp-session-id"];
  let transport;

  if (sessionId && transports[sessionId]) {
    transport = transports[sessionId];
  } else if (!sessionId && isInitializeRequest(req.body)) {
    transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
      onsessioninitialized: (sessionId) => {
        transports[sessionId] = transport;
      },
    });

    transport.onclose = () => {
      if (transport.sessionId) {
        delete transports[transport.sessionId];
      }
    };
    const server = new McpServer({
      name: "example-server",
      version: "1.0.0",
    });

    server.registerTool(
      "createPurchaseInitiative",
      {
        title: "Create purchase initiative",
        description:
          "Create a new purchasing initiative with provided parameters. All parameters are optional, but when parameter is not provided, ask once if user wants to provide it. Always use the 'suppliersList' tool to find the IDs of the suppliers. If there is less than 10 suppliers added to list, always ask if the user wants to add more suppliers. If the user wants to add more suppliers, use the 'suppliersList' tool again. If the user wants to create the initiative, use the 'createPurchaseInitiative' to create a new purchasing initiative.",
        inputSchema: {
          initiativeName: z
            .string()
            .describe("The name of the purchase initiative.").optional,
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

    await server.connect(transport);
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

  await transport.handleRequest(req, res, req.body);
});

const handleSessionRequest = async (req, res) => {
  const sessionId = req.headers["mcp-session-id"];
  if (!sessionId || !transports[sessionId]) {
    res.status(400).send("Invalid or missing session ID");
    return;
  }

  const transport = transports[sessionId];
  await transport.handleRequest(req, res);
};

app.get("/mcp", handleSessionRequest);

app.delete("/mcp", handleSessionRequest);

app.listen(3000);
