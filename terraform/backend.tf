# نقش IAM برای Lambda
resource "aws_iam_role" "lambda_role" {
  name = "transaction_simulator_lambda_role"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
    }]
  })
}

resource "aws_iam_role_policy_attachment" "lambda_policy" {
  role       = aws_iam_role.lambda_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

# زیپ کردن کل پوشه lambda
data "archive_file" "lambda_zip" {
  type        = "zip"
  source_dir  = "../lambda"
  output_path = "lambda.zip"
}

# Lambda اصلی (بک‌اند)
resource "aws_lambda_function" "backend_lambda" {
  function_name    = "TransactionSimulatorBackend"
  handler          = "lambda.handler"
  runtime          = "nodejs18.x"
  role             = aws_iam_role.lambda_role.arn
  filename         = data.archive_file.lambda_zip.output_path
  source_code_hash = data.archive_file.lambda_zip.output_base64sha256
  environment {
    variables = {
      SUPABASE_URL = "https://cbkvjddafakpnywthwmc.supabase.co"
      SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNia3ZqZGRhZmFrcG55d3Rod21jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzcyOTE0MDgsImV4cCI6MjA1Mjg2NzQwOH0.fjPb_ZsNsp-_vf-wObGtr4R4gXL6lgzJTP2seKY_n4I"
    }
  }
}

# API Gateway برای Lambda اصلی
resource "aws_api_gateway_rest_api" "api" {
  name = "TransactionSimulatorAPI"
}

resource "aws_api_gateway_resource" "api_resource" {
  rest_api_id = aws_api_gateway_rest_api.api.id
  parent_id   = aws_api_gateway_rest_api.api.root_resource_id
  path_part   = "api"
}

resource "aws_api_gateway_resource" "public_resource" {
  rest_api_id = aws_api_gateway_rest_api.api.id
  parent_id   = aws_api_gateway_resource.api_resource.id
  path_part   = "public"
}

resource "aws_api_gateway_resource" "transactions_resource" {
  rest_api_id = aws_api_gateway_rest_api.api.id
  parent_id   = aws_api_gateway_resource.public_resource.id
  path_part   = "transactions"
}

resource "aws_api_gateway_method" "get_method" {
  rest_api_id   = aws_api_gateway_rest_api.api.id
  resource_id   = aws_api_gateway_resource.transactions_resource.id
  http_method   = "GET"
  authorization = "NONE"
}

resource "aws_api_gateway_method" "post_method" {
  rest_api_id   = aws_api_gateway_rest_api.api.id
  resource_id   = aws_api_gateway_resource.transactions_resource.id
  http_method   = "POST"
  authorization = "NONE"
}

resource "aws_api_gateway_method" "options_method" {
  rest_api_id   = aws_api_gateway_rest_api.api.id
  resource_id   = aws_api_gateway_resource.transactions_resource.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "lambda_integration_get" {
  rest_api_id             = aws_api_gateway_rest_api.api.id
  resource_id             = aws_api_gateway_resource.transactions_resource.id
  http_method             = aws_api_gateway_method.get_method.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.backend_lambda.invoke_arn
}

resource "aws_api_gateway_integration" "lambda_integration_post" {
  rest_api_id             = aws_api_gateway_rest_api.api.id
  resource_id             = aws_api_gateway_resource.transactions_resource.id
  http_method             = aws_api_gateway_method.post_method.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.backend_lambda.invoke_arn
}

resource "aws_api_gateway_integration" "options_integration" {
  rest_api_id             = aws_api_gateway_rest_api.api.id
  resource_id             = aws_api_gateway_resource.transactions_resource.id
  http_method             = aws_api_gateway_method.options_method.http_method
  type                    = "MOCK"
  request_templates = {
    "application/json" = "{\"statusCode\": 200}"
  }
}

resource "aws_api_gateway_method_response" "options_response" {
  rest_api_id = aws_api_gateway_rest_api.api.id
  resource_id = aws_api_gateway_resource.transactions_resource.id
  http_method = aws_api_gateway_method.options_method.http_method
  status_code = "200"
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
  response_models = {
    "application/json" = "Empty"
  }
}

resource "aws_api_gateway_integration_response" "options_integration_response" {
  rest_api_id = aws_api_gateway_rest_api.api.id
  resource_id = aws_api_gateway_resource.transactions_resource.id
  http_method = aws_api_gateway_method.options_method.http_method
  status_code = aws_api_gateway_method_response.options_response.status_code
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type'"
    "method.response.header.Access-Control-Allow-Methods" = "'GET,POST,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }
}

resource "aws_lambda_permission" "api_gateway" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.backend_lambda.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.api.execution_arn}/*/*"
}

# Deployment و Stage برای API Gateway اصلی
resource "aws_api_gateway_deployment" "api_deployment" {
  depends_on = [
    aws_api_gateway_integration.lambda_integration_get,
    aws_api_gateway_integration.lambda_integration_post,
    aws_api_gateway_integration.options_integration
  ]
  rest_api_id = aws_api_gateway_rest_api.api.id
}

resource "aws_api_gateway_stage" "prod_stage" {
  rest_api_id   = aws_api_gateway_rest_api.api.id
  deployment_id = aws_api_gateway_deployment.api_deployment.id
  stage_name    = "prod"
}

# Lambda پراکسی برای دور زدن CORS
resource "aws_lambda_function" "proxy_lambda" {
  function_name    = "TransactionSimulatorProxy"
  handler          = "proxy.handler"
  runtime          = "nodejs18.x"
  role             = aws_iam_role.lambda_role.arn
  filename         = data.archive_file.lambda_zip.output_path
  source_code_hash = data.archive_file.lambda_zip.output_base64sha256
  environment {
    variables = {
      TARGET_API_URL = "https://goz81amuq7.execute-api.us-east-1.amazonaws.com/prod/api/public/transactions"
    }
  }
}

# API Gateway برای پراکسی
resource "aws_api_gateway_rest_api" "proxy_api" {
  name = "TransactionSimulatorProxyAPI"
}

resource "aws_api_gateway_resource" "proxy_api_resource" {
  rest_api_id = aws_api_gateway_rest_api.proxy_api.id
  parent_id   = aws_api_gateway_rest_api.proxy_api.root_resource_id
  path_part   = "proxy"
}

resource "aws_api_gateway_resource" "proxy_transactions_resource" {
  rest_api_id = aws_api_gateway_rest_api.proxy_api.id
  parent_id   = aws_api_gateway_resource.proxy_api_resource.id
  path_part   = "transactions"
}

resource "aws_api_gateway_method" "proxy_get_method" {
  rest_api_id   = aws_api_gateway_rest_api.proxy_api.id
  resource_id   = aws_api_gateway_resource.proxy_transactions_resource.id
  http_method   = "GET"
  authorization = "NONE"
}

resource "aws_api_gateway_method" "proxy_post_method" {
  rest_api_id   = aws_api_gateway_rest_api.proxy_api.id
  resource_id   = aws_api_gateway_resource.proxy_transactions_resource.id
  http_method   = "POST"
  authorization = "NONE"
}

resource "aws_api_gateway_method" "proxy_options_method" {
  rest_api_id   = aws_api_gateway_rest_api.proxy_api.id
  resource_id   = aws_api_gateway_resource.proxy_transactions_resource.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "proxy_lambda_integration_get" {
  rest_api_id             = aws_api_gateway_rest_api.proxy_api.id
  resource_id             = aws_api_gateway_resource.proxy_transactions_resource.id
  http_method             = aws_api_gateway_method.proxy_get_method.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.proxy_lambda.invoke_arn
}

resource "aws_api_gateway_integration" "proxy_lambda_integration_post" {
  rest_api_id             = aws_api_gateway_rest_api.proxy_api.id
  resource_id             = aws_api_gateway_resource.proxy_transactions_resource.id
  http_method             = aws_api_gateway_method.proxy_post_method.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.proxy_lambda.invoke_arn
}

resource "aws_api_gateway_integration" "proxy_options_integration" {
  rest_api_id             = aws_api_gateway_rest_api.proxy_api.id
  resource_id             = aws_api_gateway_resource.proxy_transactions_resource.id
  http_method             = aws_api_gateway_method.proxy_options_method.http_method
  type                    = "MOCK"
  request_templates = {
    "application/json" = "{\"statusCode\": 200}"
  }
}

resource "aws_api_gateway_method_response" "proxy_options_response" {
  rest_api_id = aws_api_gateway_rest_api.proxy_api.id
  resource_id = aws_api_gateway_resource.proxy_transactions_resource.id
  http_method = aws_api_gateway_method.proxy_options_method.http_method
  status_code = "200"
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
  response_models = {
    "application/json" = "Empty"
  }
}

resource "aws_api_gateway_integration_response" "proxy_options_integration_response" {
  rest_api_id = aws_api_gateway_rest_api.proxy_api.id
  resource_id = aws_api_gateway_resource.proxy_transactions_resource.id
  http_method = aws_api_gateway_method.proxy_options_method.http_method
  status_code = aws_api_gateway_method_response.proxy_options_response.status_code
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type'"
    "method.response.header.Access-Control-Allow-Methods" = "'GET,POST,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }
}

resource "aws_lambda_permission" "proxy_api_gateway" {
  statement_id  = "AllowProxyAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.proxy_lambda.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.proxy_api.execution_arn}/*/*"
}

resource "aws_api_gateway_deployment" "proxy_api_deployment" {
  depends_on = [
    aws_api_gateway_integration.proxy_lambda_integration_get,
    aws_api_gateway_integration.proxy_lambda_integration_post,
    aws_api_gateway_integration.proxy_options_integration
  ]
  rest_api_id = aws_api_gateway_rest_api.proxy_api.id
}

resource "aws_api_gateway_stage" "proxy_prod_stage" {
  rest_api_id   = aws_api_gateway_rest_api.proxy_api.id
  deployment_id = aws_api_gateway_deployment.proxy_api_deployment.id
  stage_name    = "prod"
}

# خروجی‌ها
output "api_url" {
  value = "${aws_api_gateway_stage.prod_stage.invoke_url}/api/public/transactions"
}

output "proxy_api_url" {
  value = "${aws_api_gateway_stage.proxy_prod_stage.invoke_url}/proxy/transactions"
}