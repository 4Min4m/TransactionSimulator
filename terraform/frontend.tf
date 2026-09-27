# frontend.tf
# Static frontend served ONLY through CloudFront (HTTPS) with an
# Origin Access Control (OAC) lock on a fully private S3 bucket.

# --- S3 bucket (private) -------------------------------------------------
resource "aws_s3_bucket" "frontend_bucket" {
  bucket        = "transaction-simulator-frontend-${random_string.suffix.result}"
  force_destroy = true
}

resource "random_string" "suffix" {
  length  = 8
  special = false
  upper   = false
}

# Block ALL public access. The bucket is reachable only via CloudFront/OAC.
resource "aws_s3_bucket_public_access_block" "frontend_public_access" {
  bucket                  = aws_s3_bucket.frontend_bucket.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# Bucket policy: allow ONLY this CloudFront distribution to read objects.
resource "aws_s3_bucket_policy" "frontend_policy" {
  bucket = aws_s3_bucket.frontend_bucket.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "AllowCloudFrontOACRead"
        Effect    = "Allow"
        Principal = { Service = "cloudfront.amazonaws.com" }
        Action    = "s3:GetObject"
        Resource  = "${aws_s3_bucket.frontend_bucket.arn}/*"
        Condition = {
          StringEquals = {
            "AWS:SourceArn" = aws_cloudfront_distribution.frontend.arn
          }
        }
      }
    ]
  })

  depends_on = [aws_s3_bucket_public_access_block.frontend_public_access]
}

# Upload built assets. content_type inferred from extension.
resource "aws_s3_object" "frontend_files" {
  for_each = fileset("../frontend/dist", "**")
  bucket   = aws_s3_bucket.frontend_bucket.id
  key      = each.value
  source   = "../frontend/dist/${each.value}"
  content_type = lookup({
    ".html" = "text/html"
    ".css"  = "text/css"
    ".js"   = "application/javascript"
    ".svg"  = "image/svg+xml"
    ".json" = "application/json"
    ".png"  = "image/png"
    ".ico"  = "image/x-icon"
  }, regex("\\.[^.]+$", each.value), "application/octet-stream")
  etag = filemd5("../frontend/dist/${each.value}")
}

# --- CloudFront + OAC ----------------------------------------------------
resource "aws_cloudfront_origin_access_control" "frontend_oac" {
  name                              = "transaction-simulator-frontend-oac"
  description                       = "OAC for the TransactionSimulator frontend bucket"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

resource "aws_cloudfront_distribution" "frontend" {
  enabled             = true
  is_ipv6_enabled     = true
  comment             = "TransactionSimulator frontend"
  default_root_object = "index.html"
  price_class         = "PriceClass_100"

  origin {
    # REST endpoint (regional domain), NOT the S3 website endpoint.
    domain_name              = aws_s3_bucket.frontend_bucket.bucket_regional_domain_name
    origin_id                = "s3-frontend"
    origin_access_control_id = aws_cloudfront_origin_access_control.frontend_oac.id
  }

  default_cache_behavior {
    target_origin_id       = "s3-frontend"
    viewer_protocol_policy = "redirect-to-https" # force HTTPS
    allowed_methods        = ["GET", "HEAD", "OPTIONS"]
    cached_methods         = ["GET", "HEAD"]
    compress               = true

    forwarded_values {
      query_string = false
      cookies {
        forward = "none"
      }
    }

    min_ttl     = 0
    default_ttl = 3600
    max_ttl     = 86400
  }

  # SPA routing: react-router deep links must resolve to index.html.
  custom_error_response {
    error_code            = 403
    response_code         = 200
    response_page_path    = "/index.html"
    error_caching_min_ttl = 0
  }
  custom_error_response {
    error_code            = 404
    response_code         = 200
    response_page_path    = "/index.html"
    error_caching_min_ttl = 0
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  # Default *.cloudfront.net certificate provides HTTPS out of the box.
  # Swap to acm_certificate_arn (in us-east-1) when you add a custom domain.
  viewer_certificate {
    cloudfront_default_certificate = true
  }
}
