from app.services.batch_service import process_batch

def test_process_batch():
    batch = {
        "total_transactions": 10,
        "total_amount": 1000.0,
        "duration_seconds": 10,
        "merchant_id": "MERCH001",
    }
    response = process_batch(batch)
    assert isinstance(response, dict)
    assert "success_count" in response