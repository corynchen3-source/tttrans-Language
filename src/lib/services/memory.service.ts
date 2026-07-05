import { prisma } from "@/lib/prisma";

export const memoryService = {
  /** 浏览记忆库 */
  async list(userId: string, params: { search?: string; cursor?: string; limit?: number }) {
    const { search, cursor, limit = 20 } = params;
    const where: any = { userId };
    if (search) {
      where.OR = [
        { sourceText: { contains: search } },
        { targetText: { contains: search } },
        { notes: { contains: search } },
      ];
    }

    const items = await prisma.memoryEntry.findMany({
      where,
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

  /** 添加记忆条目 */
  async create(userId: string, input: {
    sourceText: string;
    targetText: string;
    sourceLang?: string;
    targetLang?: string;
    sourceRef?: string;
    sourceType?: string;
    rating?: number;
    tags?: string[];
    notes?: string;
  }) {
    return prisma.memoryEntry.create({
      data: {
        userId,
        sourceText: input.sourceText,
        targetText: input.targetText,
        sourceLang: input.sourceLang || "en",
        targetLang: input.targetLang || "zh",
        sourceRef: input.sourceRef,
        sourceType: input.sourceType || "manual",
        rating: input.rating || 0,
        tags: JSON.stringify(input.tags || []),
        notes: input.notes,
      },
    });
  },

  /** 从语料库导入到记忆库 */
  async importFromCorpus(userId: string, corpusEntryId: string) {
    const entry = await prisma.corpusEntry.findUnique({ where: { id: corpusEntryId } });
    if (!entry) throw new Error("语料不存在");

    const existing = await prisma.memoryEntry.findFirst({
      where: { userId, sourceRef: corpusEntryId, sourceType: "corpus_import" },
    });
    if (existing) return { entry: existing, isNew: false };

    const created = await this.create(userId, {
      sourceText: entry.sourceText,
      targetText: entry.targetText,
      sourceLang: entry.sourceLang,
      targetLang: entry.targetLang,
      sourceRef: corpusEntryId,
      sourceType: "corpus_import",
    });

    // 增加引用计数
    await prisma.corpusEntry.update({
      where: { id: corpusEntryId },
      data: { usageCount: { increment: 1 } },
    });

    return { entry: created, isNew: true };
  },

  /** 更新记忆条目 */
  async update(id: string, userId: string, input: Record<string, any>) {
    const existing = await prisma.memoryEntry.findUnique({ where: { id } });
    if (!existing || existing.userId !== userId) throw new Error("无权修改");
    const data: any = {};
    if (input.sourceText !== undefined) data.sourceText = input.sourceText;
    if (input.targetText !== undefined) data.targetText = input.targetText;
    if (input.rating !== undefined) data.rating = input.rating;
    if (input.tags !== undefined) data.tags = JSON.stringify(input.tags);
    if (input.notes !== undefined) data.notes = input.notes;
    return prisma.memoryEntry.update({ where: { id }, data });
  },

  /** 删除记忆条目 */
  async delete(id: string, userId: string) {
    const existing = await prisma.memoryEntry.findUnique({ where: { id } });
    if (!existing || existing.userId !== userId) throw new Error("无权删除");
    return prisma.memoryEntry.delete({ where: { id } });
  },

  // ============================================================
  // 记忆包管理
  // ============================================================

  async listCollections(ownerId: string) {
    return prisma.memoryCollection.findMany({
      where: { ownerId },
      include: { _count: { select: { items: true } } },
      orderBy: { createdAt: "desc" },
    });
  },

  async createCollection(ownerId: string, name: string, description?: string, tags?: string[]) {
    return prisma.memoryCollection.create({
      data: { ownerId, name, description, tags: JSON.stringify(tags || []) },
    });
  },

  async deleteCollection(id: string, ownerId: string) {
    const coll = await prisma.memoryCollection.findUnique({ where: { id } });
    if (!coll || coll.ownerId !== ownerId) throw new Error("无权删除");
    return prisma.memoryCollection.delete({ where: { id } });
  },

  async addToCollection(collectionId: string, entryId: string, ownerId: string) {
    const coll = await prisma.memoryCollection.findUnique({ where: { id: collectionId } });
    if (!coll || coll.ownerId !== ownerId) throw new Error("无权操作");
    return prisma.memoryCollectionItem.create({ data: { collectionId, entryId } });
  },

  async getCollectionEntries(collectionId: string) {
    const items = await prisma.memoryCollectionItem.findMany({
      where: { collectionId },
      include: { entry: true },
      orderBy: { addedAt: "desc" },
    });
    return items.map((i) => i.entry);
  },
};
