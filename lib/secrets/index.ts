export async function encryptSecret(plaintext: string): Promise<string> {
  if (process.env.SECRETS_PROVIDER === "azure-keyvault") {
    const { akvEncrypt } = await import("./azure-keyvault");
    return akvEncrypt(plaintext);
  }
  const { envelopeEncrypt } = await import("./envelope");
  return envelopeEncrypt(plaintext);
}

export async function decryptSecret(blob: string): Promise<string> {
  if (process.env.SECRETS_PROVIDER === "azure-keyvault") {
    const { akvDecrypt } = await import("./azure-keyvault");
    return akvDecrypt(blob);
  }
  const { envelopeDecrypt } = await import("./envelope");
  return envelopeDecrypt(blob);
}
