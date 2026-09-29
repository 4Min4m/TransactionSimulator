# api_gateway.tf
# REST API in front of the LIVE alias of the API Lambda.
#
#   POST /api/login           public (rate-limited separately in waf.tf)
#   GET  /api/transactions    JWT
#   POST /api/transactions    JWT
#   POST /api/process-batch   JWT
#   GET  /api/batches/{id}    JWT
#
# Request bodies are validated against JSON Schema models at the gateway, so
# malformed requests are rejected before any Lambda runs (and before they
# cost anything). The Lambda re-validates everything as defence in depth.

locals {
  frontend_origin = "https://${aws_cloudfront_distribution.frontend.domain_name}"

  # CORS headers for responses API Gateway generates itself (authorizer
  # denials, validation failures, throttling). Without these the browser
  # reports a CORS error instead of the real status code.
  gateway_cors_headers = {
    "gatewayresponse.header.Access-Control-Allow-Origin"  = "'${local.frontend_origin}'"
    "gatewayresponse.header.Access-Control-Allow-Headers" = "'Content-Type,Authorization'"
    "gatewayresponse.header.Access-Control-Allow-Methods" = "'GET,POST,OPTIONS'"
    "gatewayresponse.header.Vary"                         = "'Origin'"
  }
}

resource "aws_api_gateway_rest_api" "api" {
  #checkov:skip=CKV_AWS_237:The API id is referenced by the frontend build (VITE_API_BASE_URL); it must never be replaced, so create_before_destroy does not apply.
  name        = "TransactionSimulatorAPI"
  description = "Payment transaction simulator API."
}

# --- Auth ------------------------------------------------------------------------
resource "aws_api_gateway_authorizer" "jwt" {
  name                             = "jwt-authorizer"
  rest_api_id                      = aws_api_gateway_rest_api.api.id
  type                             = "TOKEN"
  identity_source                  = "method.request.header.Authorization"
  identity_validation_expression   = "^Bearer [-_A-Za-z0-9]+\\.[-_A-Za-z0-9]+\\.[-_A-Za-z0-9]+$"
  authorizer_uri                   = aws_lambda_function.authorizer.invoke_arn
  authorizer_result_ttl_in_seconds = 300
}

# --- Gateway-generated responses ----------------------------------------------------
resource "aws_api_gateway_gateway_response" "unauthorized" {
  rest_api_id         = aws_api_gateway_rest_api.api.id
  response_type       = "UNAUTHORIZED"
  status_code         = "401"
  response_parameters = local.gateway_cors_headers
}

resource "aws_api_gateway_gateway_response" "access_denied" {
  rest_api_id         = aws_api_gateway_rest_api.api.id
  response_type       = "ACCESS_DENIED"
  status_code         = "403"
  response_parameters = local.gateway_cors_headers
}

resource "aws_api_gateway_gateway_response" "bad_request_body" {
  rest_api_id         = aws_api_gateway_rest_api.api.id
  response_type       = "BAD_REQUEST_BODY"
  status_code         = "400"
  response_parameters = local.gateway_cors_headers
  response_templates = {
    "application/json" = "{\"error\":\"Invalid request body\"}"
  }
}

resource "aws_api_gateway_gateway_response" "default_4xx" {
  rest_api_id         = aws_api_gateway_rest_api.api.id
  response_type       = "DEFAULT_4XX"
  response_parameters = local.gateway_cors_headers
}

resource "aws_api_gateway_gateway_response" "default_5xx" {
  rest_api_id         = aws_api_gateway_rest_api.api.id
  response_type       = "DEFAULT_5XX"
  response_parameters = local.gateway_cors_headers
}

# --- Request validation -----------------------------------------------------------------
resource "aws_api_gateway_request_validator" "body" {
  name                  = "validate-body"
  rest_api_id           = aws_api_gateway_rest_api.api.id
  validate_request_body = true
}

resource "aws_api_gateway_request_validator" "params" {
  name                        = "validate-params"
  rest_api_id                 = aws_api_gateway_rest_api.api.id
  validate_request_parameters = true
}

resource "aws_api_gateway_model" "login" {
  rest_api_id  = aws_api_gateway_rest_api.api.id
  name         = "LoginRequest"
  content_type = "application/json"
  schema = jsonencode({
    "$schema"            = "http://json-schema.org/draft-04/schema#"
    type                 = "object"
    required             = ["username", "password"]
    additionalProperties = false
    properties = {
      username = { type = "string", minLength = 1, maxLength = 128 }
      password = { type = "string", minLength = 1, maxLength = 128 }
    }
  })
}

resource "aws_api_gateway_model" "transaction" {
  rest_api_id  = aws_api_gateway_rest_api.api.id
  name         = "TransactionRequest"
  content_type = "application/json"
  schema = jsonencode({
    "$schema"            = "http://json-schema.org/draft-04/schema#"
    type                 = "object"
    required             = ["merchant_id", "order_id", "amount", "card_number"]
    additionalProperties = false
    properties = {
      merchant_id = { type = "string", minLength = 1, maxLength = 15 }
      order_id    = { type = "string", pattern = "^[A-Za-z0-9._:-]{1,64}$" }
      amount      = { type = "number", minimum = 0, exclusiveMinimum = true, maximum = 1000000 }
      card_number = { type = "string", pattern = "^[0-9 -]{12,23}$" }
      currency    = { type = "string", enum = ["USD", "EUR", "GBP"] }
    }
  })
}

resource "aws_api_gateway_model" "batch" {
  rest_api_id  = aws_api_gateway_rest_api.api.id
  name         = "BatchRequest"
  content_type = "application/json"
  schema = jsonencode({
    "$schema"            = "http://json-schema.org/draft-04/schema#"
    type                 = "object"
    required             = ["total_transactions", "total_amount", "duration_seconds"]
    additionalProperties = false
    properties = {
      total_transactions = { type = "integer", minimum = 1, maximum = 1000 }
      total_amount       = { type = "number", minimum = 0, exclusiveMinimum = true, maximum = 1000000 }
      duration_seconds   = { type = "number", minimum = 0, maximum = 300 }
      merchant_id        = { type = "string", minLength = 1, maxLength = 15 }
    }
  })
}

# --- Resources ------------------------------------------------------------------------------
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

# --- Methods ----------------------------------------------------------------------------------
# CORS preflights (OPTIONS) are unauthenticated by design: browsers never
# send credentials on a preflight. The Lambda answers them from its origin
# allow-list.

resource "aws_api_gateway_method" "api_login_options" {
  #checkov:skip=CKV2_AWS_53:CORS preflight has no body or parameters to validate.
  rest_api_id   = aws_api_gateway_rest_api.api.id
  resource_id   = aws_api_gateway_resource.api_login.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_method" "api_login_post" {
  #checkov:skip=CKV_AWS_59:The login endpoint must be public; it is protected by a dedicated WAF rate limit and bcrypt.
  rest_api_id          = aws_api_gateway_rest_api.api.id
  resource_id          = aws_api_gateway_resource.api_login.id
  http_method          = "POST"
  authorization        = "NONE"
  request_validator_id = aws_api_gateway_request_validator.body.id
  request_models       = { "application/json" = aws_api_gateway_model.login.name }
}

resource "aws_api_gateway_method" "api_transactions_options" {
  #checkov:skip=CKV2_AWS_53:CORS preflight has no body or parameters to validate.
  rest_api_id   = aws_api_gateway_rest_api.api.id
  resource_id   = aws_api_gateway_resource.api_transactions.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_method" "api_transactions_get" {
  rest_api_id          = aws_api_gateway_rest_api.api.id
  resource_id          = aws_api_gateway_resource.api_transactions.id
  http_method          = "GET"
  authorization        = "CUSTOM"
  authorizer_id        = aws_api_gateway_authorizer.jwt.id
  request_validator_id = aws_api_gateway_request_validator.params.id
  request_parameters = {
    "method.request.querystring.limit"  = false
    "method.request.querystring.offset" = false
  }
}

resource "aws_api_gateway_method" "api_transactions_post" {
  rest_api_id          = aws_api_gateway_rest_api.api.id
  resource_id          = aws_api_gateway_resource.api_transactions.id
  http_method          = "POST"
  authorization        = "CUSTOM"
  authorizer_id        = aws_api_gateway_authorizer.jwt.id
  request_validator_id = aws_api_gateway_request_validator.body.id
  request_models       = { "application/json" = aws_api_gateway_model.transaction.name }
}

resource "aws_api_gateway_method" "api_process_batch_options" {
  #checkov:skip=CKV2_AWS_53:CORS preflight has no body or parameters to validate.
  rest_api_id   = aws_api_gateway_rest_api.api.id
  resource_id   = aws_api_gateway_resource.api_process_batch.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_method" "api_process_batch_post" {
  rest_api_id          = aws_api_gateway_rest_api.api.id
  resource_id          = aws_api_gateway_resource.api_process_batch.id
  http_method          = "POST"
  authorization        = "CUSTOM"
  authorizer_id        = aws_api_gateway_authorizer.jwt.id
  request_validator_id = aws_api_gateway_request_validator.body.id
  request_models       = { "application/json" = aws_api_gateway_model.batch.name }
}

resource "aws_api_gateway_method" "api_batch_id_options" {
  #checkov:skip=CKV2_AWS_53:CORS preflight has no body or parameters to validate.
  rest_api_id   = aws_api_gateway_rest_api.api.id
  resource_id   = aws_api_gateway_resource.api_batch_id.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_method" "api_batch_id_get" {
  rest_api_id          = aws_api_gateway_rest_api.api.id
  resource_id          = aws_api_gateway_resource.api_batch_id.id
  http_method          = "GET"
  authorization        = "CUSTOM"
  authorizer_id        = aws_api_gateway_authorizer.jwt.id
  request_validator_id = aws_api_gateway_request_validator.params.id
  request_parameters   = { "method.request.path.id" = true }
}

# --- Integrations (all AWS_PROXY to the LIVE alias) --------------------------------------------
locals {
  api_methods = {
    login_options        = aws_api_gateway_method.api_login_options
    login_post           = aws_api_gateway_method.api_login_post
    transactions_options = aws_api_gateway_method.api_transactions_options
    transactions_get     = aws_api_gateway_method.api_transactions_get
    transactions_post    = aws_api_gateway_method.api_transactions_post
    process_batch_opts   = aws_api_gateway_method.api_process_batch_options
    process_batch_post   = aws_api_gateway_method.api_process_batch_post
    batch_id_options     = aws_api_gateway_method.api_batch_id_options
    batch_id_get         = aws_api_gateway_method.api_batch_id_get
  }
}

resource "aws_api_gateway_integration" "lambda_integration_login_options" {
  rest_api_id             = aws_api_gateway_rest_api.api.id
  resource_id             = aws_api_gateway_resource.api_login.id
  http_method             = aws_api_gateway_method.api_login_options.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_alias.live_alias.invoke_arn
}

resource "aws_api_gateway_integration" "lambda_integration_login_post" {
  rest_api_id             = aws_api_gateway_rest_api.api.id
  resource_id             = aws_api_gateway_resource.api_login.id
  http_method             = aws_api_gateway_method.api_login_post.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_alias.live_alias.invoke_arn
}

resource "aws_api_gateway_integration" "lambda_integration_transactions_options" {
  rest_api_id             = aws_api_gateway_rest_api.api.id
  resource_id             = aws_api_gateway_resource.api_transactions.id
  http_method             = aws_api_gateway_method.api_transactions_options.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_alias.live_alias.invoke_arn
}

resource "aws_api_gateway_integration" "lambda_integration_transactions_get" {
  rest_api_id             = aws_api_gateway_rest_api.api.id
  resource_id             = aws_api_gateway_resource.api_transactions.id
  http_method             = aws_api_gateway_method.api_transactions_get.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_alias.live_alias.invoke_arn
}

resource "aws_api_gateway_integration" "lambda_integration_transactions_post" {
  rest_api_id             = aws_api_gateway_rest_api.api.id
  resource_id             = aws_api_gateway_resource.api_transactions.id
  http_method             = aws_api_gateway_method.api_transactions_post.http_method
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

resource "aws_api_gateway_integration" "lambda_integration_process_batch_post" {
  rest_api_id             = aws_api_gateway_rest_api.api.id
  resource_id             = aws_api_gateway_resource.api_process_batch.id
  http_method             = aws_api_gateway_method.api_process_batch_post.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_alias.live_alias.invoke_arn
}

resource "aws_api_gateway_integration" "lambda_integration_batch_id_options" {
  rest_api_id             = aws_api_gateway_rest_api.api.id
  resource_id             = aws_api_gateway_resource.api_batch_id.id
  http_method             = aws_api_gateway_method.api_batch_id_options.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_alias.live_alias.invoke_arn
}

resource "aws_api_gateway_integration" "lambda_integration_batch_id_get" {
  rest_api_id             = aws_api_gateway_rest_api.api.id
  resource_id             = aws_api_gateway_resource.api_batch_id.id
  http_method             = aws_api_gateway_method.api_batch_id_get.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_alias.live_alias.invoke_arn
}

# --- Deployment + stage --------------------------------------------------------------------------
resource "aws_api_gateway_deployment" "api_deployment" {
  rest_api_id = aws_api_gateway_rest_api.api.id

  # Redeploy whenever anything that shapes the API changes. Without this,
  # API Gateway keeps serving the previous snapshot of the configuration.
  triggers = {
    redeploy = sha1(jsonencode([
      local.api_methods,
      aws_api_gateway_integration.lambda_integration_login_options,
      aws_api_gateway_integration.lambda_integration_login_post,
      aws_api_gateway_integration.lambda_integration_transactions_options,
      aws_api_gateway_integration.lambda_integration_transactions_get,
      aws_api_gateway_integration.lambda_integration_transactions_post,
      aws_api_gateway_integration.lambda_integration_process_batch_options,
      aws_api_gateway_integration.lambda_integration_process_batch_post,
      aws_api_gateway_integration.lambda_integration_batch_id_options,
      aws_api_gateway_integration.lambda_integration_batch_id_get,
      aws_api_gateway_authorizer.jwt,
      aws_api_gateway_model.login.schema,
      aws_api_gateway_model.transaction.schema,
      aws_api_gateway_model.batch.schema,
      aws_api_gateway_gateway_response.unauthorized,
      aws_api_gateway_gateway_response.access_denied,
      aws_api_gateway_gateway_response.bad_request_body,
      aws_api_gateway_gateway_response.default_4xx,
      aws_api_gateway_gateway_response.default_5xx,
    ]))
  }

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_api_gateway_stage" "prod_stage" {
  #checkov:skip=CKV_AWS_120:Responses are per-user and change on every write; caching would serve stale payment data.
  #checkov:skip=CKV2_AWS_51:Browser clients cannot present client certificates; auth is JWT at the edge.
  #checkov:skip=CKV2_AWS_29:WAFv2 is attached via aws_wafv2_web_acl_association.api (waf.tf); checkov does not follow the association.
  #checkov:skip=CKV2_AWS_77:Same as above; the ACL includes AWSManagedRulesKnownBadInputsRuleSet (Log4j AMR).
  rest_api_id          = aws_api_gateway_rest_api.api.id
  deployment_id        = aws_api_gateway_deployment.api_deployment.id
  stage_name           = "prod"
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
      latencyMs      = "$context.responseLatency"
      integrationErr = "$context.integration.error"
      authorizerErr  = "$context.authorizer.error"
      validationErr  = "$context.error.validationErrorString"
      wafStatus      = "$context.waf.status"
    })
  }

  depends_on = [aws_api_gateway_account.api_gateway_account]
}

resource "aws_api_gateway_method_settings" "all" {
  #checkov:skip=CKV_AWS_225:See CKV_AWS_120 on the stage: caching is intentionally off.
  rest_api_id = aws_api_gateway_rest_api.api.id
  stage_name  = aws_api_gateway_stage.prod_stage.stage_name
  method_path = "*/*"

  settings {
    metrics_enabled = true
    # ERROR-level execution logs only: access logs already carry every
    # request, so INFO would duplicate them at extra cost. Request/response
    # bodies are never logged (they contain card numbers).
    logging_level      = "ERROR"
    data_trace_enabled = false

    # Stage-wide throttling to blunt DoS / runaway load-test traffic.
    throttling_rate_limit  = 10
    throttling_burst_limit = 20
  }
}

# Account-level role that lets API Gateway write logs to CloudWatch.
resource "aws_iam_role" "api_gateway_cloudwatch_role" {
  name = "api_gateway_cloudwatch_role"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Effect    = "Allow"
      Principal = { Service = "apigateway.amazonaws.com" }
    }]
  })
}

resource "aws_iam_role_policy_attachment" "api_gateway_cloudwatch" {
  role       = aws_iam_role.api_gateway_cloudwatch_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonAPIGatewayPushToCloudWatchLogs"
}

resource "aws_api_gateway_account" "api_gateway_account" {
  cloudwatch_role_arn = aws_iam_role.api_gateway_cloudwatch_role.arn
}
