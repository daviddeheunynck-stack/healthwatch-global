import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

// GET  /api/notifications?offset=N  — 30 notifications for current user, paginated
// PATCH /api/notifications           — mark all as read
// DELETE /api/notifications?id=X    — delete one

const PAGE_SIZE = 30;

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const offset = parseInt(req.nextUrl.searchParams.get("offset") ?? "0", 10) || 0;

  const { data } = await supabase
    .from("alert_notifications")
    .select("id, type, title, body, outbreak_id, read_at, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .range(offset, offset + PAGE_SIZE);

  const all = data ?? [];
  const hasMore = all.length > PAGE_SIZE;
  const notifications = all.slice(0, PAGE_SIZE);
  return NextResponse.json({ notifications, hasMore });
}

export async function PATCH(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const id = req.nextUrl.searchParams.get("id");
  const now = new Date().toISOString();

  if (id) {
    await supabase
      .from("alert_notifications")
      .update({ read_at: now })
      .eq("id", id)
      .eq("user_id", user.id)
      .is("read_at", null);
  } else {
    await supabase
      .from("alert_notifications")
      .update({ read_at: now })
      .eq("user_id", user.id)
      .is("read_at", null);
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await supabase
    .from("alert_notifications")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  return NextResponse.json({ ok: true });
}
