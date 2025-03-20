/**
 * Validate a card number
 * @param {string} cardNumber - The card number to validate
 * @returns {boolean} True if valid, false otherwise
 */
function validateCardNumber(cardNumber) {
    return /^\d{16}$/.test(cardNumber);
  }
  
  module.exports = {
    validateCardNumber
  };