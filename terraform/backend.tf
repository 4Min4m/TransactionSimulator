    terraform {
      backend "s3" {
        bucket         = "transaction-simulator-terraform-tfstate"
        key            = "transaction-simulator/terraform.tfstate"
        region         = "us-east-1"
        dynamodb_table = "terraform-state-lock-table"
        encrypt        = true
      }
    }