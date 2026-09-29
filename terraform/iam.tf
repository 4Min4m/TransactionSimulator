# iam.tf
# One execution role per function, each granted only what that function
# does. A compromised authorizer cannot write payments, and a compromised
# worker cannot mint JWTs.
#
#   role         | JWT secret | Supabase secret | SQS send | SQS consume
#   -------------|------------|-----------------|----------|------------
#   api          |    read    |      read       |   yes    |     -
#   authorizer   |    read    |        -        |    -     |     -
#   batch worker |      -     |      read       |    -     |    yes

locals {
  lambda_roles = {
    api        = "transaction-simulator-api"
    authorizer = "transaction-simulator-authorizer"
    worker     = "transaction-simulator-batch-worker"
  }
}

data "aws_iam_policy_document" "lambda_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "lambda" {
  for_each           = local.lambda_roles
  name               = each.value
  assume_role_policy = data.aws_iam_policy_document.lambda_assume.json
}

# CloudWatch Logs + X-Ray for every function.
resource "aws_iam_role_policy_attachment" "lambda_logs" {
  for_each   = local.lambda_roles
  role       = aws_iam_role.lambda[each.key].name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_iam_role_policy_attachment" "lambda_xray" {
  for_each   = local.lambda_roles
  role       = aws_iam_role.lambda[each.key].name
  policy_arn = "arn:aws:iam::aws:policy/AWSXRayDaemonWriteAccess"
}

resource "aws_iam_role_policy" "api" {
  name = "api-runtime"
  role = aws_iam_role.lambda["api"].id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid      = "ReadRuntimeSecrets"
        Effect   = "Allow"
        Action   = "secretsmanager:GetSecretValue"
        Resource = [aws_secretsmanager_secret.jwt.arn, aws_secretsmanager_secret.supabase_key.arn]
      },
      {
        Sid      = "EnqueueBatchJobs"
        Effect   = "Allow"
        Action   = "sqs:SendMessage"
        Resource = aws_sqs_queue.batch_jobs.arn
      },
    ]
  })
}

resource "aws_iam_role_policy" "authorizer" {
  name = "authorizer-runtime"
  role = aws_iam_role.lambda["authorizer"].id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Sid      = "ReadJwtSecret"
      Effect   = "Allow"
      Action   = "secretsmanager:GetSecretValue"
      Resource = aws_secretsmanager_secret.jwt.arn
    }]
  })
}

resource "aws_iam_role_policy" "worker" {
  name = "batch-worker-runtime"
  role = aws_iam_role.lambda["worker"].id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid      = "ReadSupabaseSecret"
        Effect   = "Allow"
        Action   = "secretsmanager:GetSecretValue"
        Resource = aws_secretsmanager_secret.supabase_key.arn
      },
      {
        Sid      = "ConsumeBatchJobs"
        Effect   = "Allow"
        Action   = ["sqs:ReceiveMessage", "sqs:DeleteMessage", "sqs:GetQueueAttributes"]
        Resource = aws_sqs_queue.batch_jobs.arn
      },
    ]
  })
}
