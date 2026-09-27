# File and object storage

Status: S3 is selected as the object-storage API. Development uses
`chipaau/minio`, the project's exact fork of MinIO. Provider integration and
file-handling behavior are not implemented.

## Boundary

Use object storage for file bytes; define application records and authorization
separately when a concrete file use case is approved. Keep provider-specific
configuration and SDK types out of domain code. Do not invent a generic storage
framework before a real consumer establishes the required operations.

## Open decisions

- Production S3-compatible provider and self-hosted configuration.
- Go SDK and the exact S3 features required. Recommendation: evaluate the
  [official AWS SDK for Go v2](https://docs.aws.amazon.com/sdk-for-go/v2/developer-guide/welcome.html)
  first rather than implementing request signing, retries, multipart transfer,
  and protocol behavior ourselves. This remains a recommendation until approved.
- Object key format, tenant isolation, metadata, content-type/size constraints,
  and any malware scanning requirements.
- Upload/download flow, authorization checks, and whether short-lived signed URLs
  are appropriate.
- Encryption, integrity validation, retention, versioning, deletion, and backup.

Decide these against the first concrete file use case; the [decision register](../decisions/README.md)
tracks the open questions.
