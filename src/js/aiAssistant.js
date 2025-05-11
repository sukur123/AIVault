/**
 * AI Assistant Module for AIVault
 * Provides AI-powered password analysis and security advice
 * Uses web-llm for local inference without external API calls
 */

class AIAssistant {
  constructor() {
    // Model state tracking
    this.isModelLoaded = false;
    this.isModelLoading = false;
    this.model = null;
    this.modelLoadPromise = null;
    
    // Store predefined responses for common queries
    this.knowledgeBase = {
      'what is a strong password': `A strong password typically has:
- At least 12 characters (longer is better)
- A mix of uppercase and lowercase letters
- Numbers and special characters
- No common dictionary words or personal information
- No obvious patterns like "123456" or "qwerty"
- Uniqueness (not used on multiple sites)`,
      
      'how do i set up 2fa': `To set up two-factor authentication (2FA):
1. Go to the security settings of your account
2. Look for "Two-factor authentication" or "2FA" options
3. Choose your preferred 2FA method (app, SMS, email)
4. Follow the site-specific instructions to enable it
5. Save backup codes in a secure place in case you lose access to your 2FA device`,
      
      'why is password security important': `Password security is crucial because:
- It protects your personal and financial information
- Prevents unauthorized access to your accounts
- Safeguards your digital identity
- Prevents attacks that could compromise all your accounts
- Keeps your private communications private
- Helps protect others you communicate with`,
      
      'what is password manager': `A password manager is a secure application that:
- Stores all your passwords in an encrypted vault
- Generates strong, unique passwords for each site
- Fills in login credentials automatically
- Requires only one master password to access
- Helps prevent phishing by recognizing legitimate sites
- Often includes features like secure notes and password sharing`,
      
      'what is 2fa': `Two-Factor Authentication (2FA) is a security method that:
- Requires two different types of verification to log in
- Combines something you know (password) with something you have (phone/token)
- Makes accounts much harder to hack, even if password is compromised
- Can use authenticator apps, SMS codes, email codes, or physical security keys
- Significantly increases your online security with minimal inconvenience`,
      
      'what is phishing': `Phishing is a cyber attack where:
- Attackers impersonate trusted entities via email, message, or fake websites
- They trick victims into revealing sensitive information like passwords
- They may include urgent requests or threats to prompt immediate action
- Links often lead to convincing but fake login pages
- Defenses include checking URLs carefully, using password managers, and enabling 2FA`,
      
      'how often should i change my password': `Best practices for password changes:
- Change passwords when there's a reason (breach, suspected compromise)
- Use unique passwords for each account rather than changing regularly
- Focus on password strength and uniqueness rather than frequent changes
- Enable breach notifications from services like Have I Been Pwned
- Use a password manager to maintain many strong, unique passwords`,
      
      'password reuse risks': `Reusing passwords across different sites is dangerous because:
- If one site is breached, attackers can access all your accounts
- Many breaches happen without users knowing for months
- Criminals use "credential stuffing" to automatically try stolen passwords on many sites
- Even changing part of the password (e.g., adding a number) isn't secure
- Password managers make using unique passwords easy`,
      
      'what is biometric authentication': `Biometric authentication uses unique physical characteristics:
- Includes fingerprints, facial recognition, iris scans, or voice patterns
- Offers convenience (no passwords to remember)
- Adds an additional factor of "something you are"
- Can't be forgotten like passwords
- Hard to replicate or steal (but not impossible)
- Best used as part of multi-factor authentication, not alone`,
      
      'how to protect from keyloggers': `Protect against keyloggers with these measures:
- Use up-to-date antivirus and anti-malware software
- Enable 2FA wherever possible
- Use a password manager with autofill functionality
- Consider using an on-screen keyboard for sensitive entries
- Keep your operating system and browsers updated
- Be cautious when installing software from unknown sources
- Use biometric login when available`
    };
    
    // Password strength analysis parameters
    this.passwordStrengthRules = {
      minLength: 8,
      recommendedLength: 12,
      hasLowercase: /[a-z]/,
      hasUppercase: /[A-Z]/,
      hasNumbers: /[0-9]/,
      hasSymbols: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/,
      hasRepeatingChars: /(.)\1{2,}/,
      commonPatterns: [
        /12345/, /qwerty/, /asdfgh/, /zxcvbn/, /abc123/, /password/i, 
        /letmein/i, /welcome/i, /admin/i, /login/i
      ],
      commonWords: [
        'password', 'qwerty', 'welcome', 'admin', 'login', 'user', 
        'letmein', 'baseball', 'football', 'monkey', 'dragon', 'master'
      ]
    };
  }
  
  /**
   * Initializes and loads the AI model
   * @returns {Promise<boolean>} - Success status
   */
  async initializeModel() {
    // If already loading, return the existing promise
    if (this.isModelLoading) {
      return this.modelLoadPromise;
    }
    
    // If already loaded, return success
    if (this.isModelLoaded) {
      return Promise.resolve(true);
    }
    
    // Start loading the model
    this.isModelLoading = true;
    
    this.modelLoadPromise = new Promise(async (resolve) => {
      try {
        // Check if web-llm is available
        if (typeof WebLLM !== 'undefined') {
          console.log('Initializing web-llm...');
          
          try {
            // Check if the WebLLM library actually has the necessary methods
            if (typeof WebLLM.prototype.load !== 'function' || typeof WebLLM.prototype.chat !== 'function') {
              console.warn('WebLLM API is incorrect, using fallback responses');
              this.isModelLoaded = false;
              resolve(false);
              return;
            }
            
            // Initialize with a small model
            this.model = new WebLLM({
              modelId: 'tinyllama',
              wasmUrl: chrome.runtime.getURL('/lib/web-llm-wasm.wasm'),
              debug: false
            });
            
            // Set a timeout for model loading in case it hangs
            const timeoutPromise = new Promise(resolveTimeout => {
              setTimeout(() => {
                console.warn('WebLLM model loading timed out, using fallback responses');
                resolveTimeout(false);
              }, 15000); // 15 second timeout
            });
            
            // Load the model with timeout
            const loadResult = await Promise.race([
              this.model.load(),
              timeoutPromise
            ]);
            
            if (loadResult === false) {
              this.isModelLoaded = false;
            } else {
              this.isModelLoaded = true;
              console.log('AI model loaded successfully');
            }
            resolve(this.isModelLoaded);
          } catch (modelError) {
            console.error('Error loading AI model:', modelError);
            this.isModelLoaded = false;
            resolve(false);
          }
        } else {
          console.warn('WebLLM not available, using fallback responses');
          this.isModelLoaded = false;
          resolve(false);
        }
      } catch (error) {
        console.error('Error initializing AI:', error);
        this.isModelLoaded = false;
        resolve(false);
      } finally {
        this.isModelLoading = false;
      }
    });
    
    return this.modelLoadPromise;
  }
  
  /**
   * Analyzes the strength of a password with detailed feedback
   * @param {string} password - Password to analyze
   * @returns {Object} - Analysis results with score and feedback
   */
  analyzePasswordStrength(password) {
    if (!password) {
      return {
        score: 0,
        label: 'None',
        issues: ['No password provided'],
        suggestions: ['Enter a password to analyze']
      };
    }
    
    let score = 0;
    const issues = [];
    const suggestions = [];
    
    // Length checks
    if (password.length < this.passwordStrengthRules.minLength) {
      issues.push(`Password is too short (${password.length} characters)`);
      suggestions.push(`Use at least ${this.passwordStrengthRules.minLength} characters`);
      // No score for very short passwords
    } else {
      // Base score from length - up to 40 points
      score += Math.min(40, password.length * 3);
      
      if (password.length < this.passwordStrengthRules.recommendedLength) {
        suggestions.push(`Consider using at least ${this.passwordStrengthRules.recommendedLength} characters for better security`);
      }
    }
    
    // Character composition checks
    const hasLowercase = this.passwordStrengthRules.hasLowercase.test(password);
    const hasUppercase = this.passwordStrengthRules.hasUppercase.test(password);
    const hasNumbers = this.passwordStrengthRules.hasNumbers.test(password);
    const hasSymbols = this.passwordStrengthRules.hasSymbols.test(password);
    
    // Reward character diversity - up to 40 points
    if (hasLowercase) score += 10;
    if (hasUppercase) score += 10;
    if (hasNumbers) score += 10;
    if (hasSymbols) score += 10;
    
    // Track missing character types
    if (!hasLowercase) {
      issues.push('No lowercase letters');
      suggestions.push('Add lowercase letters (a-z)');
    }
    
    if (!hasUppercase) {
      issues.push('No uppercase letters');
      suggestions.push('Add uppercase letters (A-Z)');
    }
    
    if (!hasNumbers) {
      issues.push('No numbers');
      suggestions.push('Add numbers (0-9)');
    }
    
    if (!hasSymbols) {
      issues.push('No symbols');
      suggestions.push('Add symbols (!@#$%^&*)');
    }
    
    // Check for repeating characters
    if (this.passwordStrengthRules.hasRepeatingChars.test(password)) {
      issues.push('Contains repeating characters');
      suggestions.push('Avoid repeating the same character multiple times');
      score -= 10;
    }
    
    // Check for common patterns
    let hasCommonPattern = false;
    for (const pattern of this.passwordStrengthRules.commonPatterns) {
      if (pattern.test(password)) {
        hasCommonPattern = true;
        break;
      }
    }
    
    if (hasCommonPattern) {
      issues.push('Contains a common pattern');
      suggestions.push('Avoid common patterns like "123456" or "qwerty"');
      score -= 20;
    }
    
    // Check for common words
    let hasCommonWord = false;
    for (const word of this.passwordStrengthRules.commonWords) {
      if (password.toLowerCase().includes(word)) {
        hasCommonWord = true;
        break;
      }
    }
    
    if (hasCommonWord) {
      issues.push('Contains a common word');
      suggestions.push('Avoid using common words like "password" or "admin"');
      score -= 20;
    }
    
    // Entropy bonus for truly random-looking passwords
    if (this.calculateEntropy(password) > 3.5) {
      score += 10;
    }
    
    // Ensure score is within 0-100 range
    score = Math.max(0, Math.min(100, score));
    
    // Determine label based on score
    let label;
    if (score < 40) {
      label = 'Weak';
      if (issues.length === 0) {
        issues.push('Password is generally weak');
      }
      if (suggestions.length === 0) {
        suggestions.push('Consider using the password generator for a stronger password');
      }
    } else if (score < 70) {
      label = 'Medium';
    } else {
      label = 'Strong';
    }
    
    return {
      score,
      label,
      issues,
      suggestions
    };
  }
  
  /**
   * Calculates the entropy of a password (randomness measure)
   * @param {string} password - The password to evaluate
   * @returns {number} - Entropy score
   */
  calculateEntropy(password) {
    if (!password || password.length === 0) return 0;
    
    // Count character frequencies
    const charFreq = {};
    for (const char of password) {
      charFreq[char] = (charFreq[char] || 0) + 1;
    }
    
    // Calculate Shannon entropy
    let entropy = 0;
    const len = password.length;
    
    for (const char in charFreq) {
      const freq = charFreq[char] / len;
      entropy -= freq * Math.log2(freq);
    }
    
    return entropy;
  }
  
  /**
   * Handles a user's AI prompt and provides a response
   * @param {string} prompt - User's prompt
   * @returns {Promise<string>} - AI assistant response
   */
  async handlePrompt(prompt) {
    // Clean and normalize the prompt
    const cleanPrompt = prompt.trim().toLowerCase();
    
    // Check knowledge base for exact or partial matches
    for (const [key, response] of Object.entries(this.knowledgeBase)) {
      if (cleanPrompt.includes(key)) {
        return response;
      }
    }
    
    // Check for password generation request
    if (cleanPrompt.includes('generate') && cleanPrompt.includes('password')) {
      const options = this.parsePasswordOptions(cleanPrompt);
      const password = PasswordGenerator.generatePassword(options);
      
      return `Here's a strong generated password: 
      
**${password}**

This password:
- Is ${options.length} characters long
- Includes uppercase letters, lowercase letters, numbers, and symbols
- Has high entropy (randomness)
- Is unique and not based on dictionary words`;
    }
    
    // Check for password analysis request
    if ((cleanPrompt.includes('analyze') || cleanPrompt.includes('check')) && 
        cleanPrompt.includes('password')) {
      // Extract potential password from prompt - look for words after "password"
      const match = prompt.match(/password\s+(?:is\s+)?["']?([^"']+)["']?/i);
      
      if (match && match[1]) {
        const passwordToAnalyze = match[1].trim();
        const analysis = this.analyzePasswordStrength(passwordToAnalyze);
        
        let responseText = `Password Strength Analysis: ${analysis.label} (${analysis.score}/100)\n\n`;
        
        if (analysis.issues.length > 0) {
          responseText += "Issues:\n";
          analysis.issues.forEach(issue => {
            responseText += `- ${issue}\n`;
          });
          responseText += "\n";
        }
        
        if (analysis.suggestions.length > 0) {
          responseText += "Suggestions:\n";
          analysis.suggestions.forEach(suggestion => {
            responseText += `- ${suggestion}\n`;
          });
        }
        
        return responseText;
      }
    }
    
    // If model is available, try to get a response from it
    if (this.isModelLoaded && this.model) {
      try {
        // Craft a security-focused prompt
        const securityPrompt = `Answer the following question about password security and cybersecurity as briefly and accurately as possible. If the question is not related to security or passwords, say you can only help with password and security topics. Question: ${prompt}`;
        
        const response = await this.model.chat(securityPrompt, {
          maxTokens: 200,
          temperature: 0.3
        });
        
        return response;
      } catch (error) {
        console.error('Error getting response from model:', error);
        // Fall back to default response
      }
    }
    
    // Default response when nothing else matched
    return this.getDefaultResponse(prompt);
  }
  
  /**
   * Parses password generation options from a prompt
   * @param {string} prompt - User's prompt
   * @returns {Object} - Password generation options
   */
  parsePasswordOptions(prompt) {
    const options = {
      length: 16,
      uppercase: true,
      lowercase: true,
      numbers: true,
      symbols: true
    };
    
    // Check for length specification
    const lengthMatch = prompt.match(/(\d+)\s*characters?/i);
    if (lengthMatch && lengthMatch[1]) {
      const requestedLength = parseInt(lengthMatch[1], 10);
      // Set reasonable bounds
      options.length = Math.max(8, Math.min(64, requestedLength));
    }
    
    // Check for character type exclusions
    if (prompt.includes('no uppercase') || prompt.includes('without uppercase')) {
      options.uppercase = false;
    }
    
    if (prompt.includes('no lowercase') || prompt.includes('without lowercase')) {
      options.lowercase = false;
    }
    
    if (prompt.includes('no numbers') || prompt.includes('without numbers')) {
      options.numbers = false;
    }
    
    if (prompt.includes('no symbols') || prompt.includes('without symbols') || 
        prompt.includes('no special') || prompt.includes('without special')) {
      options.symbols = false;
    }
    
    // Ensure at least one character type is selected
    if (!options.uppercase && !options.lowercase && !options.numbers && !options.symbols) {
      options.lowercase = true; // Default to at least lowercase
    }
    
    return options;
  }
  
  /**
   * Provides a default response for unknown queries
   * @param {string} prompt - User's input
   * @returns {string} - Default response
   */
  getDefaultResponse(prompt) {
    if (prompt.length < 5) {
      return "Please ask a more detailed question about password security or management.";
    }
    
    const defaultResponses = [
      "I'm a local AI assistant focused on password security. I can help you generate secure passwords and provide security advice. Try asking me about password strength or two-factor authentication.",
      "I'm not sure I understand that question. I'm specialized in password security and management. Could you ask something related to passwords, security, or account protection?",
      "As a local AI assistant, I have limited knowledge compared to online AI. I'm best at helping with password generation, security tips, and basic password management advice."
    ];
    
    return defaultResponses[Math.floor(Math.random() * defaultResponses.length)];
  }

  /**
   * Main entry point for getting AI responses
   * @param {string} prompt - User's prompt
   * @returns {Promise<string>} - AI assistant response
   */
  async getResponse(prompt) {
    // Initialize model if not already loaded
    if (!this.isModelLoaded && !this.isModelLoading) {
      await this.initializeModel();
    }
    
    // Handle the prompt
    return this.handlePrompt(prompt);
  }
  
  /**
   * Initialize the model (alias for initializeModel for compatibility)
   * @returns {Promise<boolean>} - Success status
   */
  async initModel() {
    return this.initializeModel();
  }
}

// Export the module
window.AIAssistant = AIAssistant;