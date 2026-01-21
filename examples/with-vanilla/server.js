import "dotenv/config";
import express from "express";
import { Daydream } from "@daydreamlive/sdk";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));

const app = express();
app.use(express.json());
app.use(express.static(join(__dirname, "public")));

const client = new Daydream({ bearer: process.env.DAYDREAM_API_KEY });

app.post("/api/streams", async (req, res) => {
  try {
    const { prompt, negativePrompt } = req.body;

    const response = await client.streams.create({
      pipeline: "streamdiffusion",
      params: {
        modelId: "stabilityai/sdxl-turbo",
        prompt,
        width: 512,
        height: 512,
        negativePrompt,
        controlnets: [
          {
            modelId: "xinsir/controlnet-depth-sdxl-1.0",
            conditioningScale: 0.12,
            enabled: true,
            preprocessor: "depth",
          },
          {
            modelId: "xinsir/controlnet-canny-sdxl-1.0",
            conditioningScale: 0.6,
            enabled: true,
            preprocessor: "canny",
          },
        ],
        tIndexList: [2],
      },
    });

    res.json({
      id: response.id,
      whipUrl: response.whipUrl,
    });
  } catch (error) {
    console.error("Failed to create stream:", error);
    res.status(500).json({ error: "Failed to create stream" });
  }
});

app.patch("/api/streams/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { prompt, negativePrompt } = req.body;

    await client.streams.update({
      id,
      body: {
        pipeline: "streamdiffusion",
        params: {
          modelId: "stabilityai/sdxl-turbo",
          prompt,
          width: 512,
          height: 512,
          negativePrompt,
        },
      },
    });

    res.json({ success: true });
  } catch (error) {
    console.error("Failed to update stream:", error);
    res.status(500).json({ error: "Failed to update stream" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
