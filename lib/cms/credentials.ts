import { createCipheriv, createDecipheriv, randomBytes } from "crypto";
import { storageProvider } from "@/lib/storage";
import type { CmsCredentials, CmsType } from "./types";

const ALGO = "aes-256-gcm";
const KEY_LEN = 32;
const IV_LEN = 12;
const TAG_LEN = 16;

function getDerivedKey(): Buffer {
  const pepper = process.env.PASSWORD_PEPPER;
  if (!pepper) throw new Error("PASSWORD_PEPPER is not set");
  // Pad/truncate pepper to exactly 32 bytes using SHA-256
  const { createHash } = require("crypto") as typeof import("crypto");
  return createHash("sha256").update(pepper).digest();
}

function encrypt(plaintext: string): Buffer {
  const key = getDerivedKey();
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  // Layout: [iv (12)] [tag (16)] [ciphertext]
  return Buffer.concat([iv, tag, encrypted]);
}

function decrypt(data: Buffer): string {
  const key = getDerivedKey();
  const iv = data.subarray(0, IV_LEN);
  const tag = data.subarray(IV_LEN, IV_LEN + TAG_LEN);
  const ciphertext = data.subarray(IV_LEN + TAG_LEN);
  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  return decipher.update(ciphertext) + decipher.final("utf8");
}

function storageKey(websiteId: string, cmsType: CmsType): string {
  return `cms-credentials/${websiteId}/${cmsType}.enc`;
}

export async function storeCredentials<T extends CmsType>(
  websiteId: string,
  cmsType: T,
  credentials: CmsCredentials[T],
): Promise<string> {
  const key = storageKey(websiteId, cmsType);
  const encrypted = encrypt(JSON.stringify(credentials));
  await storageProvider.upload(key, encrypted, { contentType: "application/octet-stream" });
  return key;
}

export async function loadCredentials<T extends CmsType>(
  websiteId: string,
  cmsType: T,
): Promise<CmsCredentials[T] | null> {
  const key = storageKey(websiteId, cmsType);
  const exists = await storageProvider.exists(key);
  if (!exists) return null;
  const data = await storageProvider.download(key);
  return JSON.parse(decrypt(data)) as CmsCredentials[T];
}

export async function deleteCredentials(websiteId: string, cmsType: CmsType): Promise<void> {
  await storageProvider.delete(storageKey(websiteId, cmsType));
}
