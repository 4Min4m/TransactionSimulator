variable "supabase_url" {
  description = "Supabase URL"
  type        = string
  sensitive   = true
}

variable "supabase_key" {
  description = "Supabase Key"
  type        = string
  sensitive   = true
}

variable "JWT_SECRET" {
  description = "JWT_SECRET"
  type        = string
  sensitive   = true
}