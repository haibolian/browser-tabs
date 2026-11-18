import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js'
import { z } from 'zod'
import {
  pushMessageInputSchema,
  pushTokenInputSchema,
  readPushMessagesSchema,
} from '../src/lib/push-contract'
import { CLOUD_SERVER_URL } from '../src/lib/cloud-server'
import { hashToken } from './auth'
import { ApiError } from './errors'
import type { PushStore } from './push'

export function registerPushRoutes(
  app: FastifyInstance,
  push: PushStore,
  userId: (request: FastifyRequest) => string,
) {
  function authenticatePush(request: FastifyRequest, reply: FastifyReply) {
    reply.header('WWW-Authenticate', 'Bearer realm="blank-push"')
    const bearer = /^Bearer (blank_push_\S+)$/.exec(request.headers.authorization ?? '')
    if (!bearer) throw new ApiError(401, '请填写有效的推送令牌')
    const token = push.authenticate(hashToken(bearer[1]))
    reply.removeHeader('WWW-Authenticate')
    return token
  }

  app.get('/api/v1/push/tokens', async (request) => push.listTokens(userId(request)))
  app.post('/api/v1/push/tokens', { bodyLimit: 2048 }, async (request, reply) => {
    const owner = userId(request)
    const { name } = pushTokenInputSchema.parse(request.body)
    return reply.code(201).send(push.createToken(owner, name))
  })
  app.delete('/api/v1/push/tokens/:id', async (request, reply) => {
    const owner = userId(request)
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params)
    push.revokeToken(owner, id)
    return reply.code(204).send()
  })
  app.get('/api/v1/push/messages', async (request) => push.unread(userId(request)))
  app.post('/api/v1/push/messages/read', async (request, reply) => {
    const owner = userId(request)
    const { ids } = readPushMessagesSchema.parse(request.body)
    push.markRead(owner, ids)
    return reply.code(204).send()
  })
  app.post('/api/v1/push/messages', { bodyLimit: 512 * 1024 }, async (request, reply) => {
    const token = authenticatePush(request, reply)
    const message = push.send(token, pushMessageInputSchema.parse(request.body))
    return reply.code(201).send({ id: message.id, createdAt: message.createdAt })
  })

  app.post('/api/v1/mcp', { bodyLimit: 512 * 1024 }, async (request, reply) => {
    const origin = request.headers.origin
    if (origin && origin !== new URL(CLOUD_SERVER_URL).origin)
      throw new ApiError(403, '不允许此来源访问 MCP')
    const token = authenticatePush(request, reply)
    const mcp = new McpServer({ name: 'blank-push', version: '1.0.0' })
    mcp.registerTool(
      'send_result',
      {
        title: '发送任务结果到留白',
        description:
          '将最终结果发送到用户的留白新标签页。content 保留完整正文；重试时使用相同的 requestId，避免重复消息。',
        inputSchema: pushMessageInputSchema,
        annotations: {
          readOnlyHint: false,
          destructiveHint: false,
          idempotentHint: false,
          openWorldHint: false,
        },
      },
      async (input) => {
        try {
          const message = push.send(token, input)
          return {
            content: [
              {
                type: 'text' as const,
                text: JSON.stringify({ id: message.id, createdAt: message.createdAt }),
              },
            ],
          }
        } catch (error) {
          if (!(error instanceof ApiError)) request.log.error(error)
          return {
            isError: true,
            content: [
              {
                type: 'text' as const,
                text: error instanceof ApiError ? error.message : '消息保存失败，请稍后重试',
              },
            ],
          }
        }
      },
    )
    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    })
    try {
      await mcp.connect(transport)
      const headers = new Headers()
      for (const [key, value] of Object.entries(request.headers)) {
        if (Array.isArray(value)) for (const item of value) headers.append(key, item)
        else if (value !== undefined) headers.set(key, value)
      }
      const response = await transport.handleRequest(
        new Request(`${CLOUD_SERVER_URL}/api/v1/mcp`, {
          method: 'POST',
          headers,
          body: JSON.stringify(request.body),
        }),
        { parsedBody: request.body },
      )
      const body = await response.text()
      response.headers.forEach((value, key) => reply.header(key, value))
      return reply.code(response.status).send(body || undefined)
    } finally {
      await mcp.close()
    }
  })
  app.route({
    method: ['GET', 'DELETE'],
    url: '/api/v1/mcp',
    handler: async (request, reply) => {
      authenticatePush(request, reply)
      return reply.header('Allow', 'POST').code(405).send({ error: '此 MCP 使用无状态 HTTP POST' })
    },
  })
}
