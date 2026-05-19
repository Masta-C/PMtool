// TODO Phase 1 — Health check endpoint
import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({ status: 'ok', project: 'pmtool-3f8db', phase: 0 })
}
