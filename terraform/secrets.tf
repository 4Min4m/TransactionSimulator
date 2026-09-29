# secrets.tf
# Runtime secrets. The Lambdas read them through the AWS SDK (see
# lambda/secrets.js), so no plaintext secret appears in any function's
# environment configuration. Each role may read only the secrets it needs
# (see iam.tf).

resource "aws_secretsmanager_secret" "jwt" {
  #checkov:skip=CKV_AWS_149:AWS-managed key is used; a customer-managed KMS key is on the roadmap (README).
  #checkov:skip=CKV2_AWS_57:HS256 key rotation needs a dual-key verify window in the authorizer; tracked in the README roadmap.
  name                    = "transaction-simulator/jwt-secret"
  description             = "HS256 signing secret for TransactionSimulator JWTs."
  recovery_window_in_days = 7
}

resource "aws_secretsmanager_secret_version" "jwt" {
  secret_id     = aws_secretsmanager_secret.jwt.id
  secret_string = var.jwt_secret
}

resource "aws_secretsmanager_secret" "supabase_key" {
  #checkov:skip=CKV_AWS_149:AWS-managed key is used; a customer-managed KMS key is on the roadmap (README).
  #checkov:skip=CKV2_AWS_57:Supabase service_role keys are rotated in the Supabase dashboard, not by a Lambda rotator.
  name                    = "transaction-simulator/supabase-service-role-key"
  description             = "Supabase service_role key used server-side by the API Lambda and batch worker."
  recovery_window_in_days = 7
}

resource "aws_secretsmanager_secret_version" "supabase_key" {
  secret_id     = aws_secretsmanager_secret.supabase_key.id
  secret_string = var.supabase_key
}
