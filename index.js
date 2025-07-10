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
          "Create a new purchasing initiative with provided parameters.",
        inputSchema: {
          name: z.string().describe("The name of the purchase initiative"),
        },
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
