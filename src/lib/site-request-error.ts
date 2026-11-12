const networkErrors: Record<string, string> = {
  EACCES: '当前进程的网络连接被系统或运行环境拒绝，请检查开发服务的网络权限与防火墙',
  EPERM: '当前进程没有建立网络连接的权限，请检查运行环境权限',
  ENOTFOUND: '无法解析网站域名，请检查 DNS 和网络设置',
  EAI_AGAIN: '域名解析暂时失败，请检查 DNS 和网络设置',
  ECONNREFUSED: '目标服务器拒绝连接',
  ECONNRESET: '连接被服务器或网络设备中断',
  ETIMEDOUT: '连接网站超时，请检查网络和代理设置',
  UND_ERR_CONNECT_TIMEOUT: '连接网站超时，请检查网络和代理设置',
  CERT_HAS_EXPIRED: '网站证书已过期',
  DEPTH_ZERO_SELF_SIGNED_CERT: '网站使用了当前运行环境不信任的自签名证书',
  UNABLE_TO_VERIFY_LEAF_SIGNATURE: '当前运行环境无法验证网站的证书链',
  ERR_TLS_CERT_ALTNAME_INVALID: '网站证书与访问域名不匹配',
}

export function siteRequestError(error: unknown): string {
  if (!(error instanceof Error)) return '读取网站失败'
  const cause = error.cause
  if (cause && typeof cause === 'object' && 'code' in cause && typeof cause.code === 'string') {
    return `${networkErrors[cause.code] ?? error.message}（${cause.code}）`
  }
  return error.message
}
