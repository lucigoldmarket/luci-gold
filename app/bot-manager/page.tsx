"use client"

import { Sidebar } from "@/components/sidebar"
import { Header } from "@/components/header"
import { RequireAdmin } from "@/components/require-admin"

export default function BotManagerPage() {
  return (
    <RequireAdmin>
      <div className="flex min-h-screen bg-background">
        <Sidebar />
        <div className="flex-1 page-content flex flex-col">
          <Header />
          <div className="flex-1 px-4 pb-4 md:px-6 md:pb-6 lg:px-8 lg:pb-8">
            <iframe
              src="http://localhost:8000"
              className="w-full h-full min-h-[80vh] rounded-2xl border border-border"
              title="Bot Manager"
            />
          </div>
        </div>
      </div>
    </RequireAdmin>
  )
}
