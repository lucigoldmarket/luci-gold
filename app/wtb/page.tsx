"use client"

import { Sidebar } from "@/components/sidebar"
import { Header } from "@/components/header"

export default function WTBPage() {
  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <div className="flex-1 page-content flex flex-col">
        <Header />
        <iframe
          src="/wtb.html"
          className="flex-1 w-full border-0"
          style={{ height: "calc(100vh - 64px)" }}
          title="WTB Template Generator"
        />
      </div>
    </div>
  )
}
