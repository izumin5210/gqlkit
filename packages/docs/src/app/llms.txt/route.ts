import { createTextResponse, generateLlmsTxt } from "../../lib/llms-txt";

export const dynamic = "force-static";

export async function GET(): Promise<Response> {
  const content = await generateLlmsTxt();
  return createTextResponse(content);
}
