# Output the API Gateway invoke URL for the backend
output "api_gateway_invoke_url" {
  description = "The invoke URL for the API Gateway"
  value       = aws_api_gateway_stage.prod_stage.invoke_url
  sensitive   = false
}

# Output the S3 Frontend website URL
output "frontend_website_url" {
  description = "The URL of the S3 static website"
  value       = aws_s3_bucket_website_configuration.frontend_website.website_endpoint
  sensitive   = false
}

# Output the S3 bucket name for reference
output "frontend_bucket_name" {
  description = "The name of the S3 frontend bucket"
  value       = aws_s3_bucket.frontend_bucket.bucket
  sensitive   = false
}

# Output the Lambda Function Name for CodePipeline/CodeDeploy reference
output "lambda_function_name" {
  description = "The name of the Lambda function for CodeDeploy."
  value       = aws_lambda_function.api_lambda.function_name
  # This export name should match what CodePipeline expects
  # For cross-stack references, this output can be imported as "TransactionSimulatorLambdaFunctionName"
}

# Ensure these are also outputs if you want them visible/importable
 output "lambda_live_alias_arn" {
   description = "The ARN of the Lambda LIVE alias"
   value       = aws_lambda_alias.live_alias.arn
 }

 output "lambda_beta_alias_arn" {
   description = "The ARN of the Lambda BETA alias"
   value       = aws_lambda_alias.beta_alias.arn
 }