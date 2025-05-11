# AIVault Password Manager

AIVault is a secure browser extension for managing passwords with an integrated AI assistant to provide security advice and password management tips.

## Features

### Password Management
- Securely store and manage website credentials
- Auto-save new login credentials
- Auto-fill saved credentials on login pages
- Generate strong, unique passwords
- Password strength evaluation
- Password expiry notifications

### Enhanced Security
- AES-256 encryption for all stored data
- Master password protection
- No cloud storage of your sensitive data (local storage only)
- Auto-lock for security
- Password expiry tracking

### Two-Factor Authentication (2FA)
- Built-in TOTP generator for 2FA accounts
- Securely store TOTP secrets
- Convenient copy-to-clipboard functionality

### AI Assistant
- Get personalized security advice
- Learn password best practices
- Ask questions about cybersecurity
- Password strength analysis

### Password Sharing
- Securely share credentials with others
- QR code generation for easy sharing
- Time-limited access controls

## Installation

### From Source Code
1. Clone this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" in the top-right corner
4. Click "Load unpacked" and select the AIVault directory
5. The extension should now appear in your extensions list

### From Chrome Web Store (Coming Soon)
1. Visit the Chrome Web Store
2. Search for "AIVault Password Manager"
3. Click "Add to Chrome"

## Usage

### First-Time Setup
1. Click the AIVault icon in your browser toolbar
2. Create a master password
   - This password will be used to encrypt and decrypt your vault
   - Make it strong but memorable - if you forget it, your data cannot be recovered
3. Your vault is now ready to use

### Saving Passwords
AIVault will automatically detect when you log in to a website and offer to save your credentials. You can also:
1. Click the AIVault icon in your toolbar
2. Click the "Add Password" button
3. Enter the website, username, and password
4. Click "Save"

### Auto-Fill
When you visit a login page for a site with saved credentials:
1. Click the key icon that appears in the password field
2. Your credentials will be auto-filled
3. If you have multiple accounts for a site, you'll be able to choose which one to use

### Managing 2FA
1. Open the AIVault popup
2. Navigate to the 2FA tab
3. Click "Add 2FA Account"
4. Enter the account name and secret key
5. TOTP codes will be generated automatically

### Using the AI Assistant
1. Open the AIVault popup
2. Navigate to the Assistant tab
3. Type your security question or request
4. Get personalized guidance and advice

## Security Information

AIVault takes your security seriously:

- All data is encrypted with AES-256 before storage
- Your master password never leaves your device
- No data is transmitted to external servers (except anonymous usage statistics if enabled)
- The vault automatically locks after a period of inactivity

## Privacy

AIVault respects your privacy:
- No tracking of browsing habits
- No collection of personal data
- No sharing data with third parties
- Optional anonymous usage statistics to help improve the product

## License

MIT

## Contact

babaevio@proton.me

---

*AIVault - Secure your digital life with the power of AI*