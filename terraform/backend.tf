terraform {
  backend "s3" {
    # `bucket` and `dynamodb_table`
    # are deliberately left unset here; they are supplied at `terraform init`
    # time via `-backend-config` (see .github/workflows/ci-cd.yml, which
    # reads them from the TF_STATE_BUCKET / TF_STATE_LOCK_TABLE GitHub
    # secrets) or, for local use, via `terraform init -backend-config=...`
    # or an untracked backend.hcl file. Never hardcode real values here.
    key     = "terraform/transaction-simulator.tfstate"
    region  = "us-east-1"
    encrypt = true
  }

  required_version = ">= 1.5"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.0"
    }
    archive = {
      source  = "hashicorp/archive"
      version = "~> 2.4"
    }
  }
}
