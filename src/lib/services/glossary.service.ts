import { prisma } from "@/lib/prisma";

export interface GlossaryQueryParams {
  search?: string;
  domain?: string;
  sourceLang?: string;
  targetLang?: string;
  visibility?: string;
  ownerId?: string;
  cursor?: string;
  limit?: number;
}

export const glossaryService = {
  /** 搜索/浏览术语 */
  async list(params: GlossaryQueryParams) {
    const { search, domain, visibility, ownerId, cursor, limit = 20 } = params;

    const where: any = {};
    if (ownerId) {
      where.OR = [
        { visibility: "public" },
        { ownerId, visibility: "private" },
        { ownerId, visibility: "team" },
      ];
    } else {
      where.visibility = "public";
    }
    if (domain) where.domain = domain;
    if (search) {
      where.AND = [
        {
          OR: [
            { sourceTerm: { contains: search } },
            { targetTerm: { contains: search } },
            { definition: { contains: search } },
          ],
        },
      ];
    }

    const items = await prisma.glossaryTerm.findMany({
      where,
      include: {
        owner: { select: { id: true, username: true, displayName: true } },
      },
      orderBy: { createdAt: "desc" },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });

    const hasMore = items.length > limit;
    return {
      items: hasMore ? items.slice(0, limit) : items,
      nextCursor: hasMore ? items[items.length - 1].id : undefined,
      hasMore,
    };
  },

  /** 创建术语 */
  async create(ownerId: string, input: {
    sourceTerm: string;
    targetTerm: string;
    domain?: string;
    definition?: string;
    examples?: string[];
    visibility?: string;
    teamId?: string;
  }) {
    return prisma.glossaryTerm.create({
      data: {
        ownerId,
        sourceTerm: input.sourceTerm,
        targetTerm: input.targetTerm,
        domain: input.domain,
        definition: input.definition,
        examples: JSON.stringify(input.examples || []),
        visibility: input.visibility || "private",
        teamId: input.teamId,
      },
    });
  },

  /** 更新术语 */
  async update(id: string, ownerId: string, input: Record<string, any>) {
    const existing = await prisma.glossaryTerm.findUnique({ where: { id } });
    if (!existing || existing.ownerId !== ownerId) {
      throw new Error("无权修改此术语");
    }
    const data: any = {};
    if (input.sourceTerm !== undefined) data.sourceTerm = input.sourceTerm;
    if (input.targetTerm !== undefined) data.targetTerm = input.targetTerm;
    if (input.domain !== undefined) data.domain = input.domain;
    if (input.definition !== undefined) data.definition = input.definition;
    if (input.examples !== undefined) data.examples = JSON.stringify(input.examples);
    if (input.visibility !== undefined) data.visibility = input.visibility;
    return prisma.glossaryTerm.update({ where: { id }, data });
  },

  /** 删除术语 */
  async delete(id: string, ownerId: string) {
    const existing = await prisma.glossaryTerm.findUnique({ where: { id } });
    if (!existing || existing.ownerId !== ownerId) {
      throw new Error("无权删除此术语");
    }
    return prisma.glossaryTerm.delete({ where: { id } });
  },

  /** 批量导入 */
  async bulkImport(ownerId: string, terms: Array<{
    sourceTerm: string;
    targetTerm: string;
    domain?: string;
    definition?: string;
  }>) {
    let created = 0;
    let skipped = 0;
    for (const term of terms) {
      const existing = await prisma.glossaryTerm.findFirst({
        where: { ownerId, sourceTerm: term.sourceTerm, targetTerm: term.targetTerm },
      });
      if (existing) { skipped++; continue; }
      await this.create(ownerId, term);
      created++;
    }
    return { created, skipped, total: terms.length };
  },

  // ============================================================
  // 术语包管理
  // ============================================================

  async listCollections(ownerId: string) {
    return prisma.glossaryCollection.findMany({
      where: { ownerId },
      include: { _count: { select: { items: true } } },
      orderBy: { createdAt: "desc" },
    });
  },

  async createCollection(ownerId: string, name: string, description?: string, tags?: string[]) {
    return prisma.glossaryCollection.create({
      data: { ownerId, name, description, tags: JSON.stringify(tags || []) },
    });
  },

  async deleteCollection(id: string, ownerId: string) {
    const coll = await prisma.glossaryCollection.findUnique({ where: { id } });
    if (!coll || coll.ownerId !== ownerId) throw new Error("无权删除");
    return prisma.glossaryCollection.delete({ where: { id } });
  },

  async addToCollection(collectionId: string, termId: string, ownerId: string) {
    const coll = await prisma.glossaryCollection.findUnique({ where: { id: collectionId } });
    if (!coll || coll.ownerId !== ownerId) throw new Error("无权操作");
    return prisma.glossaryCollectionItem.create({ data: { collectionId, termId } });
  },

  async getCollectionTerms(collectionId: string) {
    const items = await prisma.glossaryCollectionItem.findMany({
      where: { collectionId },
      include: { term: { include: { owner: { select: { username: true, displayName: true } } } } },
      orderBy: { addedAt: "desc" },
    });
    return items.map((i) => i.term);
  },
};
