# frontend.tf
# Static frontend served ONLY through CloudFront (HTTPS) with an
# Origin Access Control (OAC) lock on a fully private S3 bucket.

# --- S3 bucket (private) -------------------------------------------------
resource "aws_s3_bucket" "frontend_bucket" {
  #checkov:skip=CKV_AWS_18:Access logging for a static-site bucket is not worth a second log bucket in a demo stack.
  #checkov:skip=CKV_AWS_21:Contents are a build artifact rebuilt from git on every deploy; git is the version history.
  #checkov:skip=CKV_AWS_144:Rebuilt from git on every deploy; cross-region replication adds cost, not recovery.
  #checkov:skip=CKV_AWS_145:SSE-S3 (AES256) is used; customer-managed KMS is a roadmap item.
  #checkov:skip=CKV2_AWS_61:Objects are overwritten on each deploy; nothing accumulates.
  #checkov:skip=CKV2_AWS_62:No consumer for S3 event notifications.
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

resource "aws_s3_bucket_server_side_encryption_configuration" "frontend_bucket" {
  bucket = aws_s3_bucket.frontend_bucket.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
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

# Security headers on every response. The CSP is the main mitigation for the
# documented trade-off of keeping the JWT in localStorage (see
# frontend/src/services/auth.ts): scripts may only load from this origin, and
# the page may only call its own API.
resource "aws_cloudfront_response_headers_policy" "frontend" {
  name = "transaction-simulator-security-headers"

  security_headers_config {
    content_security_policy {
      override = true
      content_security_policy = join("; ", [
        "default-src 'self'",
        "script-src 'self'",
        # Chart.js and React set inline style attributes.
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data:",
        "font-src 'self'",
        "connect-src 'self' https://${aws_api_gateway_rest_api.api.id}.execute-api.${data.aws_region.current.name}.amazonaws.com",
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
        "frame-ancestors 'none'",
      ])
    }
    strict_transport_security {
      override                   = true
      access_control_max_age_sec = 31536000
      include_subdomains         = true
      preload                    = true
    }
    content_type_options {
      override = true
    }
    frame_options {
      override     = true
      frame_option = "DENY"
    }
    referrer_policy {
      override        = true
      referrer_policy = "strict-origin-when-cross-origin"
    }
  }
}

resource "aws_cloudfront_distribution" "frontend" {
  #checkov:skip=CKV_AWS_68:Static assets only; the API has its own WAF (waf.tf). A CloudFront WAF would add a fixed monthly cost.
  #checkov:skip=CKV2_AWS_47:See CKV_AWS_68.
  #checkov:skip=CKV_AWS_86:CloudFront access logs need an extra ACL-enabled bucket; not worth it for a demo stack.
  #checkov:skip=CKV_AWS_174:The default *.cloudfront.net certificate does not allow setting a minimum TLS version; needs a custom domain + ACM (roadmap).
  #checkov:skip=CKV2_AWS_42:See CKV_AWS_174.
  #checkov:skip=CKV_AWS_310:Single S3 origin; origin failover would need a replicated second bucket.
  #checkov:skip=CKV_AWS_374:No geo restriction requirement for a public demo.
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

    response_headers_policy_id = aws_cloudfront_response_headers_policy.frontend.id

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
