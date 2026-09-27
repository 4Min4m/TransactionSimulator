# terraform/lambda_api_gateway.tf
# This file defines the Lambda function and API Gateway for the backend.

# IAM Role for Lambda
resource "aws_iam_role" "lambda_role" {
  name = "lambda_role"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Effect    = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
    }]
  })
}

# Attach basic execution policy to Lambda role
resource "aws_iam_role_policy_attachment" "lambda_policy" {
  role       = aws_iam_role.lambda_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

# X-Ray: allow the Lambdas to publish trace segments.
resource "aws_iam_role_policy_attachment" "lambda_xray" {
  role       = aws_iam_role.lambda_role.name
  policy_arn = "arn:aws:iam::aws:policy/AWSXRayDaemonWriteAccess"
}

# Secrets Manager: allow the Lambdas to read ONLY the JWT secret at runtime.
resource "aws_iam_role_policy" "lambda_secrets" {
  name = "lambda-read-jwt-secret"
  role = aws_iam_role.lambda_role.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = "secretsmanager:GetSecretValue"
      Resource = aws_secretsmanager_secret.jwt.arn
    }]
  })
}

# SQS: allow the API Lambda to enqueue batch jobs. The worker's own
# receive/delete/consume permissions are granted in batch-worker.tf.
resource "aws_iam_role_policy" "lambda_sqs_send" {
  name = "lambda-send-batch-jobs"
  role = aws_iam_role.lambda_role.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = "sqs:SendMessage"
      Resource = aws_sqs_queue.batch_jobs.arn
    }]
  })
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
      # CORS allow-list consumed by lambda.js (never "*").
      # Add extra origins (e.g. a dev URL) as a comma-separated list.
      ALLOWED_ORIGINS = "https://${aws_cloudfront_distribution.frontend.domain_name}"
      # Auth: JWT signing + admin credentials (bcrypt hash, never plaintext).
      JWT_SECRET_ARN      = aws_secretsmanager_secret.jwt.arn
      JWT_ISSUER          = "transaction-simulator"
      JWT_EXPIRES_IN      = "1h"
      ADMIN_USERNAME      = var.admin_username
      ADMIN_PASSWORD_HASH = var.admin_password_hash
      # Demo-only merchant id accepted by the simulator (was previously a
      # hardcoded, unexplained magic string in lambda.js).
      ALLOWED_MERCHANT_ID = var.allowed_merchant_id
      # Batch load-tests are processed asynchronously by a dedicated worker
      # (see batch-worker.tf) instead of blocking this request/response
      # Lambda for up to `duration_seconds`.
      SQS_QUEUE_URL = aws_sqs_queue.batch_jobs.id
    }
  }

  tracing_config {
    mode = "Active"
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

# ---------------------------------------------------------------------------
# JWT AUTH: dedicated authorizer Lambda + API Gateway TOKEN authorizer
# ---------------------------------------------------------------------------

# The authorizer runs from the SAME deployment package (authorizer.handler).
resource "aws_lambda_function" "authorizer" {
  function_name = "TransactionSimulatorAuthorizer"
  handler       = "authorizer.handler"
  runtime       = "nodejs20.x"
  timeout       = 10
  role          = aws_iam_role.lambda_role.arn

  s3_bucket        = aws_s3_bucket.lambda_code_bucket.bucket
  s3_key           = aws_s3_object.lambda_package.key
  source_code_hash = data.archive_file.lambda_zip.output_sha

  environment {
    variables = {
      JWT_SECRET_ARN = aws_secretsmanager_secret.jwt.arn
      JWT_ISSUER     = "transaction-simulator"
    }
  }

  tracing_config {
    mode = "Active"
  }

  depends_on = [aws_s3_object.lambda_package]
}

# Allow API Gateway to invoke the authorizer Lambda.
resource "aws_lambda_permission" "authorizer_invoke" {
  statement_id  = "AllowAPIGatewayInvokeAuthorizer"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.authorizer.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.api.execution_arn}/authorizers/${aws_api_gateway_authorizer.jwt.id}"
}

# TOKEN authorizer: reads the "Authorization" header and caches the result.
resource "aws_api_gateway_authorizer" "jwt" {
  name                             = "jwt-authorizer"
  rest_api_id                      = aws_api_gateway_rest_api.api.id
  type                             = "TOKEN"
  identity_source                  = "method.request.header.Authorization"
  authorizer_uri                   = aws_lambda_function.authorizer.invoke_arn
  authorizer_result_ttl_in_seconds = 300
}

# When the authorizer denies (401/403), API Gateway generates the response
# itself — so we must attach CORS headers here or the browser shows a CORS
# error instead of the real 401/403.
resource "aws_api_gateway_gateway_response" "unauthorized" {
  rest_api_id   = aws_api_gateway_rest_api.api.id
  response_type = "UNAUTHORIZED"
  status_code   = "401"

  response_parameters = {
    "gatewayresponse.header.Access-Control-Allow-Origin"  = "'https://${aws_cloudfront_distribution.frontend.domain_name}'"
    "gatewayresponse.header.Access-Control-Allow-Headers" = "'Content-Type,Authorization'"
    "gatewayresponse.header.Access-Control-Allow-Methods" = "'GET,POST,OPTIONS'"
  }
}

resource "aws_api_gateway_gateway_response" "access_denied" {
  rest_api_id   = aws_api_gateway_rest_api.api.id
  response_type = "ACCESS_DENIED"
  status_code   = "403"

  response_parameters = {
    "gatewayresponse.header.Access-Control-Allow-Origin"  = "'https://${aws_cloudfront_distribution.frontend.domain_name}'"
    "gatewayresponse.header.Access-Control-Allow-Headers" = "'Content-Type,Authorization'"
    "gatewayresponse.header.Access-Control-Allow-Methods" = "'GET,POST,OPTIONS'"
  }
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

# /api/batches/{id} — poll the status of an async batch job.
resource "aws_api_gateway_resource" "api_batches" {
  rest_api_id = aws_api_gateway_rest_api.api.id
  parent_id   = aws_api_gateway_resource.api_root.id
  path_part   = "batches"
}

resource "aws_api_gateway_resource" "api_batch_id" {
  rest_api_id = aws_api_gateway_rest_api.api.id
  parent_id   = aws_api_gateway_resource.api_batches.id
  path_part   = "{id}"
}

resource "aws_api_gateway_method" "api_batch_id_options" {
  rest_api_id   = aws_api_gateway_rest_api.api.id
  resource_id   = aws_api_gateway_resource.api_batch_id.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "lambda_integration_batch_id_options" {
  rest_api_id             = aws_api_gateway_rest_api.api.id
  resource_id             = aws_api_gateway_resource.api_batch_id.id
  http_method             = aws_api_gateway_method.api_batch_id_options.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_alias.live_alias.invoke_arn
}

resource "aws_api_gateway_method_response" "batch_id_options_200" {
  rest_api_id = aws_api_gateway_rest_api.api.id
  resource_id = aws_api_gateway_resource.api_batch_id.id
  http_method = aws_api_gateway_method.api_batch_id_options.http_method
  status_code = "200"

  response_parameters = {
    "method.response.header.Access-Control-Allow-Origin"  = true,
    "method.response.header.Access-Control-Allow-Methods" = true,
    "method.response.header.Access-Control-Allow-Headers" = true
  }
}

resource "aws_api_gateway_integration_response" "batch_id_options_response" {
  rest_api_id = aws_api_gateway_rest_api.api.id
  resource_id = aws_api_gateway_resource.api_batch_id.id
  http_method = aws_api_gateway_method.api_batch_id_options.http_method
  status_code = aws_api_gateway_method_response.batch_id_options_200.status_code

  response_parameters = {
    "method.response.header.Access-Control-Allow-Origin"  = "'https://${aws_cloudfront_distribution.frontend.domain_name}'",
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,Authorization,X-Requested-With'",
    "method.response.header.Access-Control-Allow-Methods" = "'GET,OPTIONS'"
  }

  depends_on = [
    aws_api_gateway_method.api_batch_id_options,
    aws_api_gateway_integration.lambda_integration_batch_id_options
  ]
}

resource "aws_api_gateway_method" "api_batch_id_get" {
  rest_api_id   = aws_api_gateway_rest_api.api.id
  resource_id   = aws_api_gateway_resource.api_batch_id.id
  http_method   = "GET"
  authorization = "CUSTOM"
  authorizer_id = aws_api_gateway_authorizer.jwt.id
}

resource "aws_api_gateway_integration" "lambda_integration_batch_id_get" {
  rest_api_id             = aws_api_gateway_rest_api.api.id
  resource_id             = aws_api_gateway_resource.api_batch_id.id
  http_method             = aws_api_gateway_method.api_batch_id_get.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_alias.live_alias.invoke_arn
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
  authorization = "CUSTOM"
  authorizer_id = aws_api_gateway_authorizer.jwt.id
}

resource "aws_api_gateway_method" "api_process_batch_post" {
  rest_api_id   = aws_api_gateway_rest_api.api.id
  resource_id   = aws_api_gateway_resource.api_process_batch.id
  http_method   = "POST"
  authorization = "CUSTOM"
  authorizer_id = aws_api_gateway_authorizer.jwt.id
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
  authorization = "CUSTOM"
  authorizer_id = aws_api_gateway_authorizer.jwt.id
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
  rest_api_id = aws_api_gateway_rest_api.api.id
  resource_id = aws_api_gateway_resource.api_login.id
  http_method = aws_api_gateway_method.api_login_options.http_method
  status_code = "200"

  response_parameters = {
    "method.response.header.Access-Control-Allow-Origin"  = true,
    "method.response.header.Access-Control-Allow-Methods" = true,
    "method.response.header.Access-Control-Allow-Headers" = true
  }
}

resource "aws_api_gateway_integration_response" "login_options_response" {
  rest_api_id = aws_api_gateway_rest_api.api.id
  resource_id = aws_api_gateway_resource.api_login.id
  http_method = aws_api_gateway_method.api_login_options.http_method
  status_code = aws_api_gateway_method_response.login_options_200.status_code

  response_parameters = {
    "method.response.header.Access-Control-Allow-Origin"  = "'https://${aws_cloudfront_distribution.frontend.domain_name}'",
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'",
    "method.response.header.Access-Control-Allow-Methods" = "'GET,POST,OPTIONS'"
  }

  depends_on = [
    aws_api_gateway_method.api_login_options,
    aws_api_gateway_integration.lambda_integration_login_options
  ]
}

resource "aws_api_gateway_method_response" "transactions_options_200" {
  rest_api_id = aws_api_gateway_rest_api.api.id
  resource_id = aws_api_gateway_resource.api_transactions.id
  http_method = aws_api_gateway_method.api_transactions_options.http_method
  status_code = "200"

  response_parameters = {
    "method.response.header.Access-Control-Allow-Origin"  = true,
    "method.response.header.Access-Control-Allow-Methods" = true,
    "method.response.header.Access-Control-Allow-Headers" = true
  }
}

resource "aws_api_gateway_method_response" "process_batch_options_200" {
  rest_api_id = aws_api_gateway_rest_api.api.id
  resource_id = aws_api_gateway_resource.api_process_batch.id
  http_method = aws_api_gateway_method.api_process_batch_options.http_method
  status_code = "200"

  response_parameters = {
    "method.response.header.Access-Control-Allow-Origin"  = true,
    "method.response.header.Access-Control-Allow-Methods" = true,
    "method.response.header.Access-Control-Allow-Headers" = true
  }
}

resource "aws_api_gateway_integration_response" "transactions_options_response" {
  rest_api_id = aws_api_gateway_rest_api.api.id
  resource_id = aws_api_gateway_resource.api_transactions.id
  http_method = aws_api_gateway_method.api_transactions_options.http_method
  status_code = aws_api_gateway_method_response.transactions_options_200.status_code

  response_parameters = {
    "method.response.header.Access-Control-Allow-Origin"  = "'https://${aws_cloudfront_distribution.frontend.domain_name}'",
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'",
    "method.response.header.Access-Control-Allow-Methods" = "'GET,POST,OPTIONS'"
  }

  depends_on = [
    aws_api_gateway_method.api_transactions_options,
    aws_api_gateway_integration.lambda_integration_transactions_options
  ]
}

resource "aws_api_gateway_integration_response" "process_batch_options_response" {
  rest_api_id = aws_api_gateway_rest_api.api.id
  resource_id = aws_api_gateway_resource.api_process_batch.id
  http_method = aws_api_gateway_method.api_process_batch_options.http_method
  status_code = aws_api_gateway_method_response.process_batch_options_200.status_code

  response_parameters = {
    "method.response.header.Access-Control-Allow-Origin"  = "'https://${aws_cloudfront_distribution.frontend.domain_name}'",
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
    aws_api_gateway_integration.lambda_integration_batch_id_get,
    aws_api_gateway_integration.lambda_integration_batch_id_options,
    aws_api_gateway_integration_response.login_options_response,
    aws_api_gateway_integration_response.transactions_options_response,
    aws_api_gateway_integration_response.process_batch_options_response,
    aws_api_gateway_integration_response.batch_id_options_response
  ]

  rest_api_id = aws_api_gateway_rest_api.api.id

  # Force a new deployment whenever auth wiring or methods change, otherwise
  # API Gateway keeps serving the old (unprotected) configuration.
  triggers = {
    redeploy = sha1(jsonencode([
      aws_api_gateway_authorizer.jwt.id,
      aws_api_gateway_method.api_transactions_get.authorization,
      aws_api_gateway_method.api_transactions_post.authorization,
      aws_api_gateway_method.api_process_batch_post.authorization,
      aws_api_gateway_method.api_batch_id_get.authorization,
    ]))
  }

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_api_gateway_stage" "prod_stage" {
  rest_api_id   = aws_api_gateway_rest_api.api.id
  deployment_id = aws_api_gateway_deployment.api_deployment.id
  stage_name    = "prod"

  xray_tracing_enabled = true

  access_log_settings {
    destination_arn = aws_cloudwatch_log_group.api_access_logs.arn
    format = jsonencode({
      requestId      = "$context.requestId"
      ip             = "$context.identity.sourceIp"
      requestTime    = "$context.requestTime"
      httpMethod     = "$context.httpMethod"
      routeKey       = "$context.resourcePath"
      status         = "$context.status"
      protocol       = "$context.protocol"
      responseLength = "$context.responseLength"
      integrationErr = "$context.integration.error"
      authorizerErr  = "$context.authorizer.error"
    })
  }

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

# Method-level execution logging is intentionally OFF: structured access
# logs already flow to aws_cloudwatch_log_group.api_access_logs (in
# observability.tf) via `access_log_settings` on the stage, which is what
# the CloudWatch dashboard and alarms read from. Turning execution logging
# on too would just duplicate that data at extra cost.
resource "aws_api_gateway_method_settings" "all" {
  rest_api_id = aws_api_gateway_rest_api.api.id
  stage_name  = aws_api_gateway_stage.prod_stage.stage_name
  method_path = "*/*"

  settings {
    metrics_enabled    = true
    logging_level      = "OFF"
    data_trace_enabled = false

    # Throttling to blunt DoS / runaway load-test traffic on every route.
    throttling_rate_limit  = 10
    throttling_burst_limit = 20
  }

  depends_on = [aws_api_gateway_account.api_gateway_account]
}

# NOTE: a second, unused `aws_cloudwatch_log_group` used to be declared here
# (named "API-Gateway-Execution-Logs_...") — it was never referenced by the
# stage's access_log_settings (which points at api_access_logs in
# observability.tf) or by anything else. It has been removed; see
# docs/FIXES_AND_CHANGES_fa.md.

