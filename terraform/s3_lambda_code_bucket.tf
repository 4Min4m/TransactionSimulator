# S3 Bucket to store Lambda deployment packages
resource "aws_s3_bucket" "lambda_code_bucket" {
  bucket = "transaction-simulator-lambda-code-${data.aws_caller_identity.current.account_id}-${data.aws_region.current.name}"

  # Enable versioning to keep track of different Lambda code versions
  versioning {
    enabled = true
  }

  # Block public access for security
  acl = "private" # Ensure this bucket is private

  tags = {
    Project     = "TransactionSimulator"
    Environment = "Production"
    ManagedBy   = "Terraform"
  }
}

# Data source to get current AWS account ID and region dynamically
data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

# Output the bucket name for reference in other parts of the pipeline (optional, but good for debugging/visibility)
output "lambda_code_bucket_name" {
  description = "Name of the S3 bucket storing Lambda deployment packages."
  value       = aws_s3_bucket.lambda_code_bucket.bucket
}