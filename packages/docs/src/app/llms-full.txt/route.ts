import { createTextResponse, generateLlmsFullTxt } from "../../lib/llms-txt";

export const dynamic = "force-static";

export async function GET(): Promise<Response> {
  const content = await generateLlmsFullTxt();
  return createTextResponse(content);
}
