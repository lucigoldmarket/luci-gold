import { type NextRequest, NextResponse } from "next/server"

const BOT_URL = process.env.BOT_DASHBOARD_URL ?? "http://localhost:8000"

function buildTargetUrl(req: NextRequest, path: string[]): string {
  const apiPath = path.join("/")
  const search = req.nextUrl.search
  return `${BOT_URL}/api/${apiPath}${search}`
}

async function handler(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params
  const targetUrl = buildTargetUrl(req, path)

  // SSE streaming — forward as a passthrough stream
  if (path[0] === "log" && path[2] === "stream") {
    try {
      const upstream = await fetch(targetUrl, {
        method: "GET",
        headers: { Accept: "text/event-stream" },
        signal: req.signal,
      })
      return new NextResponse(upstream.body, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
          "X-Accel-Buffering": "no",
        },
      })
    } catch {
      return NextResponse.json({ error: "Bot dashboard tidak bisa dihubungi" }, { status: 503 })
    }
  }

  // Regular JSON proxy
  const body = req.method !== "GET" && req.method !== "HEAD" ? await req.text() : undefined
  try {
    const upstream = await fetch(targetUrl, {
      method: req.method,
      headers: { "Content-Type": "application/json" },
      body,
    })
    const data = await upstream.text()
    return new NextResponse(data, {
      status: upstream.status,
      headers: { "Content-Type": upstream.headers.get("Content-Type") ?? "application/json" },
    })
  } catch {
    return NextResponse.json({ error: "Bot dashboard tidak bisa dihubungi. Pastikan bangjugo-dashboard sudah jalan." }, { status: 503 })
  }
}

export const GET = handler
export const POST = handler
export const PUT = handler
export const DELETE = handler
export const dynamic = "force-dynamic"
