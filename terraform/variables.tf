variable "supabase_url" {
  description = "Supabase project URL"
  type        = string
  sensitive   = true
}

variable "supabase_key" {
  # FIX: this previously said "anon/public key", which directly contradicted
  # the security model in supabase/rls.sql and README.md — RLS revokes all
  # access from the anon/authenticated roles, so an anon key here would leave
  # the Lambdas unable to read or write anything. This MUST be the
  # service_role key (Project Settings -> API -> service_role secret in the
  # Supabase dashboard), kept server-side only.
  description = "Supabase service_role key (server-side only — NOT the anon/public key; RLS denies the anon key entirely, see supabase/rls.sql)"
  type        = string
  sensitive   = true
}

variable "jwt_secret" {
  description = "Secret used to sign and verify JWTs (HS256). Keep long and random."
  type        = string
  sensitive   = true
}

variable "admin_username" {
  description = "Admin username for the login endpoint."
  type        = string
  sensitive   = true
}

variable "admin_password_hash" {
  description = "bcrypt hash of the admin password (never the plaintext password)."
  type        = string
  sensitive   = true
}

variable "alarm_email" {
  description = "Email for CloudWatch alarm + budget notifications. Leave empty to skip subscriptions."
  type        = string
  default     = ""
}

variable "monthly_budget_usd" {
  description = "Monthly AWS cost budget in USD."
  type        = string
  default     = "10"
}

variable "allowed_merchant_id" {
  description = "The single demo merchant id the simulator accepts on POST /api/transactions. Previously hardcoded in lambda.js as an unexplained, unrelated string."
  type        = string
  default     = "demo-merchant"
}
