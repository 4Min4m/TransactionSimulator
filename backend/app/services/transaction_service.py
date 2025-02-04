from app.models.transaction import TransactionResponse
from app.utils.supabase_client import supabase
import random
import time
from datetime import datetime

def process_transaction(transaction: dict) -> TransactionResponse:
    # Simulate processing delay
    time.sleep(random.uniform(0.1, 1.0))
    print("Received transaction data:", transaction)
    # Simple validation and approval logic
    is_approved = random.random() < 0.9  # 90% success rate
    response_code = "00" if is_approved else "05"
    authorization_code = (
        "".join(random.choices("ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789", k=6))
        if is_approved
        else None
    )

    # Store transaction in Supabase
    transaction_data = {
        "card_number": transaction.card_number,
        "amount": transaction.amount,
        "merchant_id": transaction.merchant_id,
        "status": "APPROVED" if is_approved else "DECLINED",
        "created_at": datetime.now().isoformat(),
        "updated_at": datetime.now().isoformat(),
    }
    print("Transaction data to be inserted:", transaction_data)
    supabase.table("transactions").insert(transaction_data).execute()

    return TransactionResponse(
        success=is_approved,
        message="Transaction approved" if is_approved else "Transaction declined",
        data=transaction.dict(),
        response_code=response_code,
        authorization_code=authorization_code,
    )