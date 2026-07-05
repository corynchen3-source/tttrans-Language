import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import crypto from "crypto";

export const dynamic = "force-dynamic";
const BASE = "https://openapi.youdao.com";

function signASR(appKey: string, salt: string, curtime: string, secret: string) {
  // 有道ASR签名: SHA256(appKey + salt + curtime + secret)，不含音频数据q
  return crypto.createHash("sha256").update(appKey + salt + curtime + secret).digest("hex");
}

function signTrans(appKey: string, q: string, salt: string, curtime: string, secret: string) {
  const input = q.length <= 20 ? q : q.slice(0, 10) + q.length + q.slice(-10);
  return crypto.createHash("sha256").update(appKey + input + salt + curtime + secret).digest("hex");
}

/** 短语音听写（一次调用，适合 ≤60s 音频） */
async function shortASR(audioBuffer: Buffer, fileName: string) {
  const appKey = process.env.YOUDAO_ASR_APPID!;
  const secret = process.env.YOUDAO_ASR_KEY!;
  const salt = crypto.randomUUID().replace(/-/g, "");
  const curtime = Math.floor(Date.now() / 1000).toString();
  const sign = signASR(appKey, salt, curtime, secret);
  const audioB64 = audioBuffer.toString("base64");

  const ext = (fileName.split(".").pop() || "mp3").toLowerCase();
  const fm: Record<string, string> = { mp3: "mp3", wav: "wav", m4a: "m4a", aac: "aac", ogg: "ogg", webm: "webm", flac: "wav" };
  const format = fm[ext] || "mp3";

  const params = new URLSearchParams({
    q: audioB64, langType: "en", appKey, salt, curtime, sign, signType: "v4",
    format, rate: "16000", channel: "1", type: "1", version: "v1",
  });

  const res = await fetch(`${BASE}/asrapi`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });
  return res.json();
}

/** 长语音转写（多步流程，任意时长） */
async function longASR(audioBuffer: Buffer, fileName: string) {
  const appKey = process.env.YOUDAO_ASR_APPID!;
  const secret = process.env.YOUDAO_ASR_KEY!;
  const ext = (fileName.split(".").pop() || "mp3").toLowerCase();
  const fm: Record<string, string> = { mp3: "mp3", wav: "wav", m4a: "m4a", aac: "aac", flac: "wav" };
  const format = fm[ext] || "mp3";

  // 1. prepare
  const s1 = crypto.randomUUID().replace(/-/g, "");
  const c1 = Math.floor(Date.now() / 1000).toString();
  const sig1 = signASR(appKey, s1, c1, secret);
  const sliceNum = Math.ceil(audioBuffer.length / (10 * 1024 * 1024));

  const pRes = await fetch(`${BASE}/api/audio/prepare`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      appKey, salt: s1, curtime: c1, sign: sig1, signType: "v4",
      langType: "en", format, sliceNum: String(sliceNum),
      fileSize: String(audioBuffer.length), needSpeakerId: "0",
    }),
  });
  const pData = await pRes.json();
  if (pData.errorCode !== "0") throw new Error("预处理失败: " + (pData.msg || pData.errorCode));
  const taskId = pData.data?.taskId;

  // 2. upload slices
  const sliceSize = 10 * 1024 * 1024;
  for (let i = 0; i < sliceNum; i++) {
    const chunk = audioBuffer.slice(i * sliceSize, Math.min((i + 1) * sliceSize, audioBuffer.length));
    const s2 = crypto.randomUUID().replace(/-/g, "");
    const c2 = Math.floor(Date.now() / 1000).toString();
    const sig2 = signASR(appKey, s2, c2, secret);
    const sid = crypto.randomUUID().replace(/-/g, "");

    const form = new FormData();
    form.append("appKey", appKey); form.append("salt", s2); form.append("curtime", c2);
    form.append("sign", sig2); form.append("signType", "v4");
    form.append("taskId", taskId); form.append("sliceId", sid);
    form.append("content", new Blob([chunk]));

    const uRes = await fetch(`${BASE}/api/audio/upload`, { method: "POST", body: form });
    const uData = await uRes.json();
    if (uData.errorCode !== "0") throw new Error(`分片${i + 1}上传失败`);
  }

  // 3. merge
  const s3 = crypto.randomUUID().replace(/-/g, "");
  const c3 = Math.floor(Date.now() / 1000).toString();
  const sig3 = signASR(appKey, s3, c3, secret);
  await fetch(`${BASE}/api/audio/merge`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ appKey, salt: s3, curtime: c3, sign: sig3, signType: "v4", taskId }),
  });

  // 4. poll for result
  for (let i = 0; i < 60; i++) {
    await new Promise(r => setTimeout(r, 3000));
    const s4 = crypto.randomUUID().replace(/-/g, "");
    const c4 = Math.floor(Date.now() / 1000).toString();
    const sig4 = signASR(appKey, s4, c4, secret);

    const gRes = await fetch(`${BASE}/api/audio/get_progress`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ appKey, salt: s4, curtime: c4, sign: sig4, signType: "v4", taskId }),
    });
    const gData = await gRes.json();
    if (gData.data?.status === 9) {
      const s5 = crypto.randomUUID().replace(/-/g, "");
      const c5 = Math.floor(Date.now() / 1000).toString();
      const sig5 = signASR(appKey, s5, c5, secret);
      const rRes = await fetch(`${BASE}/api/audio/get_result`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ appKey, salt: s5, curtime: c5, sign: sig5, signType: "v4", taskId }),
      });
      const rData = await rRes.json();
      return rData.data?.result || "";
    }
    if (gData.data?.status === 12 || gData.data?.status === 13) throw new Error("转写失败");
  }
  throw new Error("转写超时");
}

// ============ 主入口 ============

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "请先登录" }, { status: 401 });

  try {
    // 先检查是否是 JSON 批量翻译请求
    const contentType = req.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      const { texts } = await req.json();
      if (Array.isArray(texts) && texts.length > 0) {
        const translated = await batchTranslate(texts);
        return NextResponse.json({ success: true, segments: translated });
      }
      return NextResponse.json({ error: "请提供 texts 数组" }, { status: 400 });
    }

    // FormData 文件上传 → ASR
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) return NextResponse.json({ error: "请上传音频文件" }, { status: 400 });

    const buffer = Buffer.from(await file.arrayBuffer());

    // 短语音听写
    const shortRes = await shortASR(buffer, file.name);
    console.log("有道短ASR响应:", JSON.stringify(shortRes).slice(0, 200));

    if (shortRes.errorCode === "0" && shortRes.result) {
      const textResult = typeof shortRes.result === "string" ? shortRes.result : JSON.stringify(shortRes.result);
      const sentences = textResult.split(/[.!?。！？\n]/).map((s: string) => s.trim()).filter(Boolean);
      const finalSentences = sentences.length > 0 ? sentences : [textResult];
      const translated = await batchTranslate(finalSentences);
      return NextResponse.json({ success: true, segments: translated, method: "short_asr" });
    }

    // 短语音失败，尝试长语音
    if (shortRes.errorCode === "105" || shortRes.errorCode === "113" || shortRes.errorCode === "3007" || shortRes.errorCode === "3008") {
      try {
        const longResult = await longASR(buffer, file.name);
        if (longResult) {
          const sentences = longResult.split(/[.!?。！？\n]/).map((s: string) => s.trim()).filter(Boolean);
          const finalSentences = sentences.length > 0 ? sentences : [longResult];
          const translated = await batchTranslate(finalSentences);
          return NextResponse.json({ success: true, segments: translated, method: "long_asr" });
        }
      } catch (e: any) {
        console.log("长语音也失败:", e.message);
      }
    }

    const errMsg: Record<string, string> = {
      "105": "音频太短或不包含有效语音(最少需要0.5秒人声)",
      "113": "音频格式不支持，请使用 WAV 16kHz 单声道",
      "3007": "音频文件过大(超过10MB)",
      "3008": "音频时长过长(超过120秒)",
      "202": "签名验证失败",
      "3301": "语音识别失败，请检查音频质量",
    };
    console.log("有道ASR失败:", shortRes.errorCode);
    return NextResponse.json({
      error: errMsg[shortRes.errorCode] || `识别失败(错误码${shortRes.errorCode})`,
    }, { status: 200 });

  } catch (e: any) {
    console.error("youdao error:", e.message);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

async function batchTranslate(sentences: string[]): Promise<any[]> {
  const tAppKey = process.env.YOUDAO_TRANS_APPID!;
  const tSecret = process.env.YOUDAO_TRANS_KEY!;
  const segments = [];

  for (let i = 0; i < sentences.length; i++) {
    const src = sentences[i];
    let target = "";
    try {
      const ts = crypto.randomUUID().replace(/-/g, "");
      const tc = Math.floor(Date.now() / 1000).toString();
      const tsig = signTrans(tAppKey, src, ts, tc, tSecret);
      const tRes = await fetch(`${BASE}/api`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ q: src, from: "en", to: "zh-CHS", appKey: tAppKey, salt: ts, curtime: tc, sign: tsig, signType: "v3" }),
      });
      const tData = await tRes.json();
      if (tData.errorCode === "0") target = tData.translation?.[0] || "";
    } catch {}
    segments.push({ startTime: i * 5, endTime: (i + 1) * 5, sourceText: src, targetText: target });
    if (i < sentences.length - 1) await new Promise(r => setTimeout(r, 250));
  }
  return segments;
}
