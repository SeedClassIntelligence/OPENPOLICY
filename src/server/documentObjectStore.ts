import { Storage } from '@google-cloud/storage';

export interface StoredDocumentObject {
  bucket: string;
  objectName: string;
  generation: string;
}

export interface DocumentObjectStore {
  readonly quarantineBucket: string;
  putQuarantinedPdf(input: {
    objectName: string;
    bytes: Buffer;
    sha256: string;
    documentId: string;
  }): Promise<StoredDocumentObject>;
  findQuarantinedPdf(objectName: string, sha256: string): Promise<StoredDocumentObject | undefined>;
}

export class CloudPolicyDocumentStore implements DocumentObjectStore {
  private readonly storage: Storage;
  private readonly bucketName: string;

  get quarantineBucket(): string { return this.bucketName; }

  constructor(options: { storage?: Storage; bucketName?: string } = {}) {
    this.storage = options.storage || new Storage();
    this.bucketName = options.bucketName || process.env.OPENPOLICY_DOCUMENT_QUARANTINE_BUCKET?.trim() || '';
    if (!this.bucketName) {
      throw new Error('OPENPOLICY_DOCUMENT_QUARANTINE_BUCKET is required for real document ingestion.');
    }
  }

  async putQuarantinedPdf(input: {
    objectName: string;
    bytes: Buffer;
    sha256: string;
    documentId: string;
  }): Promise<StoredDocumentObject> {
    const file = this.storage.bucket(this.bucketName).file(input.objectName);
    await file.save(input.bytes, {
      resumable: false,
      validation: 'crc32c',
      contentType: 'application/pdf',
      metadata: {
        cacheControl: 'no-store',
        metadata: {
          documentId: input.documentId,
          sha256: input.sha256,
          quarantine: 'true'
        }
      },
      preconditionOpts: { ifGenerationMatch: 0 }
    });
    const [metadata] = await file.getMetadata();
    if (!metadata.generation) throw new Error('Cloud Storage did not return an immutable object generation.');
    return { bucket: this.bucketName, objectName: input.objectName, generation: String(metadata.generation) };
  }

  async findQuarantinedPdf(objectName: string, sha256: string): Promise<StoredDocumentObject | undefined> {
    const file = this.storage.bucket(this.bucketName).file(objectName);
    const [exists] = await file.exists();
    if (!exists) return undefined;
    const [metadata] = await file.getMetadata();
    if (metadata.metadata?.sha256 !== sha256 || !metadata.generation) return undefined;
    return { bucket: this.bucketName, objectName, generation: String(metadata.generation) };
  }
}
