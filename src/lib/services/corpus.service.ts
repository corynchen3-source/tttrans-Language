import { prisma } from "@/lib/prisma";
import { createHash } from "crypto";

// ============================================================
// 工具函数
// ============================================================

/** 计算内容哈希（用于去重） */
function computeHash(sourceText: string, targetText: string): string {
  const normalized = `${sourceText.trim().toLowerCase()}|||${targetText.trim().toLowerCase()}`;
  return createHash("sha256").update(normalized).digest("hex");
}

/** 提取语料条目中的译文关键词（用于匹配补充） */
function extractKeywords(text: string): string[] {
  // 简单分词：按逗号、分号、顿号分割
  return text
    .split(/[,;，；、\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

// ============================================================
// 类型
// ============================================================

export interface CorpusQueryParams {
  search?: string;
  domain?: string;
  sourceLang?: string;
  targetLang?: string;
  visibility?: string;
  ownerId?: string;
  teamId?: string;
  cursor?: string;
  limit?: number;
}

export interface CreateCorpusInput {
  sourceText: string;
  targetText: string;
  sourceLang?: string;
  targetLang?: string;
  domain?: string;
  tags?: string[];
  visibility?: string;
  teamId?: string;
  metadata?: Record<string, unknown>;
}

// ============================================================
// CRUD
// ============================================================

export const corpusService = {
  /** 搜索/浏览语料 */
  async list(params: CorpusQueryParams) {
    const { search, domain, sourceLang, targetLang, visibility, ownerId, cursor, limit = 20 } = params;

    const where: any = {};

    // 可见性过滤：公开的大家都能看，私密的只有自己
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
    if (sourceLang) where.sourceLang = sourceLang;
    if (targetLang) where.targetLang = targetLang;

    // 全文搜索
    if (search) {
      where.OR = [
        { sourceText: { contains: search } },
        { targetText: { contains: search } },
      ];
    }

    const entries = await prisma.corpusEntry.findMany({
      where,
      include: {
        owner: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
      },
      orderBy: { createdAt: "desc" },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });

    const hasMore = entries.length > limit;
    const items = hasMore ? entries.slice(0, limit) : entries;
    const nextCursor = hasMore ? items[items.length - 1].id : undefined;

    return { items, nextCursor, hasMore };
  },

  /** 获取单条语料 */
  async getById(id: string) {
    return prisma.corpusEntry.findUnique({
      where: { id },
      include: {
        owner: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
        team: { select: { id: true, name: true, slug: true } },
      },
    });
  },

  /** 创建语料条目 */
  async create(ownerId: string, input: CreateCorpusInput) {
    const contentHash = computeHash(input.sourceText, input.targetText);

    // 检查去重
    const existing = await prisma.corpusEntry.findUnique({
      where: { contentHash },
    });

    if (existing) {
      return { entry: existing, isNew: false };
    }

    const entry = await prisma.corpusEntry.create({
      data: {
        ownerId,
        sourceText: input.sourceText,
        targetText: input.targetText,
        sourceLang: input.sourceLang || "en",
        targetLang: input.targetLang || "zh",
        domain: input.domain,
        tags: JSON.stringify(input.tags || []),
        visibility: input.visibility || "private",
        teamId: input.teamId,
        contentHash,
        metadata: JSON.stringify(input.metadata || {}),
      },
      include: {
        owner: { select: { id: true, username: true, displayName: true } },
      },
    });

    return { entry, isNew: true };
  },

  /** 更新语料条目 */
  async update(id: string, ownerId: string, input: Partial<CreateCorpusInput>) {
    const existing = await prisma.corpusEntry.findUnique({ where: { id } });
    if (!existing || existing.ownerId !== ownerId) {
      throw new Error("无权修改此语料");
    }

    const data: any = {};
    if (input.sourceText !== undefined) data.sourceText = input.sourceText;
    if (input.targetText !== undefined) data.targetText = input.targetText;
    if (input.domain !== undefined) data.domain = input.domain;
    if (input.tags !== undefined) data.tags = JSON.stringify(input.tags);
    if (input.visibility !== undefined) data.visibility = input.visibility;
    if (input.teamId !== undefined) data.teamId = input.teamId;

    // 如果修改了文本内容，重新计算哈希
    if (input.sourceText && input.targetText) {
      data.contentHash = computeHash(input.sourceText, input.targetText);
    }

    return prisma.corpusEntry.update({
      where: { id },
      data,
      include: {
        owner: { select: { id: true, username: true, displayName: true } },
      },
    });
  },

  /** 删除语料条目 */
  async delete(id: string, ownerId: string) {
    const existing = await prisma.corpusEntry.findUnique({ where: { id } });
    if (!existing || existing.ownerId !== ownerId) {
      throw new Error("无权删除此语料");
    }
    return prisma.corpusEntry.delete({ where: { id } });
  },

  // ============================================================
  // 批量导入
  // ============================================================

  /** 批量导入语料（自动去重） */
  async bulkImport(ownerId: string, entries: CreateCorpusInput[]) {
    let created = 0;
    let skipped = 0;
    const results: { entry: any; isNew: boolean }[] = [];

    for (const input of entries) {
      const result = await this.create(ownerId, input);
      results.push(result);
      if (result.isNew) created++;
      else skipped++;
    }

    return { created, skipped, total: entries.length, results };
  },

  // ============================================================
  // 公私互通
  // ============================================================

  /**
   * 从公开库导入到私人库
   * 自动检测并补充缺失的译文
   */
  async importFromPublic(ownerId: string, entryId: string, collectionId?: string) {
    const source = await prisma.corpusEntry.findUnique({ where: { id: entryId } });
    if (!source) throw new Error("语料不存在");
    if (source.visibility !== "public" && source.ownerId !== ownerId) {
      throw new Error("无权访问此语料");
    }

    // 查找用户私人库中是否有相同源文本的语料
    const existing = await prisma.corpusEntry.findFirst({
      where: {
        ownerId,
        sourceText: source.sourceText,
      },
    });

    if (existing) {
      // 已存在同源文本的语料 → 检查译文是否需要补充
      const existingTranslations = extractKeywords(existing.targetText);
      const newTranslations = extractKeywords(source.targetText);
      const missing = newTranslations.filter(
        (t) => !existingTranslations.includes(t)
      );

      if (missing.length > 0) {
        // 补充缺失的译文
        const mergedTarget = existing.targetText + "；" + missing.join("；");
        const updated = await prisma.corpusEntry.update({
          where: { id: existing.id },
          data: {
            targetText: mergedTarget,
            contentHash: computeHash(existing.sourceText, mergedTarget),
          },
        });
        return { entry: updated, action: "merged", addedTranslations: missing };
      }

      return { entry: existing, action: "skipped", addedTranslations: [] };
    }

    // 不存在 → 创建新的私人副本
    const contentHash = computeHash(source.sourceText, source.targetText);
    const newEntry = await prisma.corpusEntry.create({
      data: {
        ownerId,
        sourceText: source.sourceText,
        targetText: source.targetText,
        sourceLang: source.sourceLang,
        targetLang: source.targetLang,
        domain: source.domain,
        tags: source.tags,
        visibility: "private",
        contentHash,
        metadata: JSON.stringify({ importedFrom: entryId, importedAt: new Date().toISOString() }),
      },
    });

    // 如果指定了集合，添加进去
    if (collectionId) {
      await prisma.corpusCollectionItem.create({
        data: { collectionId, entryId: newEntry.id },
      });
    }

    return { entry: newEntry, action: "created", addedTranslations: [] };
  },

  // ============================================================
  // 语料库集合管理
  // ============================================================

  /** 获取用户的语料库集合列表 */
  async listCollections(ownerId: string, tagFilter?: string) {
    const where: any = { ownerId };
    if (tagFilter) {
      where.tags = { contains: tagFilter };
    }
    return prisma.corpusCollection.findMany({
      where,
      include: {
        _count: { select: { items: true } },
      },
      orderBy: { createdAt: "desc" },
    });
  },

  /** 创建语料库集合（文件夹） */
  async createCollection(
    ownerId: string,
    name: string,
    description?: string,
    tags?: string[],
    visibility = "private"
  ) {
    return prisma.corpusCollection.create({
      data: {
        ownerId,
        name,
        description,
        tags: JSON.stringify(tags || []),
        visibility,
      },
    });
  },

  /** 更新集合信息 */
  async updateCollection(
    id: string,
    ownerId: string,
    data: { name?: string; description?: string; tags?: string[]; visibility?: string }
  ) {
    const coll = await prisma.corpusCollection.findUnique({ where: { id } });
    if (!coll || coll.ownerId !== ownerId) throw new Error("无权修改此文件夹");
    const update: any = {};
    if (data.name !== undefined) update.name = data.name;
    if (data.description !== undefined) update.description = data.description;
    if (data.tags !== undefined) update.tags = JSON.stringify(data.tags);
    if (data.visibility !== undefined) update.visibility = data.visibility;
    return prisma.corpusCollection.update({ where: { id }, data: update });
  },

  /** 删除集合 */
  async deleteCollection(id: string, ownerId: string) {
    const coll = await prisma.corpusCollection.findUnique({ where: { id } });
    if (!coll || coll.ownerId !== ownerId) throw new Error("无权删除此文件夹");
    return prisma.corpusCollection.delete({ where: { id } });
  },

  /** 添加语料到集合 */
  async addToCollection(collectionId: string, entryId: string, ownerId: string) {
    const collection = await prisma.corpusCollection.findUnique({ where: { id: collectionId } });
    if (!collection || collection.ownerId !== ownerId) {
      throw new Error("无权操作此集合");
    }

    return prisma.corpusCollectionItem.create({
      data: { collectionId, entryId },
    });
  },

  /** 获取集合中的语料 */
  async getCollectionEntries(collectionId: string, params: { cursor?: string; limit?: number }) {
    const { cursor, limit = 20 } = params;

    const items = await prisma.corpusCollectionItem.findMany({
      where: { collectionId },
      include: {
        entry: {
          include: {
            owner: { select: { id: true, username: true, displayName: true } },
          },
        },
      },
      orderBy: { addedAt: "desc" },
      take: limit + 1,
      ...(cursor ? { cursor: { collectionId_entryId: { collectionId, entryId: cursor } }, skip: 1 } : {}),
    });

    const hasMore = items.length > limit;
    const entries = (hasMore ? items.slice(0, limit) : items).map((i) => i.entry);

    return { entries, hasMore };
  },

  /** 获取统计 */
  async getStats() {
    const [totalEntries, totalPublic, domains] = await Promise.all([
      prisma.corpusEntry.count(),
      prisma.corpusEntry.count({ where: { visibility: "public" } }),
      prisma.corpusEntry.groupBy({
        by: ["domain"],
        _count: true,
        orderBy: { _count: { domain: "desc" } },
        take: 20,
      }),
    ]);

    return {
      totalEntries,
      totalPublic,
      topDomains: domains.filter((d) => d.domain).map((d) => ({ domain: d.domain!, count: d._count })),
    };
  },
};
