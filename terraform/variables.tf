  variable "supabase_url" {
    description = "Supabase project URL"
    type        = string
    sensitive   = true
  }

  variable "supabase_key" {
    description = "Supabase anon/public key"
    type        = string
    sensitive   = true
  }

  variable "lambda_s3_bucket" {
    description = "S3 bucket containing the Lambda deployment package"
    type        = string
  }

  variable "lambda_s3_key" {
    description = "S3 key (path) to the Lambda deployment package"
    type        = string
  }