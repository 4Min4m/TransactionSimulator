from app.services.transaction_service import process_transaction

def test_process_transaction():
    transaction = {
        "card_number": "4111111111111111",
        "amount": 100.0,
        "merchant_id": "MERCH001",
    }
    response = process_transaction(transaction)
    assert isinstance(response, dict)
    assert "success" in response