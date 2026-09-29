// Primary Account Number (PAN) helpers: format checks, Luhn (mod 10),
// card-scheme detection, and masking. Pure functions, no I/O.

const digitsOnly = (value) => String(value ?? "").replace(/\D/g, "");

// ISO/IEC 7812: PANs are 12-19 digits and end in a Luhn check digit.
const isValidPanFormat = (pan) => /^\d{12,19}$/.test(pan);

const luhnCheck = (pan) => {
  if (!/^\d+$/.test(pan)) return false;
  let sum = 0;
  let double = false;
  for (let i = pan.length - 1; i >= 0; i--) {
    let d = pan.charCodeAt(i) - 48;
    if (double) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    double = !double;
  }
  return sum % 10 === 0;
};

// Scheme detection from the BIN/IIN prefix. Covers the four networks the
// simulator cares about; everything else is reported as UNKNOWN.
const detectScheme = (pan) => {
  if (/^4/.test(pan)) return "VISA";
  if (/^(5[1-5]|222[1-9]|22[3-9]\d|2[3-6]\d{2}|27[01]\d|2720)/.test(pan)) return "MASTERCARD";
  if (/^3[47]/.test(pan)) return "AMEX";
  if (/^(6011|65|64[4-9])/.test(pan)) return "DISCOVER";
  return "UNKNOWN";
};

// Mask to `1234-****-****-5678` (first 4 + last 4). Inputs too short to
// expose anything safely are fully masked. This is the ONLY representation
// of a PAN that is ever persisted or logged.
const maskCardNumber = (rawPan) => {
  if (rawPan === undefined || rawPan === null) return "****";
  const digits = digitsOnly(rawPan);
  if (digits.length < 8) return "****";
  return `${digits.slice(0, 4)}-****-****-${digits.slice(-4)}`;
};

module.exports = { digitsOnly, isValidPanFormat, luhnCheck, detectScheme, maskCardNumber };
