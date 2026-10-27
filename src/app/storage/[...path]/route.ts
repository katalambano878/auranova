import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";

const types: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
};

export async function GET(_request: Request, context: { params: Promise<{ path: string[] }> }) {
  const { path: parts } = await context.params;
  if (parts.some((part) => part === ".." || part.includes("\0"))) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  const root = path.resolve(/*turbopackIgnore: true*/ process.env.STORAGE_ROOT || "./storage");
  const target = path.resolve(root, ...parts);
  if (!target.startsWith(root + path.sep) && target !== root) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  try {
    const bytes = await readFile(target);
    const ext = target.split(".").pop()?.toLowerCase() || "";
    return new NextResponse(bytes, {
      headers: {
        "Content-Type": types[ext] || "application/octet-stream",
        "Cache-Control": "public, max-age=86400",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return NextResponse.json({ ok: false }, { status: 404 });
  }
}
