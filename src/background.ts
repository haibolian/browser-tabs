import { fetchSitePage } from './lib/fetch-site-page'

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type !== 'blank:read-site') return false
  fetchSitePage(message.url).then(
    (page) => sendResponse({ ok: true, page }),
    (error: Error) => sendResponse({ ok: false, error: error.message }),
  )
  return true
})
