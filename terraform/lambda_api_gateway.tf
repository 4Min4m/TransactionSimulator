# terraform/lambda_api_gateway.tf
# This file defines the Lambda function and API Gateway for the backend.

# IAM Role for Lambda
resource "aws_iam_role" "lambda_role" {
  name = "lambda_role"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
    }]
  })
}

# Attach basic execution policy to Lambda role
resource "aws_iam_role_policy_attachment" "lambda_policy" {
  role       = aws_iam_role.lambda_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

# AWS Lambda Function Definition
# 'publish = true' ensures a new Lambda version is created on every code change
resource "aws_lambda_function" "api_lambda" {
  function_name = "TransactionSimulatorAPI"
  handler       = "lambda.handler"
  runtime       = "nodejs20.x"
  timeout       = 60
  role          = aws_iam_role.lambda_role.arn

  s3_bucket        = aws_s3_bucket.lambda_code_bucket.bucket
  s3_key           = aws_s3_object.lambda_package.key
  source_code_hash = data.archive_file.lambda_zip.output_sha
  publish          = true

  environment {
    variables = {
      SUPABASE_URL = var.supabase_url
      SUPABASE_KEY = var.supabase_key
    }
  }

  depends_on = [aws_s3_object.lambda_package]
}

# AWS Lambda Alias for Production Traffic (e.g., 'LIVE')
# This alias will be managed by traffic-shifting automation in the deployment pipeline.
resource "aws_lambda_alias" "live_alias" {
  name          = "LIVE"
  function_name = aws_lambda_function.api_lambda.function_name
  description   = "Alias for live production traffic."

  # Set an initial version on create, but allow the pipeline to manage future updates.
  function_version = aws_lambda_function.api_lambda.version

  lifecycle {
    ignore_changes = [function_version, routing_config]
  }
}

# AWS Lambda Alias for Pre-production/Testing (e.g., 'BETA' or 'GREEN')
# This alias can be used for testing new versions before full rollout.
resource "aws_lambda_alias" "beta_alias" {
  name             = "BETA"
  function_name    = aws_lambda_function.api_lambda.function_name
  function_version = aws_lambda_function.api_lambda.version
  description      = "Alias for beta/pre-production testing."
}

# API Gateway Configuration (pointing to the LIVE alias)
resource "aws_lambda_permission" "api_gateway" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_alias.live_alias.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.api.execution_arn}/*/*"
}

resource "aws_api_gateway_rest_api" "api" {
  name = "TransactionSimulatorAPI"
}

resource "aws_api_gateway_resource" "api_root" {
  rest_api_id = aws_api_gateway_rest_api.api.id
  parent_id   = aws_api_gateway_rest_api.api.root_resource_id
  path_part   = "api"
}

resource "aws_api_gateway_resource" "api_login" {
  rest_api_id = aws_api_gateway_rest_api.api.id
  parent_id   = aws_api_gateway_resource.api_root.id
  path_part   = "login"
}

# Add OPTIONS method for CORS preflight requests
resource "aws_api_gateway_method" "api_login_options" {
  rest_api_id   = aws_api_gateway_rest_api.api.id
  resource_id   = aws_api_gateway_resource.api_login.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "lambda_integration_login_options" {
  rest_api_id             = aws_api_gateway_rest_api.api.id
  resource_id             = aws_api_gateway_resource.api_login.id
  http_method             = aws_api_gateway_method.api_login_options.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_alias.live_alias.invoke_arn
}

resource "aws_api_gateway_method" "api_login_post" {
  rest_api_id   = aws_api_gateway_rest_api.api.id
  resource_id   = aws_api_gateway_resource.api_login.id
  http_method   = "POST"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "lambda_integration_login_post" {
  rest_api_id             = aws_api_gateway_rest_api.api.id
  resource_id             = aws_api_gateway_resource.api_login.id
  http_method             = aws_api_gateway_method.api_login_post.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_alias.live_alias.invoke_arn
}

resource "aws_api_gateway_resource" "api_transactions" {
  rest_api_id = aws_api_gateway_rest_api.api.id
  parent_id   = aws_api_gateway_resource.api_root.id
  path_part   = "transactions"
}

resource "aws_api_gateway_resource" "api_process_batch" {
  rest_api_id = aws_api_gateway_rest_api.api.id
  parent_id   = aws_api_gateway_resource.api_root.id
  path_part   = "process-batch"
}

# Add OPTIONS method for transactions endpoint
resource "aws_api_gateway_method" "api_transactions_options" {
  rest_api_id   = aws_api_gateway_rest_api.api.id
  resource_id   = aws_api_gateway_resource.api_transactions.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_method" "api_process_batch_options" {
  rest_api_id   = aws_api_gateway_rest_api.api.id
  resource_id   = aws_api_gateway_resource.api_process_batch.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "lambda_integration_transactions_options" {
  rest_api_id             = aws_api_gateway_rest_api.api.id
  resource_id             = aws_api_gateway_resource.api_transactions.id
  http_method             = aws_api_gateway_method.api_transactions_options.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_alias.live_alias.invoke_arn
}

resource "aws_api_gateway_integration" "lambda_integration_process_batch_options" {
  rest_api_id             = aws_api_gateway_rest_api.api.id
  resource_id             = aws_api_gateway_resource.api_process_batch.id
  http_method             = aws_api_gateway_method.api_process_batch_options.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_alias.live_alias.invoke_arn
}

resource "aws_api_gateway_method" "api_transactions_post" {
  rest_api_id   = aws_api_gateway_rest_api.api.id
  resource_id   = aws_api_gateway_resource.api_transactions.id
  http_method   = "POST"
  authorization = "NONE"
}

resource "aws_api_gateway_method" "api_process_batch_post" {
  rest_api_id   = aws_api_gateway_rest_api.api.id
  resource_id   = aws_api_gateway_resource.api_process_batch.id
  http_method   = "POST"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "lambda_integration_transactions_post" {
  rest_api_id             = aws_api_gateway_rest_api.api.id
  resource_id             = aws_api_gateway_resource.api_transactions.id
  http_method             = aws_api_gateway_method.api_transactions_post.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_alias.live_alias.invoke_arn
}

resource "aws_api_gateway_integration" "lambda_integration_process_batch_post" {
  rest_api_id             = aws_api_gateway_rest_api.api.id
  resource_id             = aws_api_gateway_resource.api_process_batch.id
  http_method             = aws_api_gateway_method.api_process_batch_post.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_alias.live_alias.invoke_arn
}

resource "aws_api_gateway_method" "api_transactions_get" {
  rest_api_id   = aws_api_gateway_rest_api.api.id
  resource_id   = aws_api_gateway_resource.api_transactions.id
  http_method   = "GET"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "lambda_integration_transactions_get" {
  rest_api_id             = aws_api_gateway_rest_api.api.id
  resource_id             = aws_api_gateway_resource.api_transactions.id
  http_method             = aws_api_gateway_method.api_transactions_get.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_alias.live_alias.invoke_arn
}

# Enable CORS for API Gateway
resource "aws_api_gateway_method_response" "login_options_200" {
  rest_api_id   = aws_api_gateway_rest_api.api.id
  resource_id   = aws_api_gateway_resource.api_login.id
  http_method   = aws_api_gateway_method.api_login_options.http_method
  status_code   = "200"

  response_parameters = {
    "method.response.header.Access-Control-Allow-Origin"  = true,
    "method.response.header.Access-Control-Allow-Methods" = true,
    "method.response.header.Access-Control-Allow-Headers" = true
  }
}

resource "aws_api_gateway_integration_response" "login_options_response" {
  rest_api_id         = aws_api_gateway_rest_api.api.id
  resource_id         = aws_api_gateway_resource.api_login.id
  http_method         = aws_api_gateway_method.api_login_options.http_method
  status_code         = aws_api_gateway_method_response.login_options_200.status_code

  response_parameters = {
    "method.response.header.Access-Control-Allow-Origin"  = "'*'",
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'",
    "method.response.header.Access-Control-Allow-Methods" = "'GET,POST,OPTIONS'"
  }

  depends_on = [
    aws_api_gateway_method.api_login_options,
    aws_api_gateway_integration.lambda_integration_login_options
  ]
}

resource "aws_api_gateway_method_response" "transactions_options_200" {
  rest_api_id   = aws_api_gateway_rest_api.api.id
  resource_id   = aws_api_gateway_resource.api_transactions.id
  http_method   = aws_api_gateway_method.api_transactions_options.http_method
  status_code   = "200"

  response_parameters = {
    "method.response.header.Access-Control-Allow-Origin"  = true,
    "method.response.header.Access-Control-Allow-Methods" = true,
    "method.response.header.Access-Control-Allow-Headers" = true
  }
}

resource "aws_api_gateway_method_response" "process_batch_options_200" {
  rest_api_id   = aws_api_gateway_rest_api.api.id
  resource_id   = aws_api_gateway_resource.api_process_batch.id
  http_method   = aws_api_gateway_method.api_process_batch_options.http_method
  status_code   = "200"

  response_parameters = {
    "method.response.header.Access-Control-Allow-Origin"  = true,
    "method.response.header.Access-Control-Allow-Methods" = true,
    "method.response.header.Access-Control-Allow-Headers" = true
  }
}

resource "aws_api_gateway_integration_response" "transactions_options_response" {
  rest_api_id         = aws_api_gateway_rest_api.api.id
  resource_id         = aws_api_gateway_resource.api_transactions.id
  http_method         = aws_api_gateway_method.api_transactions_options.http_method
  status_code         = aws_api_gateway_method_response.transactions_options_200.status_code

  response_parameters = {
    "method.response.header.Access-Control-Allow-Origin"  = "'*'",
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'",
    "method.response.header.Access-Control-Allow-Methods" = "'GET,POST,OPTIONS'"
  }

  depends_on = [
    aws_api_gateway_method.api_transactions_options,
    aws_api_gateway_integration.lambda_integration_transactions_options
  ]
}

resource "aws_api_gateway_integration_response" "process_batch_options_response" {
  rest_api_id         = aws_api_gateway_rest_api.api.id
  resource_id         = aws_api_gateway_resource.api_process_batch.id
  http_method         = aws_api_gateway_method.api_process_batch_options.http_method
  status_code         = aws_api_gateway_method_response.process_batch_options_200.status_code

  response_parameters = {
    "method.response.header.Access-Control-Allow-Origin"  = "'*'",
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,Authorization,X-Requested-With'",
    "method.response.header.Access-Control-Allow-Methods" = "'GET,POST,OPTIONS'"
  }

  depends_on = [
    aws_api_gateway_method.api_process_batch_options,
    aws_api_gateway_integration.lambda_integration_process_batch_options
  ]
}

resource "aws_api_gateway_deployment" "api_deployment" {
  depends_on = [
    aws_api_gateway_integration.lambda_integration_login_post,
    aws_api_gateway_integration.lambda_integration_login_options,
    aws_api_gateway_integration.lambda_integration_transactions_post,
    aws_api_gateway_integration.lambda_integration_transactions_get,
    aws_api_gateway_integration.lambda_integration_transactions_options,
    aws_api_gateway_integration.lambda_integration_process_batch_post,
    aws_api_gateway_integration.lambda_integration_process_batch_options,
    aws_api_gateway_integration_response.login_options_response,
    aws_api_gateway_integration_response.transactions_options_response,
    aws_api_gateway_integration_response.process_batch_options_response
  ]

  rest_api_id = aws_api_gateway_rest_api.api.id

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_api_gateway_stage" "prod_stage" {
  rest_api_id   = aws_api_gateway_rest_api.api.id
  deployment_id = aws_api_gateway_deployment.api_deployment.id
  stage_name    = "prod"

  depends_on = [aws_api_gateway_deployment.api_deployment]
}

# Create IAM role for API Gateway CloudWatch Logs
resource "aws_iam_role" "api_gateway_cloudwatch_role" {
  name = "api_gateway_cloudwatch_role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = {
        Service = "apigateway.amazonaws.com"
      }
    }]
  })
}

# Attach the CloudWatch Logs policy to the role
resource "aws_iam_role_policy_attachment" "api_gateway_cloudwatch" {
  role       = aws_iam_role.api_gateway_cloudwatch_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonAPIGatewayPushToCloudWatchLogs"
}

# Set the account-level setting for API Gateway CloudWatch Logs
resource "aws_api_gateway_account" "api_gateway_account" {
  cloudwatch_role_arn = aws_iam_role.api_gateway_cloudwatch_role.arn
}

# Enable CloudWatch logging for API Gateway
resource "aws_api_gateway_method_settings" "all" {
  rest_api_id = aws_api_gateway_rest_api.api.id
  stage_name  = aws_api_gateway_stage.prod_stage.stage_name
  method_path = "*/*"

  settings {
    metrics_enabled    = true
    logging_level      = "OFF"  # Disable logging
    data_trace_enabled = false
  }

  depends_on = [aws_api_gateway_account.api_gateway_account]
}

# Create CloudWatch Log Group for API Gateway
resource "aws_cloudwatch_log_group" "api_gateway_logs" {
  name              = "API-Gateway-Execution-Logs_${aws_api_gateway_rest_api.api.id}/${aws_api_gateway_stage.prod_stage.stage_name}"
  retention_in_days = 7
}

# Outputs
output "api_gateway_invoke_url" {
  description = "API Gateway invoke URL"
  value       = "${aws_api_gateway_stage.prod_stage.invoke_url}/api"
}

output "lambda_function_name" {
  description = "Lambda function name"
  value       = aws_lambda_function.api_lambda.function_name
}

output "lambda_function_arn" {
  description = "Lambda function ARN"
  value       = aws_lambda_function.api_lambda.arn
}

output "lambda_live_alias_arn" {
  description = "Lambda LIVE alias ARN"
  value       = aws_lambda_alias.live_alias.arn
}

output "api_gateway_rest_api_id" {
  description = "API Gateway REST API ID"
  value       = aws_api_gateway_rest_api.api.id
}
