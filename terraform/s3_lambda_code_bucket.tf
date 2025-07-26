# Data source to get current AWS account ID and region dynamically
data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

# Data source to reference the S3 bucket created by the pipeline's 'CreateInfrastructureBuckets' stage
data "aws_s3_bucket" "lambda_code_bucket_ref" {
  bucket = "transaction-simulator-lambda-code-${data.aws_caller_identity.current.account_id}-${data.aws_region.current.name}"
}

# You can then use this data source to reference the bucket's ARN, name, etc.,
# in other Terraform resources, e.g., for IAM policies or Lambda function configurations.
# output "lambda_code_bucket_name" { # Keep this output if you still need it in pipeline
#   description = "Name of the S3 bucket storing Lambda deployment packages."
#   value       = data.aws_s3_bucket.lambda_code_bucket_ref.bucket
# }