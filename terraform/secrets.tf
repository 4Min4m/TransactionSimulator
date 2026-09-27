# secrets.tf
# Central storage for the JWT signing secret. The Lambdas read it at runtime
# via the AWS SDK (see lambda/secrets.js), so the plaintext no longer lives in
# the Lambda environment. Rotation can later be enabled on this secret.

resource "aws_secretsmanager_secret" "jwt" {
  name        = "transaction-simulator/jwt-secret"
  description = "HS256 signing secret for TransactionSimulator JWTs."
}

resource "aws_secretsmanager_secret_version" "jwt" {
  secret_id     = aws_secretsmanager_secret.jwt.id
  secret_string = var.jwt_secret
}
