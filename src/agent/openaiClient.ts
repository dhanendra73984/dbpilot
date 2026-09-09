import OpenAI from "openai";

import { env } from "../config/env.js";

export const openai = new OpenAI({
  apiKey: env.openaiApiKey,
  baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
});