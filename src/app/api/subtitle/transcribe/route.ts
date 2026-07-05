import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import crypto from "crypto";
import WebSocket from "ws";

export const dynamic = "force-dynamic";

// 科大讯飞 语音听写 WebSocket API
function getIatUrl() {
  const apiKey = process.env.XFYUN_API_KEY;
  const apiSecret = process.env.XFYUN_API_SECRET;
  const appId = process.env.XFYUN_APP_ID;
  if (!appId || !apiKey || !apiSecret) {
    throw new Error("请配置讯飞密钥");
  }

  const host = "iat-api.xfyun.cn";
  const path = "/v2/iat";
  const date = new Date().toUTCString();
  const signatureOrigin = `host: ${host}\ndate: ${date}\nGET ${path} HTTP/1.1`;
  const signature = crypto.createHmac("sha256", apiSecret).update(signatureOrigin).digest("base64");
  const authorization = Buffer.from(
    `api_key="${apiKey}", algorithm="hmac-sha256", headers="host date request-line", signature="${signature}"`
  ).toString("base64");

  return {
    url: `wss://${host}${path}?authorization=${encodeURIComponent(authorization)}&date=${encodeURIComponent(date)}&host=${host}`,
    appId,
  };
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) return NextResponse.json({ error: "请上传音频文件" }, { status: 400 });

    const buffer = Buffer.from(await file.arrayBuffer());
    const { url, appId } = getIatUrl();

    // 通过 WebSocket 连接讯飞语音听写
    const segments = await new Promise<any[]>((resolve, reject) => {
      const ws = new WebSocket(url);
      const results: any[] = [];
      let isReady = false;

      ws.on("open", () => {
        // 发送参数帧
        ws.send(JSON.stringify({
          common: { app_id: appId },
          business: {
            language: "en",
            domain: "iat",
            accent: "mandarin",
            punc: "1",
            vad_eos: 3000,
            dwa: "wpgs",
          },
          data: {
            status: 0,
            format: "audio/L16;rate=16000",
            encoding: "raw",
            audio: "",
          },
        }));

        // 简单 PCM 转换：16位有符号，单声道，16000Hz
        // 发送音频数据（分片发送）
        const chunkSize = 1280; // 1280 bytes per chunk for iFlytek
        let offset = 0;
        let status = 0; // 0=first, 1=continue, 2=last

        const sendNextChunk = () => {
          if (offset >= buffer.length) {
            status = 2; // last frame
            ws.send(JSON.stringify({
              data: { status: 2, format: "audio/L16;rate=16000", encoding: "raw", audio: "" },
            }));
            return;
          }

          const end = Math.min(offset + chunkSize, buffer.length);
          const chunk = buffer.slice(offset, end);
          const audioBase64 = chunk.toString("base64");

          ws.send(JSON.stringify({
            data: { status, format: "audio/L16;rate=16000", encoding: "raw", audio: audioBase64 },
          }));

          status = 1; // continue
          offset = end;

          if (offset < buffer.length) {
            setTimeout(sendNextChunk, 40); // 40ms between chunks
          } else {
            // Last chunk
            ws.send(JSON.stringify({
              data: { status: 2, format: "audio/L16;rate=16000", encoding: "raw", audio: "" },
            }));
          }
        };

        setTimeout(sendNextChunk, 200);
      });

      ws.on("message", (rawData: Buffer) => {
        try {
          const msg = JSON.parse(rawData.toString());
          if (msg.code !== 0) {
            reject(new Error(msg.message || `讯飞错误码: ${msg.code}`));
            ws.close();
            return;
          }

          // 解析识别结果
          if (msg.data?.result) {
            const text = typeof msg.data.result === "string"
              ? msg.data.result
              : parseIatResult(msg.data.result);

            if (text) {
              const start = results.length > 0 ? results[results.length - 1].endTime : 0;
              const duration = text.split(/\s+/).length * 0.3;
              results.push({
                startTime: Math.round(start * 10) / 10,
                endTime: Math.round((start + Math.max(duration, 1)) * 10) / 10,
                sourceText: text.trim(),
                targetText: "",
              });
            }
          }

          // 检查是否结束
          if (msg.data?.status === 2) {
            ws.close();
          }
        } catch {}
      });

      ws.on("close", () => resolve(results));
      ws.on("error", (e) => reject(e));

      // 超时保护
      setTimeout(() => {
        if (ws.readyState === ws.OPEN) ws.close();
        if (results.length === 0) reject(new Error("识别超时"));
        else resolve(results);
      }, 60000);
    });

    if (segments.length === 0) {
      return NextResponse.json({ error: "未识别到语音内容" }, { status: 200 });
    }

    return NextResponse.json({ success: true, segments });
  } catch (e: any) {
    console.error("iFlytek error:", e.message);
    return NextResponse.json({ error: e.message || "识别失败" }, { status: 500 });
  }
}

function parseIatResult(result: any): string {
  if (typeof result === "string") return result;
  // iFlytek ws result format: { ws: [{ cw: [{ w: "word" }] }] }
  try {
    if (result.ws) {
      return result.ws.map((wsItem: any) =>
        (wsItem.cw || []).map((cw: any) => cw.w).join("")
      ).join("");
    }
    return JSON.stringify(result);
  } catch {
    return "";
  }
}
