/**
 * Password Sharing Module for AIVault
 * Handles secure password sharing between users
 */

class PasswordSharingModule {
  /**
   * Creates a shareable password package
   * @param {Object} passwordData - The password data to share
   * @param {string} recipientEmail - Optional recipient email for additional security
   * @returns {Object} - The shareable package and encryption key
   */
  static createShareablePassword(passwordData, recipientEmail = null) {
    // Generate a random key for package encryption
    const key = this.generateRandomKey(12);
    
    // Create the package object
    const packageObj = {
      website: passwordData.website,
      username: passwordData.username,
      // The actual password is encrypted separately with the key
      encryptedPassword: CryptoJS.AES.encrypt(passwordData.password, key).toString(),
      created: Date.now(),
      expires: Date.now() + (7 * 24 * 60 * 60 * 1000), // 7 days default
      recipientEmail: recipientEmail
    };
    
    return {
      package: packageObj,
      key: key
    };
  }
  
  /**
   * Generates a share URL from a package
   * @param {Object} packageObj - The password package
   * @param {string} key - The encryption key (not included in URL)
   * @returns {string} - The shareable URL
   */
  static generateShareURL(packageObj, key) {
    // Convert package to JSON and encode
    const packageData = JSON.stringify(packageObj);
    const encodedData = btoa(packageData);
    
    // Create the share URL (without the key)
    return `https://aivault.app/share#${encodedData}`;
  }
  
  /**
   * Generates a QR code for a share URL
   * @param {string} shareURL - The share URL
   * @returns {string} - Data URL for the QR code image
   */
  static generateQRCode(shareURL) {
    // This is a simplified version. In a real extension, we would use a QR code library
    // For now, we'll use a fake QR code generation API URL
    const encodedURL = encodeURIComponent(shareURL);
    return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodedURL}`;
  }
  
  /**
   * Decodes a share URL and decrypts the password
   * @param {string} shareURL - The share URL
   * @param {string} key - The decryption key
   * @returns {Object} - The decrypted password data
   */
  static decodeShareURL(shareURL, key) {
    try {
      // Extract the encoded data from the URL
      const hashPart = shareURL.split('#')[1];
      if (!hashPart) {
        throw new Error('Invalid share URL');
      }
      
      // Decode the data
      const packageData = atob(hashPart);
      const packageObj = JSON.parse(packageData);
      
      // Check if the share has expired
      if (packageObj.expires < Date.now()) {
        throw new Error('This shared password has expired');
      }
      
      // Decrypt the password
      const decryptedPassword = CryptoJS.AES.decrypt(
        packageObj.encryptedPassword, 
        key
      ).toString(CryptoJS.enc.Utf8);
      
      if (!decryptedPassword) {
        throw new Error('Invalid decryption key');
      }
      
      // Return the complete password data
      return {
        website: packageObj.website,
        username: packageObj.username,
        password: decryptedPassword
      };
    } catch (error) {
      console.error('Error decoding share URL:', error);
      throw new Error('Failed to decode shared password: ' + error.message);
    }
  }
  
  /**
   * Generates a random alphanumeric key
   * @param {number} length - The length of the key
   * @returns {string} - The generated key
   */
  static generateRandomKey(length = 12) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    
    const randomValues = new Uint8Array(length);
    window.crypto.getRandomValues(randomValues);
    
    for (let i = 0; i < length; i++) {
      result += chars.charAt(randomValues[i] % chars.length);
    }
    
    return result;
  }
}

// Export the module
window.PasswordSharingModule = PasswordSharingModule;