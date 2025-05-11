/**
 * TOTP Module for AIVault
 * Handles Time-based One-Time Password (TOTP) functionality for 2FA
 */

class TOTPModule {
  /**
   * Generates a TOTP code from a secret key
   * @param {string} secret - The Base32 encoded secret key
   * @param {number} period - The time period in seconds (default: 30)
   * @param {number} digits - The number of digits in the code (default: 6)
   * @returns {string} - The generated TOTP code
   */
  static generateTOTP(secret, period = 30, digits = 6) {
    try {
      // Clean up secret (remove spaces)
      secret = secret.replace(/\s+/g, '').toUpperCase();
      
      // Get the current time in seconds
      const now = Math.floor(Date.now() / 1000);
      
      // Calculate the counter value (time / period)
      const counter = Math.floor(now / period);
      
      // Generate HMAC-SHA1 hash
      const shaObj = new jsSHA("SHA-1", "HEX");
      
      // Convert secret from Base32 to hex
      const hexSecret = this.base32ToHex(secret);
      
      // Set the HMAC key
      shaObj.setHMACKey(hexSecret, "HEX");
      
      // Update with counter value in big-endian format
      const counterHex = this.intToHex(counter);
      shaObj.update(counterHex);
      
      // Get the HMAC hash
      const hmac = shaObj.getHMAC("HEX");
      
      // Get the offset (last nibble of the hash)
      const offset = parseInt(hmac.charAt(hmac.length - 1), 16);
      
      // Get 4 bytes from the hash at the offset
      const binary = parseInt(hmac.substr(offset * 2, 8), 16) & 0x7fffffff;
      
      // Calculate the TOTP code
      const otp = binary % Math.pow(10, digits);
      
      // Pad with leading zeros if necessary
      return otp.toString().padStart(digits, '0');
    } catch (error) {
      console.error('Error generating TOTP:', error);
      return '';
    }
  }
  
  /**
   * Gets the remaining time for the current TOTP period
   * @param {number} period - The time period in seconds (default: 30)
   * @returns {number} - The remaining time in seconds
   */
  static getRemainingTime(period = 30) {
    const now = Math.floor(Date.now() / 1000);
    return period - (now % period);
  }
  
  /**
   * Converts a Base32 string to a hex string
   * @param {string} base32 - The Base32 encoded string
   * @returns {string} - The hex string
   */
  static base32ToHex(base32) {
    const base32Chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    let bits = '';
    let hex = '';
    
    // Convert each character to 5 bits
    for (let i = 0; i < base32.length; i++) {
      const val = base32Chars.indexOf(base32.charAt(i));
      if (val === -1) continue; // Skip invalid characters
      bits += val.toString(2).padStart(5, '0');
    }
    
    // Convert bits to hex (4 bits at a time)
    for (let i = 0; i < bits.length; i += 4) {
      const chunk = bits.substr(i, 4);
      if (chunk.length === 4) {
        hex += parseInt(chunk, 2).toString(16);
      }
    }
    
    return hex;
  }
  
  /**
   * Converts an integer to a hex string (big-endian)
   * @param {number} num - The integer to convert
   * @returns {string} - The hex string
   */
  static intToHex(num) {
    const hex = num.toString(16).padStart(16, '0');
    let result = '';
    
    // Convert to big-endian format
    for (let i = 0; i < 8; i++) {
      result += hex.substr(i * 2, 2);
    }
    
    return result;
  }
  
  /**
   * Validates a TOTP secret key
   * @param {string} secret - The secret key to validate
   * @returns {boolean} - True if valid, false otherwise
   */
  static validateSecret(secret) {
    try {
      // Clean up secret (remove spaces)
      secret = secret.replace(/\s+/g, '').toUpperCase();
      
      // Check if the secret contains only valid Base32 characters
      const base32Regex = /^[A-Z2-7]+$/;
      if (!base32Regex.test(secret)) {
        return false;
      }
      
      // Check if the length is valid
      if (secret.length < 16) {
        return false;
      }
      
      // Try generating a TOTP code
      const code = this.generateTOTP(secret);
      return code.length > 0;
    } catch (error) {
      return false;
    }
  }
  
  /**
   * Generates a QR code URL for a TOTP secret
   * @param {string} secret - The TOTP secret
   * @param {string} account - The account name
   * @param {string} issuer - The issuer name
   * @returns {string} - The URL for the QR code
   */
  static generateQRCodeURL(secret, account, issuer) {
    // Generate the otpauth URL
    const cleanSecret = secret.replace(/\s+/g, '').toUpperCase();
    const otpauthURL = `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(account)}?secret=${cleanSecret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
    
    // Generate a URL for the QR code
    return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(otpauthURL)}`;
  }
}

// Export the module
window.TOTPModule = TOTPModule;