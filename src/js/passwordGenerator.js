/**
 * Password Generator Module for AIVault
 * Provides functionality to generate secure random passwords
 */

class PasswordGenerator {
  // Character sets for password generation
  static UPPERCASE = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  static LOWERCASE = 'abcdefghijklmnopqrstuvwxyz';
  static NUMBERS = '0123456789';
  static SYMBOLS = '!@#$%^&*()_+{}[]|:;"<>,.?/~`-=';
  
  /**
   * Generates a random password based on specified options
   * @param {Object} options - Password generation options
   * @param {number} options.length - Password length (default: 16)
   * @param {boolean} options.uppercase - Include uppercase letters (default: true)
   * @param {boolean} options.lowercase - Include lowercase letters (default: true)
   * @param {boolean} options.numbers - Include numbers (default: true)
   * @param {boolean} options.symbols - Include special symbols (default: true)
   * @returns {string} - Generated password
   */
  static generatePassword(options = {}) {
    // Default options
    const config = {
      length: options.length || 16,
      uppercase: options.uppercase !== undefined ? options.uppercase : true,
      lowercase: options.lowercase !== undefined ? options.lowercase : true,
      numbers: options.numbers !== undefined ? options.numbers : true,
      symbols: options.symbols !== undefined ? options.symbols : true
    };
    
    // Ensure at least one character type is selected
    if (!config.uppercase && !config.lowercase && !config.numbers && !config.symbols) {
      config.lowercase = true; // Default to lowercase if nothing selected
    }
    
    // Build character set based on options
    let charSet = '';
    if (config.uppercase) charSet += this.UPPERCASE;
    if (config.lowercase) charSet += this.LOWERCASE;
    if (config.numbers) charSet += this.NUMBERS;
    if (config.symbols) charSet += this.SYMBOLS;
    
    // Generate password
    let password = '';
    const charSetLength = charSet.length;
    
    // Create random password by selecting random characters
    for (let i = 0; i < config.length; i++) {
      const randomIndex = Math.floor(Math.random() * charSetLength);
      password += charSet.charAt(randomIndex);
    }
    
    // Ensure password includes at least one character from each selected type
    if (!this.validatePassword(password, config)) {
      return this.generatePassword(config); // Regenerate if requirements not met
    }
    
    return password;
  }
  
  /**
   * Validates that a password meets the selected requirements
   * @param {string} password - The password to validate
   * @param {Object} options - The options used to generate the password
   * @returns {boolean} - Whether the password meets all requirements
   */
  static validatePassword(password, options) {
    const hasUppercase = options.uppercase ? /[A-Z]/.test(password) : true;
    const hasLowercase = options.lowercase ? /[a-z]/.test(password) : true;
    const hasNumbers = options.numbers ? /[0-9]/.test(password) : true;
    const hasSymbols = options.symbols ? /[!@#$%^&*()_+{}[\]|:;"<>,.?/~`\-=]/.test(password) : true;
    
    return hasUppercase && hasLowercase && hasNumbers && hasSymbols;
  }
  
  /**
   * Evaluates password strength
   * @param {string} password - The password to evaluate
   * @returns {Object} - Strength evaluation { score, label }
   */
  static evaluateStrength(password) {
    if (!password) {
      return { score: 0, label: 'None' };
    }
    
    // Initial score based on length
    let score = Math.min(Math.floor(password.length / 4), 5);
    
    // Check for character type variety
    if (/[A-Z]/.test(password)) score += 1;
    if (/[a-z]/.test(password)) score += 1;
    if (/[0-9]/.test(password)) score += 1;
    if (/[^A-Za-z0-9]/.test(password)) score += 2;
    
    // Check for complexity patterns
    if (/[A-Z].*[A-Z]/.test(password)) score += 1; // Multiple uppercase
    if (/[a-z].*[a-z]/.test(password)) score += 1; // Multiple lowercase
    if (/[0-9].*[0-9]/.test(password)) score += 1; // Multiple numbers
    if (/[^A-Za-z0-9].*[^A-Za-z0-9]/.test(password)) score += 1; // Multiple symbols
    
    // Deduct for sequential or repeating patterns
    if (/(.)\1\1/.test(password)) score -= 1; // Three or more repeated characters
    if (/(?:abc|bcd|cde|def|efg|fgh|ghi|hij|ijk|jkl|klm|lmn|mno|nop|opq|pqr|qrs|rst|stu|tuv|uvw|vwx|wxy|xyz)/i.test(password)) {
      score -= 1; // Sequential letters
    }
    if (/(?:012|123|234|345|456|567|678|789)/.test(password)) {
      score -= 1; // Sequential numbers
    }
    
    // Normalize score to 0-100
    score = Math.max(0, Math.min(10, score));
    const normalizedScore = score * 10;
    
    // Map score to label
    let label;
    if (normalizedScore >= 80) label = 'Strong';
    else if (normalizedScore >= 50) label = 'Medium';
    else label = 'Weak';
    
    return { 
      score: normalizedScore, 
      label: label
    };
  }
}

// Export the module
window.PasswordGenerator = PasswordGenerator;