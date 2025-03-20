from pydantic import BaseModel
from typing import List

class BatchRequest(BaseModel):
    total_transactions: int
    total_amount: float
    duration_seconds: int
    merchant_id: str

class BatchResponse(BaseModel):
    success_count: int
    failure_count: int
    average_response_time: float
    total_processed_amount: float
    transactions: List[dict]