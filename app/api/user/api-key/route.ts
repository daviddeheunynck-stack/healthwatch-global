export const dynamic = "force-dynamic";

const GONE = { error: "Deprecated. Manage API keys at /account." };

export async function GET() {
  return Response.json(GONE, { status: 410 });
}

export async function POST() {
  return Response.json(GONE, { status: 410 });
}
