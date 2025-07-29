import express from "express";
import { randomUUID } from "node:crypto";
import {
  McpServer,
  ResourceTemplate,
} from "@modelcontextprotocol/sdk/server/mcp.js";
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
          "Create a new purchasing initiative with provided parameters. All parameters are optional, but when parameter is not provided, ask once if user wants to provide it. Ask about parameters one by one. Always use the 'purchaseInitiativeProcedureList' resource to find the ID of the procedure. Always use the 'suppliersList' tool to find the IDs of the suppliers. If there is less than 10 suppliers added to list, always ask if the user wants to add more suppliers. If the user wants to add more suppliers, use the 'suppliersList' tool again. After finding all of the ids, use the 'createPurchaseInitiative' tool to create the initiative.",
        inputSchema: {
          name: z
            .string()
            .describe("The name of the purchase initiative.")
            .optional(),
          description: z
            .string()
            .describe("The description of the purchase initiative.")
            .optional(),
          procedureId: z
            .string()
            .describe(
              "Id of the procedure. Use the 'purchaseInitiativeProcedureList' resource to find the correct ID based on the spoken procedure label. "
            )
            .optional(),
          amount: z
            .number()
            .describe("Estimated value of the purchase initiative.")
            .optional(),
          suppliersIds: z
            .array(z.string())
            .describe(
              "List of IDs of the suppliers assigned to the initiative. Use the 'suppliersList' tool to find the correct ID based on the spoken supplier name. There can be minimum 0 and maximum 10 suppliers assigned to the initiative."
            )
            .optional(),
        },
      },
      async ({ name, description, procedureId, amount, suppliersIds }) => {
        const res = await fetch(
          `https://skillandchill-dev.outsystemsenterprise.com/PR_Sandbox_BZONE/rest/AgentAI/CreateRequest`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name,
              description,
              procedureId,
              amount,
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
      "updatePurchaseInitiative",
      {
        title: "Update purchase initiative",
        description:
          "Updates an existing purchasing initiative with provided parameters. At the beginning user must provide at least one of the arguments - name or number of the initiative. All parameters are optional, but when parameter is not provided, ask once if user wants to provide it. Always use the 'suppliersList' tool to find the IDs of the suppliers. If there is less than 10 suppliers added to list, always ask if the user wants to add more suppliers. If the user wants to add more suppliers, use the 'suppliersList' tool again.",
        inputSchema: {
          name: z
            .string()
            .describe("The name of the purchase initiative.")
            .optional(),
          number: z
            .string()
            .describe("The number of the purchase initiative.")
            .optional(),
          suppliersIds: z
            .array(z.string())
            .describe(
              "List of IDs of the suppliers assigned to the initiative. Use the 'suppliersList' tool to find the correct ID based on the spoken supplier name. There can be minimum 1 and maximum 5 suppliers assigned to the initiative."
            )
            .optional(),
        },
      },
      async ({ name, number, suppliersIds }) => {
        const res = await fetch(
          `https://skillandchill-dev.outsystemsenterprise.com/PR_Sandbox_BZONE/rest/AgentAI/UpdateRequest`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name,
              number,
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
      "getPurchaseInitiativeProcedureList",
      new ResourceTemplate("bzone://static-table/dRequestProcedure"),
      {
        title: "Get purchase initiative procedures",
        description: "Retrieves a list of purchase initiative procedures.",
        mimeType: "application/json",
      },
      async () => {
        const res = await fetch(
          `https://skillandchill-dev.outsystemsenterprise.com/PR_Sandbox_BZONE/rest/AgentAI/RequestProceduresList`
        );
        const data = await res.json();

        return {
          content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
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

        const data = await res.json();

        return {
          content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
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

        const data = await res.json();

        return {
          content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
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
