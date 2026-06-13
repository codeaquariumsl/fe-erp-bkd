const twilio = require('twilio');

// Twilio configuration - Consider moving these to environment variables
const TWILIO_CONFIG = {
    accountSid: process.env.TWILIO_ACCOUNT_SID,
    authToken: process.env.TWILIO_AUTH_TOKEN,
    messagingServiceSid: process.env.TWILIO_MESSAGING_SERVICE_SID
};

// Initialize Twilio client
const client = twilio(TWILIO_CONFIG.accountSid, TWILIO_CONFIG.authToken);

/**
 * Format phone number to international format
 * @param {string} phoneNumber - Raw phone number
 * @returns {string} - Formatted phone number with country code
 */
function formatPhoneNumber(phoneNumber) {
    // Remove all non-digit characters except +
    let cleaned = phoneNumber.replace(/[^\d+]/g, '');

    // If it already starts with +, return as is (assuming it's properly formatted)
    if (cleaned.startsWith('+')) {
        return cleaned;
    }

    // Handle different country formats
    // Sri Lanka: 0719176723 -> +94719176723
    if (cleaned.startsWith('0') && cleaned.length === 10) {
        // Assume Sri Lankan number, replace 0 with +94
        return '+94' + cleaned.substring(1);
    }

    // India: 9876543210 -> +919876543210
    if (cleaned.length === 10 && !cleaned.startsWith('0')) {
        // Assume Indian number
        return '+91' + cleaned;
    }

    // USA/Canada: 1234567890 -> +11234567890
    if (cleaned.length === 10) {
        return '+1' + cleaned;
    }

    // If 11 digits and starts with 1, assume US/Canada
    if (cleaned.length === 11 && cleaned.startsWith('1')) {
        return '+' + cleaned;
    }

    // If more than 10 digits but doesn't start with +, add +
    if (cleaned.length > 10) {
        return '+' + cleaned;
    }

    // Default: add + prefix
    return '+' + cleaned;
}

/**
 * Validate phone number format
 * @param {string} phoneNumber - Phone number to validate
 * @returns {boolean} - True if valid format
 */
function isValidPhoneNumber(phoneNumber) {
    // Check if it's a string and has reasonable length
    if (!phoneNumber || typeof phoneNumber !== 'string') {
        return false;
    }

    const cleaned = phoneNumber.replace(/[^\d+]/g, '');

    // Must have + and be between 10-15 digits (international standard)
    if (!cleaned.startsWith('+') || cleaned.length < 11 || cleaned.length > 16) {
        return false;
    }

    // Check if it has valid digits after +
    const digits = cleaned.substring(1);
    return /^\d+$/.test(digits) && digits.length >= 10;
}

/**
 * Send SMS notification
 * @param {string} to - Recipient phone number
 * @param {string} message - SMS message content
 * @returns {Promise<Object>} - Twilio message response or error
 */
async function sendSMS(to, message) {
    try {
        // Validate input
        if (!to || typeof to !== 'string') {
            throw new Error('Invalid phone number provided');
        }

        if (!message || typeof message !== 'string' || message.trim().length === 0) {
            throw new Error('Invalid message content provided');
        }

        // Format phone number
        const formattedNumber = formatPhoneNumber(to);

        // Validate formatted number
        if (!isValidPhoneNumber(formattedNumber)) {
            throw new Error(`Invalid phone number format: ${to} -> ${formattedNumber}`);
        }

        const messageResponse = await client.messages.create({
            body: message.trim(),
            messagingServiceSid: TWILIO_CONFIG.messagingServiceSid,
            to: formattedNumber
        });

        console.log(`SMS sent successfully to ${formattedNumber}. Message SID: ${messageResponse.sid}`);

        return {
            success: true,
            messageSid: messageResponse.sid,
            to: formattedNumber,
            originalNumber: to,
            status: messageResponse.status
        };
    } catch (error) {
        console.error('SMS sending failed:', {
            error: error.message,
            originalNumber: to,
            code: error.code || 'UNKNOWN_ERROR'
        });

        return {
            success: false,
            error: error.message,
            code: error.code || 'UNKNOWN_ERROR',
            originalNumber: to
        };
    }
}

/**
 * Send Sales Order approved notification
 * @param {string} phoneNumber - Customer phone number
 * @param {string} orderNumber - Sales order number
 * @returns {Promise<Object>} - SMS sending result
 */
async function sendSalesOrderApprovedNotification(phoneNumber, orderNumber) {
    const message = `Your Sales Order ${orderNumber} has been approved and a Delivery Order has been created. Please check your account for details.`;
    return await sendSMS(phoneNumber, message);
}

/**
 * Send custom notification
 * @param {string} phoneNumber - Recipient phone number
 * @param {string} message - Custom message
 * @returns {Promise<Object>} - SMS sending result
 */
async function sendCustomNotification(phoneNumber, message) {
    return await sendSMS(phoneNumber, message);
}

/**
 * Send delivery notification
 * @param {string} phoneNumber - Customer phone number
 * @param {string} deliveryOrderNumber - Delivery order number
 * @param {string} estimatedDeliveryTime - Estimated delivery time
 * @returns {Promise<Object>} - SMS sending result
 */
async function sendDeliveryNotification(phoneNumber, deliveryOrderNumber, estimatedDeliveryTime) {
    const message = `Your order ${deliveryOrderNumber} is out for delivery. Estimated delivery time: ${estimatedDeliveryTime}. Thank you for your business!`;
    return await sendSMS(phoneNumber, message);
}

/**
 * Send order confirmation notification
 * @param {string} phoneNumber - Customer phone number
 * @param {string} orderNumber - Order number
 * @param {number} totalAmount - Total order amount
 * @returns {Promise<Object>} - SMS sending result
 */
async function sendOrderConfirmationNotification(phoneNumber, orderNumber, totalAmount) {
    const message = `Order confirmation: Your order ${orderNumber} for $${totalAmount.toFixed(2)} has been received and is being processed. Thank you!`;
    return await sendSMS(phoneNumber, message);
}

/**
 * Test phone number formatting (for debugging)
 * @param {string} phoneNumber - Phone number to test
 * @returns {Object} - Formatting test result
 */
function testPhoneNumberFormatting(phoneNumber) {
    const formatted = formatPhoneNumber(phoneNumber);
    const isValid = isValidPhoneNumber(formatted);

    return {
        original: phoneNumber,
        formatted: formatted,
        isValid: isValid,
        reason: isValid ? 'Valid' : 'Invalid format or length'
    };
}

module.exports = {
    sendSMS,
    sendSalesOrderApprovedNotification,
    sendCustomNotification,
    sendDeliveryNotification,
    sendOrderConfirmationNotification,
    testPhoneNumberFormatting,
    formatPhoneNumber,
    isValidPhoneNumber
};
