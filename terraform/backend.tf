terraform {
  backend "s3" {
    # These values will be overridden by -backend-config parameters in CodeBuild
    bucket = "transaction-simulator-terraform-state-us-east-1-864981715490"
    key    = "terraform/transaction-simulator.tfstate"
    region = "us-east-1"
    
    # Enable state locking and consistency checking
    dynamodb_table = "transaction-simulator-terraform-locks"
    encrypt        = true
  }
  
  required_version = ">= 1.0"
  
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}