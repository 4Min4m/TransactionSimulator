# main.tf
# Provider requirements are consolidated in backend.tf's single
# `terraform { required_providers { ... } }` block. Terraform allows only one
# such block per module, so this file intentionally declares no providers.
#
# CRITICAL FIX: this file used to contain nothing but the comment above.
# `lambda_api_gateway.tf` and `batch-worker.tf` both reference
# aws_s3_bucket.lambda_code_bucket, aws_s3_object.lambda_package, and
# data.archive_file.lambda_zip — but none of those three resources were
# defined ANYWHERE in the original module. `terraform validate`/`plan` would
# have failed immediately with "Reference to undeclared resource". This file
# now defines them: it zips the `lambda/` directory (which contains
# lambda.js, authorizer.js, batch-worker.js, secrets.js, shared.js and their
# node_modules) and uploads that single package to S3, which both Lambda
# functions and the authorizer deploy from. See
# docs/FIXES_AND_CHANGES_fa.md for the full list of fixes.

data "aws_region" "current" {}

# Bucket that holds the zipped Lambda deployment package(s).
resource "aws_s3_bucket" "lambda_code_bucket" {
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

# Zip the whole lambda/ directory (lambda.js, authorizer.js, batch-worker.js,
# secrets.js, shared.js, package.json, node_modules). All three Lambda
# functions (api, authorizer, batch worker) share this one package and are
# distinguished only by their `handler` setting.
data "archive_file" "lambda_zip" {
  type        = "zip"
  source_dir  = "${path.module}/../lambda"
  output_path = "${path.module}/.build/lambda.zip"
  excludes    = ["test"]
}

resource "aws_s3_object" "lambda_package" {
  bucket = aws_s3_bucket.lambda_code_bucket.id
  key    = "lambda-${data.archive_file.lambda_zip.output_sha}.zip"
  source = data.archive_file.lambda_zip.output_path
  etag   = data.archive_file.lambda_zip.output_md5
}

# Server-side encryption for the Lambda code bucket (carried over from the
# former s3_lambda_code_bucket.tf, which was removed because it defined the
# same bucket/archive/object as this file and caused duplicate-resource
# errors — see docs/ROUND2_CHANGES_fa.md, "conflict resolution").
resource "aws_s3_bucket_server_side_encryption_configuration" "lambda_code_bucket" {
  bucket = aws_s3_bucket.lambda_code_bucket.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

# Keep prior deployment packages so a bad deploy can be rolled back to an
# earlier object version if ever needed.
resource "aws_s3_bucket_versioning" "lambda_code_bucket" {
  bucket = aws_s3_bucket.lambda_code_bucket.id
  versioning_configuration {
    status = "Enabled"
  }
}
