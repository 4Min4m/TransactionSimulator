# waf.tf
# Regional WAFv2 Web ACL protecting the API Gateway stage: AWS managed rule
# groups + a rate-based rule to blunt volumetric abuse.

resource "aws_wafv2_web_acl" "api" {
  name        = "transaction-simulator-api-acl"
  description = "Protects the TransactionSimulator API."
  scope       = "REGIONAL"

  default_action {
    allow {}
  }

  # 1) AWS Common Rule Set (OWASP-style protections).
  rule {
    name     = "AWSCommonRules"
    priority = 1
    override_action {
      none {}
    }
    statement {
      managed_rule_group_statement {
        vendor_name = "AWS"
        name        = "AWSManagedRulesCommonRuleSet"
      }
    }
    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "AWSCommonRules"
      sampled_requests_enabled   = true
    }
  }

  # 2) Known bad inputs (exploit signatures).
  rule {
    name     = "AWSKnownBadInputs"
    priority = 2
    override_action {
      none {}
    }
    statement {
      managed_rule_group_statement {
        vendor_name = "AWS"
        name        = "AWSManagedRulesKnownBadInputsRuleSet"
      }
    }
    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "AWSKnownBadInputs"
      sampled_requests_enabled   = true
    }
  }

  # 3) Rate limit: block an IP exceeding 2000 requests / 5 minutes (general
  #    traffic across the whole API).
  rule {
    name     = "RateLimit"
    priority = 3
    action {
      block {}
    }
    statement {
      rate_based_statement {
        limit              = 2000
        aggregate_key_type = "IP"
      }
    }
    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "RateLimit"
      sampled_requests_enabled   = true
    }
  }

  # 4) Stricter rate limit scoped ONLY to /api/login: the general 2000/5min
  #    rule above is far too loose to slow down password guessing against a
  #    single admin account. This blocks an IP sending more than 60
  #    login attempts in 5 minutes, regardless of how much other traffic
  #    it's sending elsewhere.
  rule {
    name     = "LoginBruteForceRateLimit"
    priority = 4
    action {
      block {}
    }
    statement {
      rate_based_statement {
        limit              = 60
        aggregate_key_type = "IP"
        scope_down_statement {
          byte_match_statement {
            # ENDS_WITH (not EXACTLY): for an API Gateway REST API, WAF sees
            # the full stage-prefixed path (e.g. "/prod/api/login"), NOT the
            # bare "/api/login" the Lambda code sees. An EXACTLY match on
            # "/api/login" would never fire, silently disabling this rule.
            # ENDS_WITH is correct regardless of the stage name.
            search_string = "/api/login"
            field_to_match {
              uri_path {}
            }
            text_transformation {
              priority = 0
              type     = "LOWERCASE"
            }
            positional_constraint = "ENDS_WITH"
          }
        }
      }
    }
    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "LoginBruteForceRateLimit"
      sampled_requests_enabled   = true
    }
  }

  visibility_config {
    cloudwatch_metrics_enabled = true
    metric_name                = "transaction-simulator-api-acl"
    sampled_requests_enabled   = true
  }
}

# Attach the Web ACL to the API Gateway stage.
resource "aws_wafv2_web_acl_association" "api" {
  resource_arn = aws_api_gateway_stage.prod_stage.arn
  web_acl_arn  = aws_wafv2_web_acl.api.arn
}

# --- WAF logging ------------------------------------------------------------
# Full request logs for blocked/allowed decisions. The Authorization header is
# redacted so JWTs never land in the logs. The log group name must start
# with "aws-waf-logs-".
resource "aws_cloudwatch_log_group" "waf" {
  #checkov:skip=CKV_AWS_158:AWS-managed encryption; customer-managed KMS is a roadmap item.
  #checkov:skip=CKV_AWS_338:30-day retention is a deliberate cost choice for a demo stack.
  name              = "aws-waf-logs-transaction-simulator"
  retention_in_days = 30
}

resource "aws_wafv2_web_acl_logging_configuration" "api" {
  resource_arn            = aws_wafv2_web_acl.api.arn
  log_destination_configs = [aws_cloudwatch_log_group.waf.arn]

  redacted_fields {
    single_header {
      name = "authorization"
    }
  }
}
