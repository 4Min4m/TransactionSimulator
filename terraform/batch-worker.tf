# batch-worker.tf
# Async path for POST /api/process-batch: the API Lambda validates the
# request, writes a `batches` row and enqueues a message; this worker drains
# the queue and runs the load test in the background. The client polls
# GET /api/batches/{id}.
#
# Delivery is at-least-once. The worker is idempotent (deterministic
# order_ids + a UNIQUE index, see lambda/batch-worker.js), so a redelivered
# message resumes the batch instead of duplicating payments.

locals {
  batch_max_receive_count = 3
  batch_worker_timeout    = 600 # > max duration_seconds (300) + write latency
}

resource "aws_sqs_queue" "batch_jobs_dlq" {
  name                      = "transaction-simulator-batch-jobs-dlq"
  message_retention_seconds = 1209600 # 14 days
  sqs_managed_sse_enabled   = true
}

resource "aws_sqs_queue" "batch_jobs" {
  name = "transaction-simulator-batch-jobs"

  # AWS guidance for Lambda event sources: at least 6x the function timeout,
  # so a message is never handed to a second worker while the first is still
  # running (including time spent waiting out throttling). Trade-off: after a
  # crash, the retry starts up to an hour later.
  visibility_timeout_seconds = local.batch_worker_timeout * 6
  sqs_managed_sse_enabled    = true

  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.batch_jobs_dlq.arn
    maxReceiveCount     = local.batch_max_receive_count
  })
}

resource "aws_lambda_function" "batch_worker" {
  #checkov:skip=CKV_AWS_115:See locals comment in lambda.tf.
  #checkov:skip=CKV_AWS_116:Invoked by an SQS event source mapping; the queue's redrive policy is the DLQ.
  #checkov:skip=CKV_AWS_117:See locals comment in lambda.tf.
  #checkov:skip=CKV_AWS_173:See locals comment in lambda.tf.
  #checkov:skip=CKV_AWS_272:See locals comment in lambda.tf.
  function_name = "TransactionSimulatorBatchWorker"
  description   = "Consumes batch load-test jobs from SQS."
  handler       = "batch-worker.handler"
  runtime       = local.lambda_runtime
  timeout       = local.batch_worker_timeout
  memory_size   = 256
  role          = aws_iam_role.lambda["worker"].arn

  s3_bucket        = aws_s3_bucket.lambda_code_bucket.bucket
  s3_key           = aws_s3_object.lambda_package.key
  source_code_hash = data.archive_file.lambda_zip.output_base64sha256

  environment {
    variables = {
      SUPABASE_URL            = var.supabase_url
      SUPABASE_KEY_SECRET_ARN = aws_secretsmanager_secret.supabase_key.arn
      # Lets the worker mark a batch `failed` on its last attempt before the DLQ.
      MAX_RECEIVE_COUNT = tostring(local.batch_max_receive_count)
    }
  }

  logging_config {
    log_format = "Text"
    log_group  = aws_cloudwatch_log_group.lambda["worker"].name
  }

  tracing_config {
    mode = "Active"
  }

  depends_on = [aws_iam_role_policy.worker, aws_iam_role_policy_attachment.lambda_logs]
}

resource "aws_lambda_event_source_mapping" "batch_worker_sqs" {
  event_source_arn = aws_sqs_queue.batch_jobs.arn
  function_name    = aws_lambda_function.batch_worker.arn
  batch_size       = 1 # one batch job per invocation keeps progress updates simple

  # Caps how many batches run in parallel, protecting Supabase and cost
  # without reserving account-level Lambda concurrency.
  scaling_config {
    maximum_concurrency = 2
  }
}

resource "aws_cloudwatch_metric_alarm" "batch_worker_errors" {
  alarm_name          = "ts-batch-worker-errors"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "Errors"
  namespace           = "AWS/Lambda"
  period              = 300
  statistic           = "Sum"
  threshold           = 0
  alarm_description   = "Batch worker Lambda reported errors (SQS will retry the batch)."
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
  alarm_description   = "A batch job failed ${local.batch_max_receive_count} times and landed in the dead-letter queue."
  treat_missing_data  = "notBreaching"
  dimensions          = { QueueName = aws_sqs_queue.batch_jobs_dlq.name }
  alarm_actions       = [aws_sns_topic.alarms.arn]
}
