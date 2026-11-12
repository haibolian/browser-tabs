import { useEffect, useState } from 'react'
import { readCloudConnection, subscribeCloudConnection } from '@/lib/cloud-api'

function readConnection() {
  try {
    return { connection: readCloudConnection(), error: null }
  } catch (error) {
    return { connection: null, error: `读取云端登录信息失败：${(error as Error).message}` }
  }
}

export function useCloudConnection() {
  const [state, setState] = useState(readConnection)
  useEffect(() => subscribeCloudConnection(() => setState(readConnection())), [])
  return state
}
