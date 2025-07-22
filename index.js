import express from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";
import dotenv from "dotenv";
dotenv.config();

const app = express();
app.use(express.json());

app.post("/mcp", async (req, res) => {
  try {
    const mcpServer = new McpServer({
      name: "B-Zone Agent",
      description: "Server for handling B-Zone System tasks",
      version: "1.0.0",
    });

    mcpServer.registerTool(
      "createPurchaseInitiative",
      {
        title: "Create purchase initiative",
        description:
          "Create a new purchasing initiative with provided parameters. Always use the 'suppliersList' tool to find the ID of the supplier. After finding supplier ID, use the 'createPurchaseInitiative' Create a new purchasing initiative with provided parameters. Always use the 'suppliersList' tool to find the ID of the supplier. After finding supplier ID, use the 'createPurchaseInitiative' tool to create the initiative. to find the ID of the initiative.",
        inputSchema: {
          initiativeName: z
            .string()
            .describe("The name of the purchase initiative."),
          supplierId: z
            .string()
            .describe(
              "ID of the supplier assigned to the initiative. Use the 'suppliersList' tool to find the correct ID based on the spoken supplier name."
            ),
        },
      },
      async ({ initiativeName, supplierId }) => {
        const res = await fetch(
          `https://skillandchill-dev.outsystemsenterprise.com/PR_Sandbox_BZONE/rest/AgentAI/CreateRequest?name=${initiativeName}&supplierId=${supplierId}`,
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

    mcpServer.registerTool(
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

    mcpServer.registerTool(
      "getPurchaseInitiatives",
      {
        title: "Get purchase initiatives",
        description: "Retrieves a list of suppliers.",
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

    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });
    res.on("close", () => {
      console.log("Request closed");
      transport.close();
      mcpServer.close();
    });
    await mcpServer.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (error) {
    console.error("Error handling MCP request:", error);
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

app.listen(process.env.PORT || 3000, (error) => {
  if (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
  console.log(
    `MCP Stateless Streamable HTTP Server listening on port ${process.env.PORT}`
  );
});
