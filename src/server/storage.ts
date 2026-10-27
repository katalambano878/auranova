import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { prisma } from "./db";

const types: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

function sniff(bytes: Buffer) {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.length >= 4 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "image/png";
  if (bytes.length >= 6 && bytes.subarray(0, 6).toString() === "GIF87a") return "image/gif";
  if (bytes.length >= 6 && bytes.subarray(0, 6).toString() === "GIF89a") return "image/gif";
  if (bytes.length >= 12 && bytes.subarray(0, 4).toString() === "RIFF" && bytes.subarray(8, 12).toString() === "WEBP") return "image/webp";
  return null;
}

function s3() {
  if (!process.env.S3_BUCKET || !process.env.S3_ACCESS_KEY_ID || !process.env.S3_SECRET_ACCESS_KEY || !process.env.S3_REGION) {
    return null;
  }
  return new S3Client({
    region: process.env.S3_REGION,
    endpoint: process.env.S3_ENDPOINT || undefined,
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID,
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
    },
    forcePathStyle: Boolean(process.env.S3_ENDPOINT),
  });
}

export async function saveImage(file: File, alt: string) {
  if (file.size <= 0 || file.size > 5 * 1024 * 1024) {
    return { ok: false as const, error: "Images must be between 1 byte and 5 MB." };
  }
  const bytes = Buffer.from(await file.arrayBuffer());
  const mime = sniff(bytes);
  if (!mime || !types[mime]) return { ok: false as const, error: "Upload a JPEG, PNG, WebP, or GIF." };
  const key = `uploads/${new Date().getUTCFullYear()}/${crypto.randomUUID()}.${types[mime]}`;
  const client = s3();
  let url = `/storage/${key}`;
  if (client && process.env.S3_BUCKET) {
    await client.send(new PutObjectCommand({
      Bucket: process.env.S3_BUCKET,
      Key: key,
      Body: bytes,
      ContentType: mime,
    }));
    url = `${(process.env.S3_PUBLIC_URL || "").replace(/\/$/, "")}/${key}`;
  } else {
    const root = path.resolve(/*turbopackIgnore: true*/ process.env.STORAGE_ROOT || "./storage");
    const target = path.resolve(root, key);
    if (!target.startsWith(root)) return { ok: false as const, error: "Invalid storage path." };
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, bytes);
  }
  const asset = await prisma.mediaAsset.create({ data: { url, alt, mime, size: bytes.length } });
  return { ok: true as const, asset };
}
