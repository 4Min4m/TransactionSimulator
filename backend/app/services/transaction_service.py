from datetime import datetime
from app.models.transaction import TransactionResponse
from app.utils.supabase_client import supabase
import random
import time

def generate_iso8583_message(transaction, response_code):
    """
    Generate an ISO 8583 message based on the transaction data.
    
    :param transaction: The transaction data (dict or Pydantic model)
    :param response_code: The response code (e.g., "00" for approved, "05" for declined)
    :return: ISO 8583 message as a dictionary
    """
    return {
        "mti": "0110",  # Message Type Indicator (0110 for financial transaction response)
        "primaryAccountNumber": transaction.card_number,
        "processingCode": "000000",  # Example processing code
        "amount": transaction.amount,
        "transmissionDateTime": datetime.now().strftime("%Y%m%d%H%M%S"),  # Current timestamp
        "systemTraceNumber": str(random.randint(100000, 999999)),  # Random trace number
        "localTransactionTime": datetime.now().strftime("%H:%M:%S"),  # Current time
        "localTransactionDate": datetime.now().strftime("%m/%d/%Y"),  # Current date
        "merchantType": "5999",  # Example merchant type
        "responseCode": response_code,
        "terminalId": "TERM001",  # Example terminal ID
        "merchantId": transaction.merchant_id,
    }

def process_transaction(transaction) -> TransactionResponse:
    # Simulate processing delay
    time.sleep(random.uniform(0.1, 1.0))

    # Simple validation and approval logic
    is_approved = random.random() < 0.9  # 90% success rate
    response_code = "00" if is_approved else "05"
    authorization_code = (
        "".join(random.choices("ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789", k=6))
        if is_approved
        else None
    )

    # Generate ISO 8583 message
    iso8583_message = generate_iso8583_message(transaction, response_code)

    # Prepare transaction data for Supabase
    transaction_data = {
        "card_number": transaction.card_number,
        "amount": transaction.amount,
        "merchant_id": transaction.merchant_id,
        "status": "APPROVED" if is_approved else "DECLINED",
        "type": "PURCHASE",
        "timestamp": datetime.now().isoformat(),
        "created_at": datetime.now().isoformat(),
        "updated_at": datetime.now().isoformat(),
        "iso8583_message": iso8583_message,
    }

    # Store transaction in Supabase
    supabase.table("transactions").insert(transaction_data).execute()

    return TransactionResponse(
        success=is_approved,
        message="Transaction approved" if is_approved else "Transaction declined",
        data=transaction.dict(),
        response_code=response_code,
        authorization_code=authorization_code,
    )