from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
from .models.transaction import TransactionRequest, TransactionResponse
from .models.batch import BatchRequest, BatchResponse
from .services.transaction_service import process_transaction
from .services.batch_service import process_batch
from .utils.supabase_client import supabase

app = FastAPI()
app.mount("/static", StaticFiles(directory="frontend/dist", html=True), name="static")
# Allow specific origins
origins = [
    "http://localhost:3000",  # React frontend (or other frontend origin)
    "http://127.0.0.1:3000",
    "http://localhost:5173",
    "https://refactored-acorn-g56qp9w79w7fppgq-5173.app.github.dev",
    "https://refactored-acorn-g56qp9w79w7fppgq-5173.app.github.dev:5173",
    "https://trasimu.onrender.com",  # Render frontend URL
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,  # Allow these origins
    allow_credentials=True,
    allow_methods=["*"],  # Allow all HTTP methods
    allow_headers=["*"],  # Allow all headers
)

# Root endpoint
@app.get("/")
def read_root():
    return {"message": "Welcome to the Payment Simulator API!"}

@app.post("/api/process-transaction", response_model=TransactionResponse)
async def process_transaction_endpoint(transaction: TransactionRequest):
    try:
        return process_transaction(transaction)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/process-batch", response_model=BatchResponse)
async def process_batch_endpoint(batch: BatchRequest):
    try:
        return process_batch(batch)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/api/transactions")
async def get_transactions():
    try:
        result = supabase.table("transactions").select("*").execute()
        return result.data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))