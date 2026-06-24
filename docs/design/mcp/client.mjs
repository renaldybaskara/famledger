import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";

async function main() {
  const transport = new SSEClientTransport(new URL("http://127.0.0.1:29979/mcp/sse"));
  const client = new Client({ name: "my-client", version: "1.0.0" }, { capabilities: {} });
  
  await client.connect(transport);
  
  const tools = await client.listTools();
  console.log("Tools available:", JSON.stringify(tools, null, 2));
  
  // Call the tool to get screens
  const screensResult = await client.callTool({ name: "list_screens", arguments: {} }).catch(() => null);
  console.log("Screens:", JSON.stringify(screensResult, null, 2));
  
  process.exit(0);
}

main().catch(console.error);
