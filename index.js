const express = require("express");
const { MCPServer, Tool } = require("@modelcontextprotocol/sdk");

const app = express();

// Definicja narzędzia: tworzenie inicjatywy zakupowej
const createInitiative = new Tool({
  name: "create_purchase_initiative",
  description: "Creates a new purchasing initiative.",
  inputSchema: {
    type: "object",
    properties: {
      name: { type: "string", description: "The name of the initiative." },
    },
    required: ["name"],
  },
  handler: async (input, context) => {
    // Przykładowa logika biznesowa
    return {
      status: true,
      message: `Inicjatywa zakupowa '${input.name}' została utworzona!`,
      module: "Sourcing",
    };
  },
});

// (Opcjonalnie) Definicja narzędzia: usuwanie inicjatywy zakupowej
const deleteInitiative = new Tool({
  name: "delete_purchase_initiative",
  description: "Deletes an existing purchasing initiative by its ID.",
  inputSchema: {
    type: "object",
    properties: {
      initiative_id: {
        type: "string",
        description: "The unique identifier of the initiative to delete.",
      },
    },
    required: ["initiative_id"],
  },
  handler: async (input, context) => {
    // Przykładowa logika biznesowa
    return {
      status: true,
      message: `Inicjatywa o ID '${input.initiative_id}' została usunięta!`,
      module: "Sourcing",
      details: input,
    };
  },
});

// Tworzymy serwer MCP z narzędziami
const mcpServer = new MCPServer({
  tools: [createInitiative, deleteInitiative],
  info: {
    name: "bzone_agent",
    description: "Server for handling B-Zone System tasks",
    version: "1.0.0",
    contact: {
      name: "Twoje Imię",
      email: "twoj@email.com",
    },
  },
});

app.use(mcpServer.router); // automatycznie wystawia manifest i endpointy

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
