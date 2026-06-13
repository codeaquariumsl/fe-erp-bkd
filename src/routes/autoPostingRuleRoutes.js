const express = require('express');
const router = express.Router();
const autoPostingRuleController = require('../controllers/autoPostingRuleController');

/**
 * Auto-Posting Rule Routes
 */

// Create Auto-Posting Rule
router.post('/', autoPostingRuleController.createAutoPostingRule);

// Get all Auto-Posting Rules
router.get('/', autoPostingRuleController.getAllAutoPostingRules);

// Get Auto-Posting Rule by ID
router.get('/:id', autoPostingRuleController.getAutoPostingRuleById);

// Update Auto-Posting Rule
router.put('/:id', autoPostingRuleController.updateAutoPostingRule);

// Toggle Auto-Posting Rule (Enable/Disable)
router.post('/:id/toggle', autoPostingRuleController.toggleAutoPostingRule);

// Delete Auto-Posting Rule
router.delete('/:id', autoPostingRuleController.deleteAutoPostingRule);

// Get Rules by Trigger Module
router.get('/module/:triggerModule', autoPostingRuleController.getRulesByTriggerModule);

// Preview Auto-Posting
router.post('/preview/journal', autoPostingRuleController.previewAutoPosting);

module.exports = router;
