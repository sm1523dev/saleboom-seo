export type UploadOpts = {
  contentType?: string;
  isPublic?: boolean;
  metadata?: Record<string, string>;
};

export interface StorageProvider {
  upload(key: string, data: Buffer, opts?: UploadOpts): Promise<string>;
  download(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
  getSignedUrl(key: string, expiresInSeconds: number): Promise<string>;
  exists(key: string): Promise<boolean>;
  list(prefix: string): Promise<string[]>;
}
