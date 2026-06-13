const DocumentSequence = require('../models/documentSequence');
const Location = require('../models/location');
const sequelize = require('../config/db');

exports.generateDocumentNumber = async (req, res) => {
  const { documentType, locationId } = req.body;
  if (!documentType) return res.status(400).json({ error: 'documentType is required' });
  let transaction;
  try {
    transaction = await sequelize.transaction();
    // Lock the row for update
    let sequence = await DocumentSequence.findOne({
      where: { documentType, locationId },
      lock: transaction.LOCK.UPDATE,
      transaction
    });
    if (!sequence) {
      // Auto-insert with defaults if not found
      // Include location code in prefix to avoid collisions between locations
      let prefix = documentType;
      try {
        const location = await Location.findByPk(locationId, { transaction });
        if (location && location.code) {
          prefix = `${documentType}-${location.code}`;
        }
      } catch (locError) {
        console.error('Error fetching location for prefix:', locError);
      }

      sequence = await DocumentSequence.create({
        documentType,
        prefix: prefix,
        currentNumber: 0,
        numberLength: 5,
        locationId
      }, { transaction });
    }
    sequence.currentNumber += 1;
    await sequence.save({ transaction });
    await transaction.commit();
    const numberStr = String(sequence.currentNumber).padStart(sequence.numberLength, '0');
    const documentNumber = `${sequence.prefix}-${numberStr}`;
    res.json({ documentNumber });
  } catch (error) {
    if (transaction) await transaction.rollback();
    res.status(500).json({ error: error.message });
  }
};

// List all document sequences
exports.listDocumentSequences = async (req, res) => {
  try {
    const sequences = await DocumentSequence.findAll();
    res.json(sequences);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get a document sequence by type
exports.getDocumentSequence = async (req, res) => {
  try {
    const { documentType } = req.params;
    const sequence = await DocumentSequence.findOne({ where: { documentType } });
    if (!sequence) return res.status(404).json({ error: 'Document type not found' });
    res.json(sequence);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Create a new document sequence
exports.createDocumentSequence = async (req, res) => {
  try {
    const { documentType, prefix, currentNumber, numberLength } = req.body;
    const exists = await DocumentSequence.findOne({ where: { documentType } });
    if (exists) return res.status(400).json({ error: 'Document type already exists' });
    const sequence = await DocumentSequence.create({ documentType, prefix, currentNumber, numberLength });
    res.status(201).json(sequence);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Update a document sequence
exports.updateDocumentSequence = async (req, res) => {
  try {
    const { documentType } = req.params;
    const sequence = await DocumentSequence.findOne({ where: { documentType } });
    if (!sequence) return res.status(404).json({ error: 'Document type not found' });
    await sequence.update(req.body);
    res.json(sequence);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Delete a document sequence
exports.deleteDocumentSequence = async (req, res) => {
  try {
    const { documentType } = req.params;
    const sequence = await DocumentSequence.findOne({ where: { documentType } });
    if (!sequence) return res.status(404).json({ error: 'Document type not found' });
    await sequence.destroy();
    res.json({ message: 'Document sequence deleted' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};
