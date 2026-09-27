# observability.tf
# Access-log group, SNS alarm topic, CloudWatch alarms, and a dashboard.
# Everything here is infrastructure-as-code so monitoring is reproducible.

# Log group that the API Gateway stage streams structured access logs to.
resource "aws_cloudwatch_log_group" "api_access_logs" {
  name              = "/aws/apigateway/transaction-simulator/access"
  retention_in_days = 14
}

# SNS topic for alarm notifications. An email is subscribed only if provided.
resource "aws_sns_topic" "alarms" {
  name = "transaction-simulator-alarms"
}

resource "aws_sns_topic_subscription" "alarm_email" {
  count     = var.alarm_email == "" ? 0 : 1
  topic_arn = aws_sns_topic.alarms.arn
  protocol  = "email"
  endpoint  = var.alarm_email
}

# --- Alarms ---------------------------------------------------------------
resource "aws_cloudwatch_metric_alarm" "lambda_errors" {
  alarm_name          = "ts-lambda-errors"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "Errors"
  namespace           = "AWS/Lambda"
  period              = 300
  statistic           = "Sum"
  threshold           = 1
  alarm_description   = "Main API Lambda reported errors."
  treat_missing_data  = "notBreaching"
  dimensions          = { FunctionName = aws_lambda_function.api_lambda.function_name }
  alarm_actions       = [aws_sns_topic.alarms.arn]
  ok_actions          = [aws_sns_topic.alarms.arn]
}

resource "aws_cloudwatch_metric_alarm" "lambda_throttles" {
  alarm_name          = "ts-lambda-throttles"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "Throttles"
  namespace           = "AWS/Lambda"
  period              = 300
  statistic           = "Sum"
  threshold           = 0
  alarm_description   = "Main API Lambda is being throttled."
  treat_missing_data  = "notBreaching"
  dimensions          = { FunctionName = aws_lambda_function.api_lambda.function_name }
  alarm_actions       = [aws_sns_topic.alarms.arn]
}

resource "aws_cloudwatch_metric_alarm" "api_5xx" {
  alarm_name          = "ts-api-5xx"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "5XXError"
  namespace           = "AWS/ApiGateway"
  period              = 300
  statistic           = "Sum"
  threshold           = 2
  alarm_description   = "API Gateway is returning 5XX responses."
  treat_missing_data  = "notBreaching"
  dimensions          = { ApiName = aws_api_gateway_rest_api.api.name, Stage = aws_api_gateway_stage.prod_stage.stage_name }
  alarm_actions       = [aws_sns_topic.alarms.arn]
}

resource "aws_cloudwatch_metric_alarm" "waf_blocked" {
  alarm_name          = "ts-waf-blocked-spike"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "BlockedRequests"
  namespace           = "AWS/WAFV2"
  period              = 300
  statistic           = "Sum"
  threshold           = 100
  alarm_description   = "WAF is blocking an unusually high number of requests."
  treat_missing_data  = "notBreaching"
  dimensions          = { WebACL = aws_wafv2_web_acl.api.name, Region = data.aws_region.current.name, Rule = "ALL" }
  alarm_actions       = [aws_sns_topic.alarms.arn]
}

# --- Dashboard ------------------------------------------------------------
resource "aws_cloudwatch_dashboard" "main" {
  dashboard_name = "TransactionSimulator"
  dashboard_body = jsonencode({
    widgets = [
      {
        type   = "metric"
        x      = 0
        y      = 0
        width  = 12
        height = 6
        properties = {
          title   = "Lambda: invocations / errors / throttles"
          region  = data.aws_region.current.name
          view    = "timeSeries"
          stacked = false
          metrics = [
            ["AWS/Lambda", "Invocations", "FunctionName", aws_lambda_function.api_lambda.function_name],
            ["AWS/Lambda", "Errors", "FunctionName", aws_lambda_function.api_lambda.function_name],
            ["AWS/Lambda", "Throttles", "FunctionName", aws_lambda_function.api_lambda.function_name]
          ]
        }
      },
      {
        type   = "metric"
        x      = 12
        y      = 0
        width  = 12
        height = 6
        properties = {
          title  = "Lambda duration (avg / p95)"
          region = data.aws_region.current.name
          view   = "timeSeries"
          metrics = [
            ["AWS/Lambda", "Duration", "FunctionName", aws_lambda_function.api_lambda.function_name, { stat = "Average" }],
            ["AWS/Lambda", "Duration", "FunctionName", aws_lambda_function.api_lambda.function_name, { stat = "p95" }]
          ]
        }
      },
      {
        type   = "metric"
        x      = 0
        y      = 6
        width  = 12
        height = 6
        properties = {
          title  = "API Gateway: requests / 4XX / 5XX"
          region = data.aws_region.current.name
          view   = "timeSeries"
          metrics = [
            ["AWS/ApiGateway", "Count", "ApiName", aws_api_gateway_rest_api.api.name, "Stage", aws_api_gateway_stage.prod_stage.stage_name],
            ["AWS/ApiGateway", "4XXError", "ApiName", aws_api_gateway_rest_api.api.name, "Stage", aws_api_gateway_stage.prod_stage.stage_name],
            ["AWS/ApiGateway", "5XXError", "ApiName", aws_api_gateway_rest_api.api.name, "Stage", aws_api_gateway_stage.prod_stage.stage_name]
          ]
        }
      },
      {
        type   = "metric"
        x      = 12
        y      = 6
        width  = 12
        height = 6
        properties = {
          title  = "WAF: allowed vs blocked"
          region = data.aws_region.current.name
          view   = "timeSeries"
          metrics = [
            ["AWS/WAFV2", "AllowedRequests", "WebACL", aws_wafv2_web_acl.api.name, "Region", data.aws_region.current.name, "Rule", "ALL"],
            ["AWS/WAFV2", "BlockedRequests", "WebACL", aws_wafv2_web_acl.api.name, "Region", data.aws_region.current.name, "Rule", "ALL"]
          ]
        }
      }
    ]
  })
}
