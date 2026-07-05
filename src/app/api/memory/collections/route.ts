import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { memoryService } from "@/lib/services/memory.service";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  const collections = await memoryService.listCollections(session.user.id);
  return NextResponse.json(collections);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  const body = await req.json();
  const col = await memoryService.createCollection(session.user.id, body.name, body.description, body.tags);
  return NextResponse.json(col, { status: 201 });
}
