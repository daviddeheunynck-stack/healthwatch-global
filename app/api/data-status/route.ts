import { NextResponse } from "next/server";
import { getDataSourceStatus } from "@/lib/data-status";

export const revalidate = 300;

export async function GET() {
  const { sources, checked_at } = await getDataSourceStatus();
  return NextResponse.json({ sources, checked_at });
}
