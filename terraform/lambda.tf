# lambda.tf
# The three functions (API, JWT authorizer, batch worker), their aliases,
# invoke permissions, and log groups. All three deploy from the single
# package built in main.tf and differ only by handler and IAM role.

locals {
  lambda_runtime = "nodejs22.x"

  # Shared checkov suppressions for the Lambda functions (see README,
  # "Security scanning"): each is a deliberate trade-off, not an oversight.
  #   CKV_AWS_115  reserved concurrency: new accounts have a 10-concurrency
  #                quota and reservations would starve the other functions;
  #                API Gateway throttling bounds load instead.
  #   CKV_AWS_116  function DLQ: only applies to async invokes; these are
  #                invoked synchronously (API GW) or via SQS, whose own DLQ
  #                is configured in batch-worker.tf.
  #   CKV_AWS_117  VPC: there are no private resources to reach, and a NAT
  #                gateway would cost more than the whole stack.
  #   CKV_AWS_173  env var KMS: no secrets live in the environment any more;
  #                they are fetched from Secrets Manager at runtime.
  #   CKV_AWS_272  code signing: roadmap item.
}

resource "aws_cloudwatch_log_group" "lambda" {
  #checkov:skip=CKV_AWS_158:AWS-managed encryption; customer-managed KMS is a roadmap item.
  #checkov:skip=CKV_AWS_338:30-day retention is a deliberate cost choice for a demo stack.
  for_each          = local.lambda_roles
  name              = "/transaction-simulator/lambda/${each.key}"
  retention_in_days = 30
}

# --- API --------------------------------------------------------------------
resource "aws_lambda_function" "api_lambda" {
  #checkov:skip=CKV_AWS_115:See locals comment in lambda.tf.
  #checkov:skip=CKV_AWS_116:See locals comment in lambda.tf.
  #checkov:skip=CKV_AWS_117:See locals comment in lambda.tf.
  #checkov:skip=CKV_AWS_173:See locals comment in lambda.tf.
  #checkov:skip=CKV_AWS_272:See locals comment in lambda.tf.
  function_name = "TransactionSimulatorAPI"
  description   = "Login, payments, batch enqueue and status."
  handler       = "lambda.handler"
  runtime       = local.lambda_runtime
  timeout       = 30
  memory_size   = 256
  role          = aws_iam_role.lambda["api"].arn

  s3_bucket        = aws_s3_bucket.lambda_code_bucket.bucket
  s3_key           = aws_s3_object.lambda_package.key
  source_code_hash = data.archive_file.lambda_zip.output_base64sha256
  publish          = true # every code change creates a new version for CodeDeploy

  environment {
    variables = {
      SUPABASE_URL            = var.supabase_url
      SUPABASE_KEY_SECRET_ARN = aws_secretsmanager_secret.supabase_key.arn
      JWT_SECRET_ARN          = aws_secretsmanager_secret.jwt.arn
      JWT_ISSUER              = "transaction-simulator"
      JWT_EXPIRES_IN          = "1h"
      # The admin password is stored only as a bcrypt hash.
      ADMIN_USERNAME      = var.admin_username
      ADMIN_PASSWORD_HASH = var.admin_password_hash
      ALLOWED_MERCHANT_ID = var.allowed_merchant_id
      # CORS allow-list (never "*"). Comma-separated; add a dev origin here if needed.
      ALLOWED_ORIGINS = "https://${aws_cloudfront_distribution.frontend.domain_name}"
      SQS_QUEUE_URL   = aws_sqs_queue.batch_jobs.id
    }
  }

  logging_config {
    log_format = "Text"
    log_group  = aws_cloudwatch_log_group.lambda["api"].name
  }

  tracing_config {
    mode = "Active"
  }

  depends_on = [aws_iam_role_policy.api, aws_iam_role_policy_attachment.lambda_logs]
}

# LIVE serves real traffic; CodeDeploy moves it (see codedeploy.tf), so
# Terraform only sets the initial version.
resource "aws_lambda_alias" "live_alias" {
  name             = "LIVE"
  function_name    = aws_lambda_function.api_lambda.function_name
  description      = "Live production traffic (shifted by CodeDeploy)."
  function_version = aws_lambda_function.api_lambda.version

  lifecycle {
    ignore_changes = [function_version, routing_config]
  }
}

# BETA always points at the newest version, so CI can invoke it directly
# before any real traffic is shifted.
resource "aws_lambda_alias" "beta_alias" {
  name             = "BETA"
  function_name    = aws_lambda_function.api_lambda.function_name
  function_version = aws_lambda_function.api_lambda.version
  description      = "Newest version, validated in CI before the canary."
}

resource "aws_lambda_permission" "api_gateway" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.api_lambda.function_name
  qualifier     = aws_lambda_alias.live_alias.name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.api.execution_arn}/*/*"
}

# --- JWT authorizer ---------------------------------------------------------
resource "aws_lambda_function" "authorizer" {
  #checkov:skip=CKV_AWS_115:See locals comment in lambda.tf.
  #checkov:skip=CKV_AWS_116:See locals comment in lambda.tf.
  #checkov:skip=CKV_AWS_117:See locals comment in lambda.tf.
  #checkov:skip=CKV_AWS_173:See locals comment in lambda.tf.
  #checkov:skip=CKV_AWS_272:See locals comment in lambda.tf.
  function_name = "TransactionSimulatorAuthorizer"
  description   = "API Gateway TOKEN authorizer (HS256 JWT)."
  handler       = "authorizer.handler"
  runtime       = local.lambda_runtime
  timeout       = 10
  role          = aws_iam_role.lambda["authorizer"].arn

  s3_bucket        = aws_s3_bucket.lambda_code_bucket.bucket
  s3_key           = aws_s3_object.lambda_package.key
  source_code_hash = data.archive_file.lambda_zip.output_base64sha256

  environment {
    variables = {
      JWT_SECRET_ARN = aws_secretsmanager_secret.jwt.arn
      JWT_ISSUER     = "transaction-simulator"
    }
  }

  logging_config {
    log_format = "Text"
    log_group  = aws_cloudwatch_log_group.lambda["authorizer"].name
  }

  tracing_config {
    mode = "Active"
  }

  depends_on = [aws_iam_role_policy.authorizer, aws_iam_role_policy_attachment.lambda_logs]
}

resource "aws_lambda_permission" "authorizer_invoke" {
  statement_id  = "AllowAPIGatewayInvokeAuthorizer"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.authorizer.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.api.execution_arn}/authorizers/${aws_api_gateway_authorizer.jwt.id}"
}
