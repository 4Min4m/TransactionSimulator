# batch-worker.tf
# Async processing path for POST /api/process-batch.
#
# For a batch with a long `duration_seconds`
# that risks hitting the Lambda/API Gateway timeout mid-request, and bills
# Lambda time for nothing but sleeping. Now the API Lambda only validates
# the request and enqueues a message; this dedicated worker Lambda drains
# the queue and does the (simulated) processing in the background, updating
# a `batches` row in Supabase that the frontend polls via GET /api/batches/{id}.

resource "aws_sqs_queue" "batch_jobs_dlq" {
  name                      = "transaction-simulator-batch-jobs-dlq"
  message_retention_seconds = 1209600 # 14 days
}

resource "aws_sqs_queue" "batch_jobs" {
  name = "transaction-simulator-batch-jobs"

  # Must comfortably exceed the worker's own function timeout below, so SQS
  # doesn't redeliver a message to a second worker while the first is still
  # processing it.
  visibility_timeout_seconds = 660

  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.batch_jobs_dlq.arn
    maxReceiveCount      = 3
  })
}

resource "aws_iam_role_policy" "worker_sqs_consume" {
  name = "batch-worker-consume-queue"
  role = aws_iam_role.lambda_role.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = [
        "sqs:ReceiveMessage",
        "sqs:DeleteMessage",
        "sqs:GetQueueAttributes",
      ]
      Resource = aws_sqs_queue.batch_jobs.arn
    }]
  })
}

resource "aws_lambda_function" "batch_worker" {
  function_name = "TransactionSimulatorBatchWorker"
  handler       = "batch-worker.handler"
  runtime       = "nodejs20.x"
  # Capped comfortably above the API's own duration_seconds cap (300s, see
  # lambda.js validation) plus per-transaction Supabase write latency.
  timeout = 600
  role    = aws_iam_role.lambda_role.arn

  s3_bucket        = aws_s3_bucket.lambda_code_bucket.bucket
  s3_key           = aws_s3_object.lambda_package.key
  source_code_hash = data.archive_file.lambda_zip.output_sha

  environment {
    variables = {
      SUPABASE_URL = var.supabase_url
      SUPABASE_KEY = var.supabase_key
    }
  }

  tracing_config {
    mode = "Active"
  }

  depends_on = [aws_s3_object.lambda_package]
}

resource "aws_lambda_event_source_mapping" "batch_worker_sqs" {
  event_source_arn = aws_sqs_queue.batch_jobs.arn
  function_name    = aws_lambda_function.batch_worker.arn
  batch_size       = 1 # one batch job per invocation keeps progress updates simple
}

resource "aws_cloudwatch_metric_alarm" "batch_worker_errors" {
  alarm_name          = "ts-batch-worker-errors"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "Errors"
  namespace           = "AWS/Lambda"
  period              = 300
  statistic           = "Sum"
  threshold           = 1
  alarm_description   = "Batch worker Lambda reported errors."
  treat_missing_data  = "notBreaching"
  dimensions          = { FunctionName = aws_lambda_function.batch_worker.function_name }
  alarm_actions       = [aws_sns_topic.alarms.arn]
}

resource "aws_cloudwatch_metric_alarm" "batch_jobs_dlq_not_empty" {
  alarm_name          = "ts-batch-jobs-dlq-not-empty"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "ApproximateNumberOfMessagesVisible"
  namespace           = "AWS/SQS"
  period              = 300
  statistic           = "Maximum"
  threshold           = 0
  alarm_description   = "A batch job failed 3 times and landed in the dead-letter queue."
  treat_missing_data  = "notBreaching"
  dimensions          = { QueueName = aws_sqs_queue.batch_jobs_dlq.name }
  alarm_actions       = [aws_sns_topic.alarms.arn]
}
