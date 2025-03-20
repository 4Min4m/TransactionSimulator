from dotenv import load_dotenv
import os
from supabase import create_client, Client

load_dotenv("/workspaces/TransactionSimulator/backend/.env")

# Load environment variables
supabase_url = os.getenv("SUPABASE_URL")
supabase_key = os.getenv("SUPABASE_KEY")

if not supabase_url or not supabase_key:
    raise ValueError("Supabase URL and key must be set in environment variables.")

# Initialize Supabase client
supabase: Client = create_client(supabase_url, supabase_key)