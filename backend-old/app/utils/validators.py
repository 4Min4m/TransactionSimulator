# Example of custom validators (if needed)
def validate_card_number(card_number: str) -> bool:
    return card_number.isdigit() and len(card_number) == 16