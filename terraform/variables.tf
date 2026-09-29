variable "supabase_url" {
  description = "Supabase project URL"
  type        = string
  sensitive   = true
}

variable "supabase_key" {
  # Must be the service_role key: RLS denies the anon key everything.
  # Stored in Secrets Manager (secrets.tf), never in a Lambda environment.
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
  description = "The single demo merchant id the simulator accepts. Sent in ISO 8583 field 42, so at most 15 printable ASCII characters."
  type        = string
  default     = "demo-merchant"

  validation {
    condition     = can(regex("^[ -~]{1,15}$", var.allowed_merchant_id))
    error_message = "allowed_merchant_id must be 1-15 printable ASCII characters (ISO 8583 field 42)."
  }
}
