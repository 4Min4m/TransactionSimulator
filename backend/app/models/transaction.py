from pydantic import BaseModel, validator
from typing import Optional

class TransactionRequest(BaseModel):
    card_number: str
    amount: float
    merchant_id: str

    @validator("card_number")
    def validate_card_number(cls, value):
        if not value.isdigit() or len(value) != 16:
            raise ValueError("Invalid card number")
        return value

    @validator("amount")
    def validate_amount(cls, value):
        if value <= 0:
            raise ValueError("Amount must be greater than 0")
        return value

class TransactionResponse(BaseModel):
    success: bool
    message: str
    data: dict
    response_code: Optional[str] = None
    authorization_code: Optional[str] = None