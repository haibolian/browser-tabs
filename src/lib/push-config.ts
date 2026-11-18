import { CLOUD_SERVER_URL } from './cloud-server'

export const MCP_PUSH_URL = `${CLOUD_SERVER_URL}/api/v1/mcp`

export function pushMcpConfig(token: string) {
  return `[mcp_servers.blank]\nurl = ${JSON.stringify(MCP_PUSH_URL)}\nhttp_headers = { Authorization = ${JSON.stringify(`Bearer ${token}`)} }\n`
}
