import { useCallback, useEffect, useRef, useState } from 'react'
import { readSiteMetadata, type SiteMetadata } from '@/lib/site-metadata'
import { normalizeUrl } from '@/lib/workspace'

export function useSiteDetails(
  input: string,
  enabled: boolean,
  onMetadata: (metadata: SiteMetadata) => void,
) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'permission' | 'success' | 'error'>(
    'idle',
  )
  const [message, setMessage] = useState('')
  const revision = useRef(0)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingUrl = useRef<string | null>(null)
  const completedUrl = useRef<string | null>(null)
  const invalidate = useCallback(() => {
    revision.current++
    pendingUrl.current = null
    completedUrl.current = null
  }, [])
  const read = useCallback(
    async (requestAccess = false, force = false) => {
      if (timer.current) {
        clearTimeout(timer.current)
        timer.current = null
      }
      let url: string
      try {
        url = normalizeUrl(input)
      } catch {
        return
      }
      if (!force && completedUrl.current === url) return
      if (
        pendingUrl.current === url &&
        !(requestAccess && location.protocol === 'chrome-extension:')
      )
        return
      const current = ++revision.current
      pendingUrl.current = url
      setStatus('loading')
      setMessage('正在读取网站名称和图标…')
      try {
        const result = await readSiteMetadata(url, requestAccess)
        if (current !== revision.current) return
        if (result.status === 'permission') {
          setStatus('permission')
          setMessage(result.message)
          return
        }
        onMetadata(result.metadata)
        completedUrl.current = url
        setStatus('success')
        setMessage(
          result.metadata.title && result.metadata.favicon
            ? ''
            : !result.metadata.favicon
              ? '未找到网站图标，请选择其他图标'
              : '未找到网站名称，请手动填写',
        )
      } catch (error) {
        if (current !== revision.current) return
        setStatus('error')
        setMessage(`读取失败：${error instanceof Error ? error.message : '无法读取这个网站'}`)
      } finally {
        if (current === revision.current) pendingUrl.current = null
      }
    },
    [input, onMetadata],
  )
  useEffect(() => {
    if (!enabled || !input.trim()) return
    timer.current = setTimeout(() => {
      void read(false)
    }, 650)
    const currentTimer = timer.current
    return () => {
      clearTimeout(currentTimer)
      invalidate()
    }
  }, [enabled, input, read, invalidate])
  return { status, message, read }
}
