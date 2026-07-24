"use client"

import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { SavingsPlanPage } from "@/components/funds/savings-plan"

export default function SavingsPlanRoute() {
  const params = useSearchParams()
  const [key, setKey] = useState(params.get("month") ?? "")
  useEffect(() => setKey(params.get("month") ?? ""), [params])
  return <SavingsPlanPage key={key} initialMonth={key || undefined} />
}
