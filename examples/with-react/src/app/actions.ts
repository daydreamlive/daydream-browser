"use server";

import { Daydream } from "@daydreamlive/sdk";
import type { Sdxl } from "@daydreamlive/sdk/models";

const client = new Daydream({ bearer: process.env.DAYDREAM_API_KEY! });

export type CreateStreamParams = Pick<Sdxl, "prompt" | "negativePrompt">;

export interface StreamInfo {
  id: string;
  whipUrl: string;
}

export async function createStream(
  params: CreateStreamParams,
): Promise<StreamInfo> {
  const response = await client.streams.create({
    pipeline: "streamdiffusion",
    params: {
      modelId: "stabilityai/sdxl-turbo",
      prompt: params.prompt,
      width: 512,
      height: 512,
      negativePrompt: params.negativePrompt,
    },
  });

  return {
    id: response.id,
    whipUrl: response.whipUrl,
  };
}

export async function updateStream(
  id: string,
  params: Partial<CreateStreamParams>,
): Promise<void> {
  await client.streams.update({
    id,
    body: {
      pipeline: "streamdiffusion",
      params: {
        modelId: "stabilityai/sdxl-turbo",
        prompt: params.prompt,
        width: 512,
        height: 512,
        negativePrompt: params.negativePrompt,
      },
    },
  });
}
