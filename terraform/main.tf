# main.tf
# Lambda deployment package: the lambda/ directory (handlers + node_modules)
# is zipped once and uploaded to a private, versioned S3 bucket. All three
# functions deploy from this single package and differ only by handler.

data "aws_region" "current" {}

resource "aws_s3_bucket" "lambda_code_bucket" {
  #checkov:skip=CKV_AWS_18:Access logging for a build-artifact bucket is not worth a second log bucket in a demo stack.
  #checkov:skip=CKV_AWS_144:Artifacts are rebuilt from git on every deploy; cross-region replication adds cost, not recovery.
  #checkov:skip=CKV_AWS_145:SSE-S3 (AES256) is used; customer-managed KMS is a roadmap item.
  #checkov:skip=CKV2_AWS_62:No consumer for S3 event notifications.
  bucket        = "transaction-simulator-lambda-code-${random_string.suffix.result}"
  force_destroy = true
}

resource "aws_s3_bucket_public_access_block" "lambda_code_bucket" {
  bucket                  = aws_s3_bucket.lambda_code_bucket.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_server_side_encryption_configuration" "lambda_code_bucket" {
  bucket = aws_s3_bucket.lambda_code_bucket.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

# Versioning keeps earlier packages so a bad deploy can be rolled back...
resource "aws_s3_bucket_versioning" "lambda_code_bucket" {
  bucket = aws_s3_bucket.lambda_code_bucket.id
  versioning_configuration {
    status = "Enabled"
  }
}

# ...and the lifecycle rule stops those versions from accumulating forever.
resource "aws_s3_bucket_lifecycle_configuration" "lambda_code_bucket" {
  bucket = aws_s3_bucket.lambda_code_bucket.id

  rule {
    id     = "expire-old-packages"
    status = "Enabled"
    filter {}

    noncurrent_version_expiration {
      noncurrent_days = 30
    }
    abort_incomplete_multipart_upload {
      days_after_initiation = 1
    }
  }

  depends_on = [aws_s3_bucket_versioning.lambda_code_bucket]
}

data "archive_file" "lambda_zip" {
  type        = "zip"
  source_dir  = "${path.module}/../lambda"
  output_path = "${path.module}/.build/lambda.zip"
  excludes    = ["test", "package-lock.json", "local-server.js"]
}

resource "aws_s3_object" "lambda_package" {
  bucket = aws_s3_bucket.lambda_code_bucket.id
  key    = "lambda-${data.archive_file.lambda_zip.output_sha256}.zip"
  source = data.archive_file.lambda_zip.output_path
  etag   = data.archive_file.lambda_zip.output_md5
}
