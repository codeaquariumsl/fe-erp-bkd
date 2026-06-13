// Helper to call generateDocumentNumber directly from the controller
const { generateDocumentNumber: generateDocumentNumberInternal } = require('./documentController');

exports.generateDocumentNumber = async (documentType, locationId) => {
  // Directly call the internal function, simulating an Express req/res
  // Use a Promise to get the result
  return new Promise((resolve, reject) => {
    const req = { body: { documentType, locationId } };
    const res = {
      json: (data) => resolve(data.documentNumber),
      status: (code) => ({ json: (err) => reject(new Error(err.error || 'Error')) })
    };
    generateDocumentNumberInternal(req, res);
  });
};
