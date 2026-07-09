import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALG = "aes-256-gcm";
const VERSION = 1;

interface EnvelopeBlob {
  v: number;
  alg: string;
  encryptedDek: string;
  dekNonce: string;
  dekTag: string;
  encryptedKey: string;
  keyNonce: string;
  keyTag: string;
}

function getKek(): Buffer {
  const hex = process.env.KEY_ENCRYPTION_KEY;
  if (!hex) throw new Error("KEY_ENCRYPTION_KEY is required (32 bytes hex) — set SECRETS_PROVIDER=local");
  const buf = Buffer.from(hex, "hex");
  if (buf.length !== 32) throw new Error("KEY_ENCRYPTION_KEY must be exactly 32 bytes (64 hex chars)");
  return buf;
}

function gcmEncrypt(key: Buffer, plaintext: Buffer) {
  const nonce = randomBytes(12);
  const cipher = createCipheriv(ALG, key, nonce);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  return { ciphertext, nonce, tag: cipher.getAuthTag() };
}

function gcmDecrypt(key: Buffer, ciphertext: Buffer, nonce: Buffer, tag: Buffer): Buffer {
  const decipher = createDecipheriv(ALG, key, nonce);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

export async function envelopeEncrypt(plaintext: string): Promise<string> {
  const kek = getKek();
  const dek = randomBytes(32);

  const enc = gcmEncrypt(dek, Buffer.from(plaintext, "utf8"));
  const wrapped = gcmEncrypt(kek, dek);

  const blob: EnvelopeBlob = {
    v: VERSION,
    alg: ALG,
    encryptedDek: wrapped.ciphertext.toString("hex"),
    dekNonce: wrapped.nonce.toString("hex"),
    dekTag: wrapped.tag.toString("hex"),
    encryptedKey: enc.ciphertext.toString("hex"),
    keyNonce: enc.nonce.toString("hex"),
    keyTag: enc.tag.toString("hex"),
  };

  return JSON.stringify(blob);
}

export async function envelopeDecrypt(blobJson: string): Promise<string> {
  const kek = getKek();
  const blob: EnvelopeBlob = JSON.parse(blobJson);

  const dek = gcmDecrypt(
    kek,
    Buffer.from(blob.encryptedDek, "hex"),
    Buffer.from(blob.dekNonce, "hex"),
    Buffer.from(blob.dekTag, "hex"),
  );

  const plaintext = gcmDecrypt(
    dek,
    Buffer.from(blob.encryptedKey, "hex"),
    Buffer.from(blob.keyNonce, "hex"),
    Buffer.from(blob.keyTag, "hex"),
  );

  return plaintext.toString("utf8");
}
