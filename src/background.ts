import { fetchSitePage } from './lib/fetch-site-page'
import { siteRequestError } from './lib/site-request-error'

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type !== 'blank:read-site') return false
  fetchSitePage(message.url).then(
    (page) => sendResponse({ ok: true, page }),
    (error: Error) => sendResponse({ ok: false, error: siteRequestError(error) }),
  )
  return true
})
