# Offline plan test: runs `terraform test` with mocked providers, so CI can
# check the whole configuration evaluates (references, for_each keys,
# dependency cycles, variable validation) without AWS credentials.

# Mocked resources get random strings for computed attributes; the ones the
# provider validates as ARNs need realistic defaults.
mock_provider "aws" {
  mock_resource "aws_iam_role" {
    defaults = {
      arn = "arn:aws:iam::123456789012:role/mock"
    }
  }
  mock_resource "aws_sns_topic" {
    defaults = {
      arn = "arn:aws:sns:us-east-1:123456789012:mock"
    }
  }
  mock_resource "aws_wafv2_web_acl" {
    defaults = {
      arn = "arn:aws:wafv2:us-east-1:123456789012:regional/webacl/mock/00000000-0000-0000-0000-000000000000"
    }
  }
  mock_resource "aws_api_gateway_rest_api" {
    defaults = {
      execution_arn = "arn:aws:execute-api:us-east-1:123456789012:mockapi"
    }
  }
  mock_resource "aws_api_gateway_stage" {
    defaults = {
      arn = "arn:aws:apigateway:us-east-1::/restapis/mockapi/stages/prod"
    }
  }
  mock_resource "aws_cloudwatch_log_group" {
    defaults = {
      arn = "arn:aws:logs:us-east-1:123456789012:log-group:mock"
    }
  }
  mock_data "aws_region" {
    defaults = {
      name = "us-east-1"
    }
  }
  mock_data "aws_iam_policy_document" {
    defaults = {
      json = "{\"Version\":\"2012-10-17\",\"Statement\":[]}"
    }
  }
}

mock_provider "random" {}

variables {
  supabase_url        = "https://example.supabase.co"
  supabase_key        = "test-service-role-key"
  jwt_secret          = "test-jwt-secret"
  admin_username      = "admin"
  admin_password_hash = "$2a$10$abcdefghijklmnopqrstuuJ4bXk3cUg5nqk6H8b2m1d9w6zL1r2y"
}

run "plan_is_valid" {
  command = plan

  assert {
    condition     = length(aws_iam_role.lambda) == 3
    error_message = "Each Lambda must have its own execution role."
  }

  assert {
    condition     = !contains(keys(aws_lambda_function.api_lambda.environment[0].variables), "SUPABASE_KEY")
    error_message = "The Supabase key must come from Secrets Manager, not the Lambda environment."
  }

  assert {
    condition     = !contains(keys(aws_lambda_function.batch_worker.environment[0].variables), "SUPABASE_KEY")
    error_message = "The Supabase key must come from Secrets Manager, not the Lambda environment."
  }

  assert {
    condition     = aws_sqs_queue.batch_jobs.sqs_managed_sse_enabled && aws_sqs_queue.batch_jobs_dlq.sqs_managed_sse_enabled
    error_message = "Both queues must be encrypted at rest."
  }

  assert {
    condition     = aws_lambda_function.api_lambda.runtime == "nodejs22.x"
    error_message = "Lambdas must run on a supported Node.js runtime."
  }

  assert {
    condition     = length(aws_codedeploy_deployment_group.api.alarm_configuration[0].alarms) == 3
    error_message = "The canary must be gated by the errors, 5XX and p95 latency alarms."
  }
}

run "rejects_merchant_id_too_long_for_iso8583" {
  command = plan

  variables {
    allowed_merchant_id = "this-merchant-id-is-too-long"
  }

  expect_failures = [var.allowed_merchant_id]
}
