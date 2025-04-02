# تعریف باکت S3
resource "aws_s3_bucket" "frontend_bucket" {
  bucket = "transaction-simulator-frontend-${random_string.suffix.result}"
  force_destroy = true
}

# غیرفعال کردن Block Public Access
resource "aws_s3_bucket_public_access_block" "frontend_public_access" {
  bucket = aws_s3_bucket.frontend_bucket.id
  block_public_acls       = false
  block_public_policy     = false
  ignore_public_acls      = false
  restrict_public_buckets = false
}

# سیاست عمومی برای دسترسی به فایل‌ها
resource "aws_s3_bucket_policy" "frontend_policy" {
  bucket = aws_s3_bucket.frontend_bucket.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "PublicReadGetObject"
        Effect    = "Allow"
        Principal = "*"
        Action    = "s3:GetObject"
        Resource  = "${aws_s3_bucket.frontend_bucket.arn}/*"
      }
    ]
  })
  depends_on = [aws_s3_bucket_public_access_block.frontend_public_access]
}

# آپلود فایل‌های بیلد فرانت‌اند
resource "aws_s3_object" "frontend_files" {
  for_each = fileset("../frontend/dist", "**")
  bucket   = aws_s3_bucket.frontend_bucket.id
  key      = each.value
  source   = "../frontend/dist/${each.value}"
  content_type = lookup({
    ".html" = "text/html"
    ".css"  = "text/css"
    ".js"   = "application/javascript"
  }, regex("\\.[^.]+$", each.value), "application/octet-stream")
  etag = filemd5("../frontend/dist/${each.value}")
}

# تولید یه suffix رندوم با حروف کوچک
resource "random_string" "suffix" {
  length  = 8
  special = false
  upper   = false
}

# تنظیمات وب‌سایت
resource "aws_s3_bucket_website_configuration" "frontend_website" {
  bucket = aws_s3_bucket.frontend_bucket.id
  index_document {
    suffix = "index.html"
  }
  error_document {
    key = "index.html"  # برای SPA مثل React
  }
}

# تنظیمات CORS برای S3
resource "aws_s3_bucket_cors_configuration" "frontend_cors" {
  bucket = aws_s3_bucket.frontend_bucket.id
  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["GET", "HEAD","PUT","DELETE"]
    allowed_origins = ["*"]
    max_age_seconds = 3000
  }
}

# خروجی‌ها
output "website_url" {
  value = "http://${aws_s3_bucket.frontend_bucket.bucket}.s3-website-us-east-1.amazonaws.com"
}