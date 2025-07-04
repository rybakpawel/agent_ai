const express = require("express");
const dotenv = require("dotenv");
const axios = require("axios");

dotenv.config();

const app = express();
app.use(express.json({ limit: "10mb" }));

const PORT = process.env.PORT || 3000;

function createPurchaseInitiative() {
  return {
    status: true,
    message: "Tworzenie nowej inicjatywy zakupowej..",
    module: "Sourcing",
  };
}

app.post("/ask-audio", async (req, res) => {
  try {
    const { audioBase64 } = req.body;

    if (!audioBase64) {
      return res.status(400).json({ error: "Missing base64Audio" });
    }

    const mcpRequest = {
      audio: {
        format: "webm",
        base64: audioBase64,
        source: "microphone",
      },
      messages: [
        {
          role: "user",
          content: "Transcribe and act based on this command",
        },
      ],
    };

    const response = await axios.post(process.env.ELEVEN_MCP_URL, mcpRequest, {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.ELEVEN_API_KEY}`,
      },
    });

    const aiReply = response.data?.choices?.[0]?.message?.content || "";

    if (aiReply.toLowerCase().includes("stwórz inicjatywę zakupową")) {
      const initiative = createPurchaseInitiative({
        name: "Przykładowa inicjatywa",
      });
      return res.json({ aiReply, initiative });
    }

    // Domyślna odpowiedź
    res.json({ aiReply });
  } catch (error) {
    if (error.response) {
      // Błąd z 11.ai
      return res.status(error.response.status).json(error.response.data);
    }
    res.status(500).json({ error: "Server error", details: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
