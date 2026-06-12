"use client"

import { useRef } from "react"
import { Sidebar } from "@/components/sidebar"
import { Header } from "@/components/header"
import { RequireAdmin } from "@/components/require-admin"
import { Button } from "@/components/ui/button"
import { RefreshCw } from "lucide-react"

export default function BotManagerPage() {
  const iframeRef = useRef<HTMLIFrameElement>(null)

  function refresh() {
    if (iframeRef.current) {
      iframeRef.current.src = "http://localhost:8000"
    }
  }

  return (
    <RequireAdmin>
      <div className="flex min-h-screen bg-background">
        <Sidebar />
        <div className="flex-1 page-content flex flex-col">
          <Header />
          <div className="flex-1 px-4 pb-4 md:px-6 md:pb-6 lg:px-8 lg:pb-8 flex flex-col gap-3">
            <div className="flex justify-end">
              <Button size="sm" variant="outline" onClick={refresh}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
            </div>
            <iframe
              ref={iframeRef}
              src="http://localhost:8000"
              className="w-full flex-1 min-h-[80vh] rounded-2xl border border-border"
              title="Bot Manager"
            />
          </div>
        </div>
      </div>
    </RequireAdmin>
  )
}
