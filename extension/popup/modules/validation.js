// Validation utilities to validate the org ID and API key.
export const ValidationUtils = {
    UUID_REGEX: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    
    validate(value, type) {
        if (!value || typeof value !== 'string') return false;
        value = value.trim();
        
        switch (type) {
            case 'orgId':
            case 'siteId':
                return this.UUID_REGEX.test(value);
            case 'apiKey':
                return value.length >= 36;
            default:
                return false;
        }
    }
};