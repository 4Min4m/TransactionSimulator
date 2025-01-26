from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from app.models.transaction import TransactionRequest, TransactionResponse
from app.models.batch import BatchRequest, BatchResponse
from app.services.transaction_service import process_transaction
from app.services.batch_service import process_batch
from app.utils.supabase_client import supabase

app = FastAPI()

# CORS middleware to allow frontend communication
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/process-transaction", response_model=TransactionResponse)
async def process_transaction_endpoint(transaction: TransactionRequest):
    try:
        return process_transaction(transaction)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/process-batch", response_model=BatchResponse)
async def process_batch_endpoint(batch: BatchRequest):
    try:
        return process_batch(batch)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/transactions")
async def get_transactions():
    try:
        result = supabase.table("transactions").select("*").execute()
        return result.data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))