import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const PUBLIC_PATHS = ['/login', '/register']

const CHALLENGE = new NextResponse('Authentication required', {
  status: 401,
  headers: { 'WWW-Authenticate': 'Basic realm="Secure Area", charset="UTF-8"' },
})

function basicAuth(request: NextRequest): NextResponse | null {
  const expectedUser = process.env.BASIC_AUTH_USER
  const expectedPass = process.env.BASIC_AUTH_PASS

  // 環境変数が両方未設定の場合はスキップ
  if (!expectedUser && !expectedPass) return null

  const authorization = request.headers.get('authorization') ?? ''
  const match = authorization.match(/^Basic\s+(.+)$/i)
  if (!match) return CHALLENGE

  let decoded: string
  try {
    decoded = atob(match[1])
  } catch {
    return CHALLENGE
  }

  const colonIndex = decoded.indexOf(':')
  if (colonIndex === -1) return CHALLENGE

  const user = decoded.slice(0, colonIndex)
  const pass = decoded.slice(colonIndex + 1)

  if (user !== expectedUser || pass !== expectedPass) return CHALLENGE
  return null
}

export async function proxy(request: NextRequest) {
  const authResponse = basicAuth(request)
  if (authResponse) return authResponse

  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  // 未認証ユーザーが保護されたパスにアクセスした場合は /login へ
  if (!user && !PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // 認証済みユーザーが /login や /register にアクセスした場合は /dashboard へ
  if (user && PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
