import { NextResponse } from "next/server";
import { GoogleAIFileManager } from "@google/generative-ai/server";
import type { UploadResponse } from "@/types/chat";

const PDF_MIME = "application/pdf";

export async function POST(request: Request): Promise<NextResponse> {
  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json(
      { error: "GEMINI_API_KEY is not configured" },
      { status: 500 }
    );
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      { error: "Invalid form data" },
      { status: 400 }
    );
  }

  const file = formData.get("file");
  if (!file || !(file instanceof File)) {
    return NextResponse.json(
      { error: "Missing or invalid file in form field 'file'" },
      { status: 400 }
    );
  }

  if (file.type !== PDF_MIME) {
    return NextResponse.json(
      { error: "Only application/pdf is allowed" },
      { status: 422 }
    );
  }

  const displayName = file.name.replace(/\.[^.]+$/, "") || file.name;

  let buffer: Buffer;
  try {
    const arrayBuffer = await file.arrayBuffer();
    buffer = Buffer.from(arrayBuffer);
  } catch (e) {
    console.error("[upload] Failed to read file buffer:", e);
    return NextResponse.json(
      { error: "Failed to read file" },
      { status: 500 }
    );
  }

  const fileManager = new GoogleAIFileManager(process.env.GEMINI_API_KEY);
  try {
    const result = await fileManager.uploadFile(buffer, {
      mimeType: PDF_MIME,
      displayName,
    });
    const f = result.file;
    const body: UploadResponse = {
      fileUri: f.uri,
      displayName: f.displayName ?? displayName,
      filename: file.name,
      mimeType: PDF_MIME,
    };
    return NextResponse.json(body, { status: 200 });
  } catch (e) {
    console.error("[upload] Gemini File API error:", e);
    const message = e instanceof Error ? e.message : "Upload failed";
    return NextResponse.json(
      { error: message },
      { status: 502 }
    );
  }
}
