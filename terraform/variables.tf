variable "supabase_url" {
  description = "Supabase URL"
  type        = string
  sensitive   = true
}

variable "supabase_key" {
  description = "Supabase Key"
  type        = string
  sensitive   = true
}

variable "lambda_s3_key" {
  description = "The S3 key (path within the bucket) of the Lambda deployment package."
  type        = string
}