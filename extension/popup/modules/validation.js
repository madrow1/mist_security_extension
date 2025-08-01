// Validation utilities
export const ValidationUtils = {
    // ✅ IMPROVED: More comprehensive regex patterns
    UUID_REGEX: /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/,
    IP_REGEX: /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/,
    HOSTNAME_REGEX: /^[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?)*$/,
    API_KEY_REGEX: /^[a-zA-Z0-9\-_]{36,}$/,
    
    validateRequired(fields) {
        const missing = [];
        
        if (!fields || typeof fields !== 'object') {
            return ['Invalid fields object'];
        }
        
        for (const [key, value] of Object.entries(fields)) {
            if (!value || !value.toString().trim()) {
                missing.push(key);
            }
        }
        return missing;
    },

    validate(value, type) {
        if (value === null || value === undefined) return false;
        
        // Convert to string and trim
        const stringValue = value.toString().trim();
        if (!stringValue) return false;
        
        try {
            switch (type) {
                case 'orgId':
                case 'siteId':
                case 'uuid':
                    return this.UUID_REGEX.test(stringValue);
                    
                case 'apiKey':
                    return this.API_KEY_REGEX.test(stringValue) && stringValue.length >= 36;

                case 'url':
                    try {
                        const url = new URL(stringValue);
                        return ['http:', 'https:'].includes(url.protocol);
                    } catch {
                        return false;
                    }
                    
                case 'dbPort':
                case 'port':
                    const port = parseInt(stringValue, 10);
                    return !isNaN(port) && port >= 1 && port <= 65535;
                    
                case 'dbName':
                case 'databaseName':
                    return /^[a-zA-Z0-9_]{1,64}$/.test(stringValue);
                    
                case 'dbUser':
                case 'username':
                    return /^[a-zA-Z0-9_]{1,63}$/.test(stringValue);
                    
                case 'hostname':
                    return this.HOSTNAME_REGEX.test(stringValue) && stringValue.length <= 253;
                    
                case 'ipAddress':
                    return this.IP_REGEX.test(stringValue);
                    
                case 'password':
                    return stringValue.length >= 8 && stringValue.length <= 128;
                    
                case 'nonEmpty':
                    return stringValue.length > 0;
                    
                case 'alphanumeric':
                    return /^[a-zA-Z0-9]+$/.test(stringValue);
                    
                case 'numeric':
                    return /^\d+$/.test(stringValue);
                    
                case 'text':
                    return stringValue.length > 0 && stringValue.length <= 1000;
                    
                default:
                    console.warn(`Unknown validation type: ${type}`);
                    return false;
            }
        } catch (error) {
            console.error(`Validation error for type ${type}:`, error);
            return false;
        }
    },

    // ✅ ADDED: Sanitization methods
    sanitizeInput(input, type = 'text') {
        if (!input) return '';
        
        let sanitized = input.toString().trim();
        
        switch (type) {
            case 'html':
                // Remove HTML tags and encode special characters
                sanitized = sanitized
                    .replace(/<[^>]*>/g, '')
                    .replace(/&/g, '&amp;')
                    .replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;')
                    .replace(/"/g, '&quot;')
                    .replace(/'/g, '&#x27;');
                break;
                
            case 'sql':
                // Basic SQL injection prevention
                sanitized = sanitized.replace(/['";\\]/g, '');
                break;
                
            case 'filename':
                // Safe filename characters only
                sanitized = sanitized.replace(/[^a-zA-Z0-9._-]/g, '');
                break;
                
            case 'alphanumeric':
                sanitized = sanitized.replace(/[^a-zA-Z0-9]/g, '');
                break;
                
            case 'numeric':
                sanitized = sanitized.replace(/[^0-9]/g, '');
                break;
                
            case 'uuid':
                sanitized = sanitized.replace(/[^a-fA-F0-9-]/g, '');
                break;
                
            default:
                // Basic text sanitization
                sanitized = sanitized
                    .replace(/[<>]/g, '')
                    .substring(0, 1000);
        }
        
        return sanitized;
    },

    validateWithMessage(value, type, fieldName = 'Field') {
        const isValid = this.validate(value, type);
        
        if (isValid) {
            return { valid: true, message: null };
        }
        
        const messages = {
            orgId: `${fieldName} must be a valid UUID format`,
            siteId: `${fieldName} must be a valid UUID format`,
            uuid: `${fieldName} must be a valid UUID format`,
            apiKey: `${fieldName} must be at least 36 characters long with valid characters`,
            url: `${fieldName} must be a valid HTTP/HTTPS URL`,
            dbPort: `${fieldName} must be a valid port number (1-65535)`,
            port: `${fieldName} must be a valid port number (1-65535)`,
            dbName: `${fieldName} must contain only letters, numbers, and underscores (max 64 chars)`,
            databaseName: `${fieldName} must contain only letters, numbers, and underscores (max 64 chars)`,
            dbUser: `${fieldName} must contain only letters, numbers, and underscores (max 63 chars)`,
            username: `${fieldName} must contain only letters, numbers, and underscores (max 63 chars)`,
            hostname: `${fieldName} must be a valid hostname`,
            ipAddress: `${fieldName} must be a valid IP address`,
            password: `${fieldName} must be 8-128 characters long`,
            nonEmpty: `${fieldName} cannot be empty`,
            alphanumeric: `${fieldName} must contain only letters and numbers`,
            numeric: `${fieldName} must contain only numbers`,
            text: `${fieldName} must be 1-1000 characters long`
        };
        
        return {
            valid: false,
            message: messages[type] || `${fieldName} is invalid`
        };
    },

    validateMultiple(data, schema) {
        const errors = [];
        
        if (!data || typeof data !== 'object') {
            return [{ field: 'data', message: 'Data must be an object' }];
        }
        
        if (!schema || typeof schema !== 'object') {
            return [{ field: 'schema', message: 'Schema must be an object' }];
        }
        
        for (const [field, rules] of Object.entries(schema)) {
            const value = data[field];
            
            // Check required fields
            if (rules.required && (!value || !value.toString().trim())) {
                errors.push({ field, message: `${field} is required` });
                continue;
            }
            
            // Skip validation if field is not required and empty
            if (!rules.required && (!value || !value.toString().trim())) {
                continue;
            }
            
            // Validate type
            if (rules.type) {
                const validation = this.validateWithMessage(value, rules.type, field);
                if (!validation.valid) {
                    errors.push({ field, message: validation.message });
                }
            }
            
            // Custom validation function
            if (rules.custom && typeof rules.custom === 'function') {
                const customResult = rules.custom(value);
                if (customResult !== true) {
                    errors.push({ 
                        field, 
                        message: typeof customResult === 'string' ? customResult : `${field} is invalid`
                    });
                }
            }
        }
        
        return errors;
    },

    toInt(value, defaultValue = 0) {
        const num = parseInt(value, 10);
        return isNaN(num) ? defaultValue : num;
    },

    toFloat(value, defaultValue = 0.0) {
        const num = parseFloat(value);
        return isNaN(num) ? defaultValue : num;
    },

    toBool(value) {
        if (typeof value === 'boolean') return value;
        if (typeof value === 'string') {
            return ['true', '1', 'yes', 'on'].includes(value.toLowerCase());
        }
        return Boolean(value);
    },

    validateLength(value, min = 0, max = Infinity) {
        if (!value) return min === 0;
        const length = value.toString().length;
        return length >= min && length <= max;
    },

    schemas: {
        apiSubmission: {
            org_id: { required: true, type: 'orgId' },
            api_key: { required: true, type: 'apiKey' },
            api_url: { required: true, type: 'hostname' }
        },
        
        dbConfig: {
            dbUser: { required: true, type: 'dbUser' },
            dbPass: { required: true, type: 'password' },
            dbAddress: { required: true, type: 'hostname' },
            dbPort: { required: true, type: 'dbPort' },
            dbName: { required: true, type: 'dbName' }
        }
    }
};