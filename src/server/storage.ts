import { nid, supabaseAdmin, throwIf } from "./db";

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

export async function saveImage(file: File, alt: string) {
  if (file.size <= 0 || file.size > 5 * 1024 * 1024) {
    return { ok: false as const, error: "Images must be between 1 byte and 5 MB." };
  }
  const bytes = Buffer.from(await file.arrayBuffer());
  const mime = sniff(bytes);
  if (!mime || !types[mime]) return { ok: false as const, error: "Upload a JPEG, PNG, WebP, or GIF." };
  const key = `uploads/${new Date().getUTCFullYear()}/${crypto.randomUUID()}.${types[mime]}`;
  const admin = supabaseAdmin();
  const uploaded = await admin.storage.from("media").upload(key, bytes, { contentType: mime, upsert: false });
  if (uploaded.error) return { ok: false as const, error: "The image could not be stored." };
  const { data } = admin.storage.from("media").getPublicUrl(key);
  const url = data.publicUrl;
  const row = await admin.from("MediaAsset").insert({ id: nid(), url, alt, mime, size: bytes.length }).select().single();
  throwIf(row.error);
  return { ok: true as const, asset: row.data };
}
