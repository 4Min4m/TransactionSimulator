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

# Output the bucket name for use in other resources
output "lambda_code_bucket_name" {
  description = "Name of the S3 bucket storing Lambda deployment packages."
  value       = aws_s3_bucket.lambda_code_bucket.bucket
}

output "lambda_code_bucket_arn" {
  description = "ARN of the S3 bucket storing Lambda deployment packages."
  value       = aws_s3_bucket.lambda_code_bucket.arn
}