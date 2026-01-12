import { generateLlmsFullTxt } from "../../lib/llms-txt";

export const dynamic = "force-static";

export async function GET() {
  const content = await generateLlmsFullTxt();
  return new Response(content, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
    },
  });
}
