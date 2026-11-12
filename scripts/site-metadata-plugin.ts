import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Plugin } from 'vite'
import { fetchSitePage } from '../src/lib/fetch-site-page'
import { siteRequestError } from '../src/lib/site-request-error'

async function metadataHandler(
  request: IncomingMessage,
  response: ServerResponse,
  next: () => void,
) {
  const url = new URL(request.url ?? '/', 'http://127.0.0.1')
  if (url.pathname !== '/api/site-metadata') {
    next()
    return
  }
  response.setHeader('Content-Type', 'application/json; charset=utf-8')
  try {
    const target = url.searchParams.get('url')
    if (!target) throw new Error('缺少网站地址')
    response.end(JSON.stringify(await fetchSitePage(target)))
  } catch (error) {
    console.error('Site metadata request failed:', error)
    response.statusCode = 422
    response.end(JSON.stringify({ error: siteRequestError(error) }))
  }
}

export function siteMetadataPlugin(): Plugin {
  return {
    name: 'local-site-metadata',
    configureServer(server) {
      server.middlewares.use(metadataHandler)
    },
    configurePreviewServer(server) {
      server.middlewares.use(metadataHandler)
    },
  }
}
