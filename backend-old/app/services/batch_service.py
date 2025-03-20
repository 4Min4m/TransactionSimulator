from app.models.batch import BatchRequest, BatchResponse
from app.models.transaction import TransactionRequest  # Import TransactionRequest
from app.services.transaction_service import process_transaction
import time

def process_batch(batch: BatchRequest) -> BatchResponse:
    total_transactions = batch.total_transactions
    amount_per_transaction = batch.total_amount / total_transactions
    delay_between_transactions = batch.duration_seconds / total_transactions

    success_count = 0
    failure_count = 0
    total_response_time = 0
    total_processed_amount = 0
    transactions = []

    for _ in range(total_transactions):
        start_time = time.time()

        # Create a TransactionRequest object
        transaction = TransactionRequest(
            card_number="4111111111111111",  # Mock card number
            amount=amount_per_transaction,
            merchant_id=batch.merchant_id,
        )

        response = process_transaction(transaction)
        if response.success:
            success_count += 1
            total_processed_amount += amount_per_transaction
        else:
            failure_count += 1

        transactions.append(response.dict())
        total_response_time += time.time() - start_time

        # Add delay between transactions
        time.sleep(delay_between_transactions)

    return BatchResponse(
        success_count=success_count,
        failure_count=failure_count,
        average_response_time=total_response_time / total_transactions,
        total_processed_amount=total_processed_amount,
        transactions=transactions,
    )