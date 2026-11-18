import { z } from 'zod'

const recordSchema = z.record(z.string().uuid(), z.object({ at: z.number(), pending: z.boolean() }))
const changeEvent = 'blank:push-read-changed'

export function pushReadKey(account: string) {
  return `blank:push-read:${account}`
}

export function readPushReadState(account: string) {
  const stored = localStorage.getItem(pushReadKey(account))
  if (!stored) return {}
  try {
    const result = recordSchema.safeParse(JSON.parse(stored))
    return result.success ? result.data : {}
  } catch {
    return {}
  }
}

function save(account: string, records: z.infer<typeof recordSchema>) {
  const entries = Object.entries(records).sort((a, b) => b[1].at - a[1].at)
  const kept = entries.filter(([, record], index) => record.pending || index < 400)
  localStorage.setItem(pushReadKey(account), JSON.stringify(Object.fromEntries(kept)))
  window.dispatchEvent(new CustomEvent(changeEvent, { detail: account }))
}

export function queuePushRead(account: string, id: string) {
  const records = readPushReadState(account)
  records[id] = { at: Date.now(), pending: true }
  save(account, records)
}

export function acknowledgePushReads(account: string, ids: string[]) {
  const records = readPushReadState(account)
  for (const id of ids) if (records[id]) records[id].pending = false
  save(account, records)
}

export function subscribePushReads(account: string, listener: () => void) {
  const onLocal = (event: Event) => {
    if ((event as CustomEvent<string>).detail === account) listener()
  }
  const onStorage = (event: StorageEvent) => {
    if (event.key === pushReadKey(account) || event.key === null) listener()
  }
  window.addEventListener(changeEvent, onLocal)
  window.addEventListener('storage', onStorage)
  return () => {
    window.removeEventListener(changeEvent, onLocal)
    window.removeEventListener('storage', onStorage)
  }
}
