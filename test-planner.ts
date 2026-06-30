import { plannerService } from "./src/services/plannerService.js";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
dotenv.config();

const aiClient = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function test() {
  const result = await plannerService.generateTaskPlan("Read 20 pages a day", aiClient, "");
  console.log(JSON.stringify(result, null, 2));
}

test().catch(console.error);
