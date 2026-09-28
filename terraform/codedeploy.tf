# codedeploy.tf
# Automated canary deployment + alarm-based rollback for the API Lambda.
# CodeDeploy shifts traffic on the LIVE alias gradually and rolls back
# automatically if the CloudWatch alarms below breach during the bake time.

resource "aws_codedeploy_app" "api" {
  name             = "transaction-simulator-api"
  compute_platform = "Lambda"
}

# IAM role CodeDeploy assumes to manage the alias shift.
resource "aws_iam_role" "codedeploy" {
  name = "transaction-simulator-codedeploy"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "codedeploy.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy_attachment" "codedeploy_lambda" {
  role       = aws_iam_role.codedeploy.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSCodeDeployRoleForLambda"
}

resource "aws_codedeploy_deployment_group" "api" {
  app_name               = aws_codedeploy_app.api.name
  deployment_group_name  = "transaction-simulator-api-dg"
  service_role_arn       = aws_iam_role.codedeploy.arn
  deployment_config_name = "CodeDeployDefault.LambdaCanary10Percent5Minutes"

  deployment_style {
    deployment_option = "WITH_TRAFFIC_CONTROL"
    deployment_type   = "BLUE_GREEN"
  }

  # Roll back automatically on failure or if a monitored alarm fires.
  auto_rollback_configuration {
    enabled = true
    events  = ["DEPLOYMENT_FAILURE", "DEPLOYMENT_STOP_ON_ALARM"]
  }

  alarm_configuration {
    enabled = true
    alarms = [
      aws_cloudwatch_metric_alarm.lambda_errors.alarm_name,
      aws_cloudwatch_metric_alarm.api_5xx.alarm_name,
    ]
  }
}
