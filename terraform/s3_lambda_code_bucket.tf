# Data source to get current AWS account ID and region dynamically
data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

# Create or reference the S3 bucket for Lambda code
resource "aws_s3_bucket" "lambda_code_bucket" {
  bucket = "transaction-simulator-lambda-code-${data.aws_caller_identity.current.account_id}-${data.aws_region.current.name}"

  tags = {
    Name        = "TransactionSimulatorLambdaCode"
    Project     = "TransactionSimulator"
    Environment = "Production"
  }
}

# Configure server-side encryption for the Lambda code bucket
resource "aws_s3_bucket_server_side_encryption_configuration" "lambda_code_bucket_encryption" {
  bucket = aws_s3_bucket.lambda_code_bucket.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

# Block public access to the Lambda code bucket
resource "aws_s3_bucket_public_access_block" "lambda_code_bucket_pab" {
  bucket = aws_s3_bucket.lambda_code_bucket.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# Bucket versioning for Lambda code bucket
resource "aws_s3_bucket_versioning" "lambda_code_bucket_versioning" {
  bucket = aws_s3_bucket.lambda_code_bucket.id

  versioning_configuration {
    status = "Enabled"
  }
}

# Package the Lambda function code from the local directory
# Ensure the GitHub Actions workflow installs dependencies before running Terraform
# so that node_modules are included in the archive when necessary.
data "archive_file" "lambda_zip" {
  type        = "zip"
  source_dir  = "${path.module}/../lambda"
  output_path = "${path.module}/.terraform/lambda.zip"
}

# Upload the packaged Lambda artifact to the managed bucket
resource "aws_s3_object" "lambda_package" {
  bucket = aws_s3_bucket.lambda_code_bucket.id
  key    = "lambda-packages/${data.archive_file.lambda_zip.output_sha}.zip"
  source = data.archive_file.lambda_zip.output_path
  etag   = filemd5(data.archive_file.lambda_zip.output_path)
}

# Output the bucket name and key for reference
output "lambda_code_bucket_name" {
  description = "Name of the S3 bucket storing Lambda deployment packages."
  value       = aws_s3_bucket.lambda_code_bucket.bucket
}

output "lambda_code_bucket_arn" {
  description = "ARN of the S3 bucket storing Lambda deployment packages."
  value       = aws_s3_bucket.lambda_code_bucket.arn
}

output "lambda_package_key" {
  description = "Key of the Lambda package uploaded to S3."
  value       = aws_s3_object.lambda_package.key
}
