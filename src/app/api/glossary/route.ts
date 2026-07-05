import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { glossaryService } from "@/lib/services/glossary.service";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await auth();
  const { searchParams } = req.nextUrl;
  const result = await glossaryService.list({
    search: searchParams.get("search") || undefined,
    domain: searchParams.get("domain") || undefined,
    ownerId: session?.user?.id,
    cursor: searchParams.get("cursor") || undefined,
    limit: parseInt(searchParams.get("limit") || "20"),
  });
  return NextResponse.json(result);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }
  const body = await req.json();
  const term = await glossaryService.create(session.user.id, body);
  return NextResponse.json(term, { status: 201 });
}
