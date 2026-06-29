import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { StorageProvider, UploadOpts } from "../types";

// This single provider covers:
//   AWS S3          — omit S3_ENDPOINT
//   MinIO (local)   — S3_ENDPOINT=http://localhost:9000
//   Cloudflare R2   — S3_ENDPOINT=https://<account>.r2.cloudflarestorage.com
//   Backblaze B2    — S3_ENDPOINT=https://s3.<region>.backblazeb2.com
//   DigitalOcean    — S3_ENDPOINT=https://<region>.digitaloceanspaces.com

export class S3StorageProvider implements StorageProvider {
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly publicUrlBase?: string;

  constructor() {
    const bucket = process.env.S3_BUCKET;
    if (!bucket) throw new Error("S3_BUCKET is required for STORAGE_PROVIDER=s3");

    this.bucket = bucket;
    this.publicUrlBase = process.env.S3_PUBLIC_URL;

    const endpoint = process.env.S3_ENDPOINT;
    const region = process.env.S3_REGION ?? "auto";

    this.client = new S3Client({
      region,
      ...(endpoint ? { endpoint, forcePathStyle: true } : {}),
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY ?? process.env.AWS_ACCESS_KEY_ID ?? "",
        secretAccessKey:
          process.env.S3_SECRET_KEY ?? process.env.AWS_SECRET_ACCESS_KEY ?? "",
      },
    });
  }

  async upload(key: string, data: Buffer, opts?: UploadOpts): Promise<string> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: data,
        ContentType: opts?.contentType ?? "application/octet-stream",
        ACL: opts?.isPublic ? "public-read" : "private",
        Metadata: opts?.metadata,
      })
    );

    if (this.publicUrlBase) return `${this.publicUrlBase}/${key}`;
    return key;
  }

  async download(key: string): Promise<Buffer> {
    const result = await this.client.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: key })
    );
    const chunks: Uint8Array[] = [];
    for await (const chunk of result.Body as AsyncIterable<Uint8Array>) {
      chunks.push(chunk);
    }
    return Buffer.concat(chunks);
  }

  async delete(key: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: key })
    );
  }

  async getSignedUrl(key: string, expiresInSeconds: number): Promise<string> {
    const command = new GetObjectCommand({ Bucket: this.bucket, Key: key });
    return getSignedUrl(this.client, command, { expiresIn: expiresInSeconds });
  }

  async exists(key: string): Promise<boolean> {
    try {
      await this.client.send(
        new HeadObjectCommand({ Bucket: this.bucket, Key: key })
      );
      return true;
    } catch {
      return false;
    }
  }

  async list(prefix: string): Promise<string[]> {
    const result = await this.client.send(
      new ListObjectsV2Command({ Bucket: this.bucket, Prefix: prefix })
    );
    return (result.Contents ?? []).map((obj) => obj.Key ?? "").filter(Boolean);
  }
}
