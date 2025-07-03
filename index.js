const express = require("express");
const dotenv = require("dotenv");
const axios = require("axios");

dotenv.config();

const app = express();
app.use(express.json({ limit: "10mb" }));

const PORT = process.env.PORT || 3000;

// Endpoint odbierający nagranie
app.post("/ask-audio", async (req, res) => {
  try {
    const { base64Audio } = req.body;

    if (!base64Audio) {
      return res.status(400).json({ error: "Missing base64Audio" });
    }

    // Wysyłamy nagranie bezpośrednio do 11.ai MCP
    const response = await axios.post(
      process.env.ELEVEN_MCP_URL, // Np. https://your-agent-name.11.ai/mcp
      {
        audio: {
          format: "webm",
          base64: base64Audio,
        },
        messages: [
          {
            role: "user",
            content: "Transcribe and act based on this command",
          },
        ],
      },
      {
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    res.json(response.data);
  } catch (error) {
    console.error("Error:", error.message);
    res.status(500).json({ error: "Server error", details: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
