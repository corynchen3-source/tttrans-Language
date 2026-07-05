import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { memoryService } from "@/lib/services/memory.service";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  const { searchParams } = req.nextUrl;
  const result = await memoryService.list(session.user.id, {
    search: searchParams.get("search") || undefined,
    cursor: searchParams.get("cursor") || undefined,
    limit: parseInt(searchParams.get("limit") || "20"),
  });
  return NextResponse.json(result);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  const body = await req.json();
  const entry = await memoryService.create(session.user.id, body);
  return NextResponse.json(entry, { status: 201 });
}
