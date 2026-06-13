const express = require('express');
const router = express.Router();
const pettyCashBookController = require('../controllers/pettyCashBookController');
const pettyCashCategoryController = require('../controllers/pettyCashCategoryController');
const pettyCashPaymentController = require('../controllers/pettyCashPaymentController');
const pettyCashReimbursementController = require('../controllers/pettyCashReimbursementController');

// Petty Cash Book Routes
router.post('/books', pettyCashBookController.createBook);
router.get('/books', pettyCashBookController.getBooks);
router.get('/books/:id', pettyCashBookController.getBookById);
router.put('/books/:id', pettyCashBookController.updateBook);
router.delete('/books/:id', pettyCashBookController.deleteBook);

// Petty Cash Category Routes
router.post('/categories', pettyCashCategoryController.createCategory);
router.get('/categories', pettyCashCategoryController.getCategories);
router.get('/categories/:id', pettyCashCategoryController.getCategoryById);
router.put('/categories/:id', pettyCashCategoryController.updateCategory);
router.delete('/categories/:id', pettyCashCategoryController.deleteCategory);

// Petty Cash Payment Routes
router.post('/payments', pettyCashPaymentController.createPayment);
router.get('/payments', pettyCashPaymentController.getPayments);
router.get('/payments/:id', pettyCashPaymentController.getPaymentById);
router.patch('/payments/:id/approve', pettyCashPaymentController.approvePayment);
router.post('/payments/:id/post', pettyCashPaymentController.postPayment);
router.delete('/payments/:id', pettyCashPaymentController.deletePayment);

// Petty Cash Reimbursement Routes
router.post('/reimbursements', pettyCashReimbursementController.createReimbursement);
router.get('/reimbursements', pettyCashReimbursementController.getReimbursements);
router.get('/reimbursements/:id', pettyCashReimbursementController.getReimbursementById);
router.patch('/reimbursements/:id/approve', pettyCashReimbursementController.approveReimbursement);
router.post('/reimbursements/:id/post', pettyCashReimbursementController.postReimbursement);
router.delete('/reimbursements/:id', pettyCashReimbursementController.deleteReimbursement);

module.exports = router;
