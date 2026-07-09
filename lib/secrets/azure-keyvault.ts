// Azure Key Vault secrets adapter — Strategy 4
// Activate with: SECRETS_PROVIDER=azure-keyvault
//
// Required env vars:
//   AZURE_KEY_VAULT_URL=https://<vault-name>.vault.azure.net/
//   AZURE_KEY_VAULT_KEY_NAME=saleboomseo-kek   (RSA key in AKV, default: saleboomseo-kek)
//
// Auth: DefaultAzureCredential (managed identity on Azure, CLI creds locally)
//
// Install when deploying:
//   npm install @azure/keyvault-keys @azure/identity

import { randomBytes, createCipheriv, createDecipheriv } from "crypto";

const ALG = "aes-256-gcm";

interface AkvBlob {
  v: number;
  provider: "azure-keyvault";
  wrappedDek: string;
  encryptedKey: string;
  keyNonce: string;
  keyTag: string;
}

async function getClient() {
  const url = process.env.AZURE_KEY_VAULT_URL;
  const keyName = process.env.AZURE_KEY_VAULT_KEY_NAME ?? "saleboomseo-kek";
  if (!url) throw new Error("AZURE_KEY_VAULT_URL required for SECRETS_PROVIDER=azure-keyvault");

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { KeyClient, CryptographyClient } = require("@azure/keyvault-keys");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { DefaultAzureCredential } = require("@azure/identity");

  const credential = new DefaultAzureCredential();
  const key = await new KeyClient(url, credential).getKey(keyName);
  return new CryptographyClient(key.id, credential);
}

export async function akvEncrypt(plaintext: string): Promise<string> {
  const dek = randomBytes(32);
  const client = await getClient();
  const { result: wrappedDek } = await client.wrapKey("RSA-OAEP-256", dek);

  const nonce = randomBytes(12);
  const cipher = createCipheriv(ALG, dek, nonce);
  const ciphertext = Buffer.concat([cipher.update(Buffer.from(plaintext, "utf8")), cipher.final()]);

  const blob: AkvBlob = {
    v: 1,
    provider: "azure-keyvault",
    wrappedDek: Buffer.from(wrappedDek).toString("base64"),
    encryptedKey: ciphertext.toString("hex"),
    keyNonce: nonce.toString("hex"),
    keyTag: cipher.getAuthTag().toString("hex"),
  };

  return JSON.stringify(blob);
}

export async function akvDecrypt(blobJson: string): Promise<string> {
  const blob: AkvBlob = JSON.parse(blobJson);
  const client = await getClient();
  const { result: dek } = await client.unwrapKey("RSA-OAEP-256", Buffer.from(blob.wrappedDek, "base64"));

  const decipher = createDecipheriv(ALG, Buffer.from(dek), Buffer.from(blob.keyNonce, "hex"));
  decipher.setAuthTag(Buffer.from(blob.keyTag, "hex"));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(blob.encryptedKey, "hex")),
    decipher.final(),
  ]);

  return plaintext.toString("utf8");
}
