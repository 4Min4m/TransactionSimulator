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

    output "frontend_bucket_name" {
      description = "The name of the S3 frontend bucket"
      value       = aws_s3_bucket.frontend_bucket.bucket
      sensitive   = false
    }