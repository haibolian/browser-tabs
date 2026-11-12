import { useEffect, useState } from 'react'
import { Github, LoaderCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { completeGitHubRedirect } from '@/lib/github-login'

export function GitHubCallback() {
  const [result, setResult] = useState<{ login: string } | { error: string } | null>(null)
  useEffect(() => {
    let alive = true
    completeGitHubRedirect().then(
      (connection) => {
        if (alive) setResult({ login: connection.session.user.login })
      },
      (error: Error) => {
        if (alive) setResult({ error: error.message })
      },
    )
    return () => {
      alive = false
    }
  }, [])
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-5 bg-background p-8 text-center text-foreground">
      <Github size={36} />
      <h1 className="text-xl font-medium">
        {result
          ? 'login' in result
            ? 'GitHub 登录成功'
            : '未完成 GitHub 登录'
          : '正在完成 GitHub 登录'}
      </h1>
      {result ? (
        <>
          <p
            role={'error' in result ? 'alert' : 'status'}
            className="max-w-lg text-sm text-muted-foreground"
          >
            {'login' in result ? `@${result.login}` : result.error}
          </p>
          <Button onClick={() => location.replace(`${location.origin}${location.pathname}`)}>
            返回桌面
          </Button>
        </>
      ) : (
        <LoaderCircle className="animate-spin" aria-label="正在验证登录" />
      )}
    </main>
  )
}
