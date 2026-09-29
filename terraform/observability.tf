# observability.tf
# Access-log group, SNS alarm topic, CloudWatch alarms, and a dashboard.
# Everything here is infrastructure-as-code so monitoring is reproducible.

# Log group that the API Gateway stage streams structured access logs to.
resource "aws_cloudwatch_log_group" "api_access_logs" {
  #checkov:skip=CKV_AWS_158:AWS-managed encryption; customer-managed KMS is a roadmap item.
  #checkov:skip=CKV_AWS_338:14-day retention is a deliberate cost choice for a demo stack.
  name              = "/aws/apigateway/transaction-simulator/access"
  retention_in_days = 14
}

# SNS topic for alarm notifications. An email is subscribed only if provided.
resource "aws_sns_topic" "alarms" {
  #checkov:skip=CKV_AWS_26:CloudWatch alarms and AWS Budgets cannot publish to a topic encrypted with the AWS-managed aws/sns key; this needs a customer-managed key with a service key policy (roadmap). Alarm payloads contain no card data.
  name = "transaction-simulator-alarms"
}

resource "aws_sns_topic_subscription" "alarm_email" {
  count     = var.alarm_email == "" ? 0 : 1
  topic_arn = aws_sns_topic.alarms.arn
  protocol  = "email"
  endpoint  = var.alarm_email
}

# --- Alarms ---------------------------------------------------------------
# The next three alarms gate the CodeDeploy canary (codedeploy.tf). They use
# 60-second periods so a regression can trip them inside the 5-minute bake;
# 300-second periods could evaluate too late to trigger a rollback.
resource "aws_cloudwatch_metric_alarm" "lambda_errors" {
  alarm_name          = "ts-lambda-errors"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 3
  datapoints_to_alarm = 1
  metric_name         = "Errors"
  namespace           = "AWS/Lambda"
  period              = 60
  statistic           = "Sum"
  threshold           = 0
  alarm_description   = "API Lambda reported errors (canary rollback signal)."
  treat_missing_data  = "notBreaching"
  dimensions          = { FunctionName = aws_lambda_function.api_lambda.function_name }
  alarm_actions       = [aws_sns_topic.alarms.arn]
  ok_actions          = [aws_sns_topic.alarms.arn]
}

resource "aws_cloudwatch_metric_alarm" "api_latency_p95" {
  alarm_name          = "ts-api-latency-p95"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 3
  datapoints_to_alarm = 2
  metric_name         = "Latency"
  namespace           = "AWS/ApiGateway"
  period              = 60
  extended_statistic  = "p95"
  threshold           = 2000
  alarm_description   = "API p95 latency above 2s (canary rollback signal)."
  treat_missing_data  = "notBreaching"
  dimensions          = { ApiName = aws_api_gateway_rest_api.api.name, Stage = aws_api_gateway_stage.prod_stage.stage_name }
  alarm_actions       = [aws_sns_topic.alarms.arn]
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
  evaluation_periods  = 3
  datapoints_to_alarm = 1
  metric_name         = "5XXError"
  namespace           = "AWS/ApiGateway"
  period              = 60
  statistic           = "Sum"
  threshold           = 2
  alarm_description   = "API Gateway is returning 5XX responses (canary rollback signal)."
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

# --- Business metrics -------------------------------------------------------
# Every authorization is logged once by lambda/payments.js (API Lambda and
# batch worker alike) with a `metric` token: PAYMENT_APPROVED,
# PAYMENT_DECLINED or PAYMENT_REPLAYED. Lambda prefixes each line with a
# timestamp and request id, so the filters match the token as a plain term
# rather than using a JSON selector. No extra SDK calls on the request path.
locals {
  payment_log_groups = {
    api    = aws_cloudwatch_log_group.lambda["api"].name
    worker = aws_cloudwatch_log_group.lambda["worker"].name
  }
  payment_outcomes = {
    Approved = "{ $.msg = \"payment authorized\" && $.approved IS TRUE && $.replayed IS FALSE }"
    Declined = "{ $.msg = \"payment authorized\" && $.approved IS FALSE && $.replayed IS FALSE }"
  }
  payment_metric_filters = {
    for pair in setproduct(keys(local.payment_log_groups), keys(local.payment_outcomes)) :
    "${pair[0]}-${pair[1]}" => { source = pair[0], outcome = pair[1] }
  }
}

resource "aws_cloudwatch_log_metric_filter" "payments" {
  for_each       = local.payment_metric_filters
  name           = "ts-payments-${lower(each.value.outcome)}-${each.value.source}"
  log_group_name = local.payment_log_groups[each.value.source]
  pattern        = local.payment_outcomes[each.value.outcome]

  metric_transformation {
    name          = "Payments${each.value.outcome}"
    namespace     = "TransactionSimulator"
    value         = "1"
    default_value = "0"
  }
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
      },
      {
        type   = "metric"
        x      = 0
        y      = 12
        width  = 12
        height = 6
        properties = {
          title  = "Payments: approved vs declined"
          region = data.aws_region.current.name
          view   = "timeSeries"
          stat   = "Sum"
          period = 60
          metrics = [
            ["TransactionSimulator", "PaymentsApproved"],
            ["TransactionSimulator", "PaymentsDeclined"]
          ]
        }
      },
      {
        type   = "metric"
        x      = 12
        y      = 12
        width  = 12
        height = 6
        properties = {
          title  = "Batch pipeline: worker errors / DLQ depth"
          region = data.aws_region.current.name
          view   = "timeSeries"
          metrics = [
            ["AWS/Lambda", "Errors", "FunctionName", aws_lambda_function.batch_worker.function_name, { stat = "Sum" }],
            ["AWS/SQS", "ApproximateNumberOfMessagesVisible", "QueueName", aws_sqs_queue.batch_jobs.name, { stat = "Maximum" }],
            ["AWS/SQS", "ApproximateNumberOfMessagesVisible", "QueueName", aws_sqs_queue.batch_jobs_dlq.name, { stat = "Maximum" }]
          ]
        }
      }
    ]
  })
}
