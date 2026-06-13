const ReturnType = require('./returnType');
const Unit = require('./unit');
const PaymentType = require('./paymentType');
const Receipt = require('./receipt');
const ReceiptPayment = require('./receiptPayment');
const ReceiptInvoice = require('./receiptInvoice');
const ReceiptCreditNote = require('./receiptCreditNote');
const ReceiptSettledCheque = require('./receiptSettledCheque');
const Batch = require('./batch');
const BatchItem = require('./batchItem');
const ProductionConfig = require('./productionConfig');
const BOM = require('./bom');
const BOMItem = require('./bomItem');
const ProductionOrder = require('./productionOrder');
const ProductionOrderItem = require('./productionOrderItem');
const SupplierReturn = require('./supplierReturn');
const SupplierReturnItem = require('./supplierReturnItem');
const CustomerReturn = require('./customerReturn');
const CustomerReturnItem = require('./customerReturnItem');
const CreditNote = require('./creditNote');
const CreditNoteItem = require('./creditNoteItem');
const SupplierPayment = require('./supplierPayment');
const SupplierPaymentMethod = require('./supplierPaymentMethod');
const SupplierPaymentGRN = require('./supplierPaymentGRN');
const GoodRequestNote = require('./goodRequestNote');
const GoodRequestNoteItem = require('./goodRequestNoteItem');
const IssueNote = require('./issueNote');
const IssueNoteItem = require('./issueNoteItem');
const TransferInNote = require('./transferInNote');
const TransferInNoteItem = require('./transferInNoteItem');
const CustomerItemCode = require('./customerItemCode');
const User = require('./user');
const Role = require('./role');
const Permission = require('./permission');
const RolePermission = require('./rolePermission');
const Category = require('./category');
const Location = require('./location');
const Store = require('./store');
const Route = require('./route');
const Vehicle = require('./vehicle');
const Item = require('./item');
const Supplier = require('./supplier');
const Customer = require('./customer');
const PurchaseOrder = require('./purchaseOrder');
const PurchaseOrderItem = require('./purchaseOrderItem');
const GRN = require('./grn');
const GRNItem = require('./grnItem');
const Stock = require('./stock');
const StockDetail = require('./stockDetail');
const SalesOrder = require('./salesOrder');
const SalesOrderItem = require('./salesOrderItem');
const SalesPersonCustomer = require('./salesPersonCustomer');
const Driver = require('./driver');
const DeliveryOrder = require('./deliveryOrder');
const DeliveryOrderItem = require('./deliveryOrderItem');
const DeliveryOrderSummary = require('./deliveryOrderSummary');
const DeliveryOrderSummaryItem = require('./deliveryOrderSummaryItem');
const Invoice = require('./invoice');
const InvoiceItem = require('./invoiceItem');
const ColdRoom = require('./coldRoom');
const ColdRoomItem = require('./coldRoomItem');
const ColdRoomLog = require('./coldRoomLog');
const DocumentSequence = require('./documentSequence');
const UserActivityLog = require('./userActivityLog');
const CustomerCategoryDiscount = require('./customerCategoryDiscount');
const sequelize = require('../config/db');
const GRNScheduleItem = require('./grnScheduleItem');
const TimeSlot = require('./timeSlot');
const StockAdjustment = require('./stockAdjustment');
const StockAdjustmentItem = require('./stockAdjustmentItem');
const StockReconciliation = require('./stockReconciliation');
const StockReconciliationItem = require('./stockReconciliationItem');

// Accounting Module Models
const AccountType = require('./accountType');
const AccountCategory = require('./accountCategory');
const ControlAccount = require('./controlAccount');
const LedgerAccount = require('./ledgerAccount');
const Bank = require('./bank');
const BankBranch = require('./bankBranch');
const JournalEntry = require('./journalEntry');
const JournalEntryLine = require('./journalEntryLine');
const AutoPostingRule = require('./autoPostingRule');
const PettyCashBook = require('./pettycashBook');
const PettyCashCategory = require('./pettyCashCategory');
const BillEntry = require('./billEntry');
const BillEntryDetail = require('./billEntryDetail');
const BillPayment = require('./billPayment');
const BillPaymentDetail = require('./billPaymentDetail');
const BillPaymentEntry = require('./billPaymentEntry');
const PaymentAllocation = require('./paymentAllocation');
const OnePayment = require('./onePayment');
const OnePaymentLine = require('./onePaymentLine');
const OnePaymentMethod = require('./onePaymentMethod');
const FundsTransfer = require('./fundsTransfer');
const TransactionHeader = require('./transactionHeader');
const TransactionDetail = require('./transactionDetail');
const BankReconciliation = require('./bankReconciliation');
const BankReconciliationItem = require('./bankReconciliationItem');
const BankStatement = require('./bankStatement');
const BankStatementLine = require('./bankStatementLine');
const PettyCashPayment = require('./pettyCashPayment');
const PettyCashPaymentLine = require('./pettyCashPaymentLine');
const PettyCashReimbursement = require('./pettyCashReimbursement');
const BankDeposit = require('./bankDeposit');
const BankDepositItem = require('./bankDepositItem');

// Define associations
Role.hasMany(User, { foreignKey: 'roleId' });
User.belongsTo(Role, { foreignKey: 'roleId' });

// Role-Permission many-to-many associations
Role.belongsToMany(Permission, {
    through: RolePermission,
    foreignKey: 'roleId',
    otherKey: 'permissionId',
    as: 'permissions'
});
Permission.belongsToMany(Role, {
    through: RolePermission,
    foreignKey: 'permissionId',
    otherKey: 'roleId',
    as: 'roles'
});

// Direct associations for junction table
Role.hasMany(RolePermission, { foreignKey: 'roleId' });
RolePermission.belongsTo(Role, { foreignKey: 'roleId' });
Permission.hasMany(RolePermission, { foreignKey: 'permissionId' });
RolePermission.belongsTo(Permission, { foreignKey: 'permissionId' });

Category.hasMany(Category, { as: 'SubCategories', foreignKey: 'superCategoryId' });
Category.belongsTo(Category, { as: 'SuperCategory', foreignKey: 'superCategoryId' });

Location.hasMany(Store, { foreignKey: 'locationId' });
Store.belongsTo(Location, { foreignKey: 'locationId' });

// Many-to-many association between Route and Vehicle
Route.belongsToMany(Vehicle, { through: 'routevehicles', foreignKey: 'routeId' });
Vehicle.belongsToMany(Route, { through: 'routevehicles', foreignKey: 'vehicleId' });

Category.hasMany(Item, { foreignKey: 'categoryId' });
Item.belongsTo(Category, { foreignKey: 'categoryId' });

Customer.hasMany(Customer, { as: 'Branches', foreignKey: 'parentId' });
Customer.belongsTo(Customer, { as: 'Parent', foreignKey: 'parentId' });
Customer.hasMany(SalesOrder, { foreignKey: 'customerId' });
Customer.hasMany(DeliveryOrder, { foreignKey: 'customerId' });

Supplier.hasMany(PurchaseOrder, { foreignKey: 'supplierId' });
PurchaseOrder.belongsTo(Supplier, { foreignKey: 'supplierId' });

PurchaseOrder.hasMany(PurchaseOrderItem, { foreignKey: 'purchaseOrderId' });
PurchaseOrderItem.belongsTo(PurchaseOrder, { foreignKey: 'purchaseOrderId' });
Item.hasMany(PurchaseOrderItem, { foreignKey: 'itemId' });
PurchaseOrderItem.belongsTo(Item, { foreignKey: 'itemId' });

GRN.belongsTo(Supplier, { foreignKey: 'supplierId' });
GRN.belongsTo(Store, { foreignKey: 'storeId' });
GRN.hasMany(GRNItem, { foreignKey: 'grnId' });
GRNItem.belongsTo(GRN, { foreignKey: 'grnId' });
GRNItem.belongsTo(Item, { foreignKey: 'itemId' });
Stock.belongsTo(Item, { foreignKey: 'itemId' });
Stock.belongsTo(Store, { foreignKey: 'storeId' });
Store.hasMany(Stock, { foreignKey: 'storeId' });
StockDetail.belongsTo(Stock, { foreignKey: 'stockId' });
SalesOrder.belongsTo(Customer, { foreignKey: 'customerId' });
SalesOrder.belongsTo(User, { foreignKey: 'idSalesPerson', as: 'SalesPerson' });
SalesOrder.hasMany(SalesOrderItem, { foreignKey: 'salesOrderId' });
SalesOrderItem.belongsTo(SalesOrder, { foreignKey: 'salesOrderId' });
SalesOrderItem.belongsTo(Item, { foreignKey: 'itemId' });
Driver.belongsTo(User, { foreignKey: 'userId' });
DeliveryOrder.belongsTo(SalesOrder, { foreignKey: 'salesOrderId' });
SalesOrder.hasMany(DeliveryOrder, { foreignKey: 'salesOrderId', as: 'DeliveryOrders' });

DeliveryOrder.belongsTo(Customer, { foreignKey: 'customerId' });
DeliveryOrder.belongsTo(Driver, { foreignKey: 'driverId' });
DeliveryOrder.belongsTo(Route, { foreignKey: 'routeId' });
DeliveryOrder.belongsTo(Vehicle, { foreignKey: 'vehicleId' });
DeliveryOrder.hasMany(DeliveryOrderItem, { foreignKey: 'deliveryOrderId' });
DeliveryOrderItem.belongsTo(DeliveryOrder, { foreignKey: 'deliveryOrderId' });
DeliveryOrderItem.belongsTo(Item, { foreignKey: 'itemId' });
DeliveryOrderItem.belongsTo(Batch, { foreignKey: 'batchId' });
DeliveryOrderItem.belongsTo(Store, { foreignKey: 'storeId', as: 'ReleaseStore' });


Invoice.belongsTo(Customer, { foreignKey: 'customerId' });
Invoice.belongsTo(SalesOrder, { foreignKey: 'salesOrderId' });
Invoice.belongsTo(DeliveryOrder, { foreignKey: 'deliveryOrderId' });
Invoice.hasMany(InvoiceItem, { foreignKey: 'invoiceId' });
Invoice.hasMany(ReceiptInvoice, { foreignKey: 'invoiceId', as: 'ReceiptInvoices' });
Invoice.belongsTo(User, { foreignKey: 'idSalesPerson', as: 'SalesPerson' });
InvoiceItem.belongsTo(Invoice, { foreignKey: 'invoiceId' });
InvoiceItem.belongsTo(Item, { foreignKey: 'itemId' });
Item.hasMany(Stock, { foreignKey: 'itemId' });
Stock.belongsTo(Item, { foreignKey: 'itemId' });

Category.belongsTo(User, { as: 'Creator', foreignKey: 'createdBy' });
Category.belongsTo(User, { as: 'Updater', foreignKey: 'updatedBy' });
Location.belongsTo(User, { as: 'Creator', foreignKey: 'createdBy' });
Location.belongsTo(User, { as: 'Updater', foreignKey: 'updatedBy' });
Store.belongsTo(User, { as: 'Creator', foreignKey: 'createdBy' });
Store.belongsTo(User, { as: 'Updater', foreignKey: 'updatedBy' });
Item.belongsTo(User, { as: 'Creator', foreignKey: 'createdBy' });
Item.belongsTo(User, { as: 'Updater', foreignKey: 'updatedBy' });

// Audit associations for Route
Route.belongsTo(User, { as: 'createdByUser', foreignKey: 'createdBy' });
Route.belongsTo(User, { as: 'updatedByUser', foreignKey: 'updatedBy' });

// Audit associations for Vehicle
Vehicle.belongsTo(User, { as: 'createdByUser', foreignKey: 'createdBy' });
Vehicle.belongsTo(User, { as: 'updatedByUser', foreignKey: 'updatedBy' });

// Audit associations for Supplier
Supplier.belongsTo(User, { as: 'createdByUser', foreignKey: 'createdBy' });
Supplier.belongsTo(User, { as: 'updatedByUser', foreignKey: 'updatedBy' });
Supplier.belongsTo(LedgerAccount, { foreignKey: 'ledgerAccountId', as: 'LedgerAccount' });

// Audit associations for Customer
Customer.belongsTo(User, { as: 'createdByUser', foreignKey: 'createdBy' });
Customer.belongsTo(User, { as: 'updatedByUser', foreignKey: 'updatedBy' });
Customer.belongsTo(LedgerAccount, { foreignKey: 'ledgerAccountId', as: 'LedgerAccount' });

// Audit associations for PurchaseOrder
PurchaseOrder.belongsTo(User, { as: 'createdByUser', foreignKey: 'createdBy' });
PurchaseOrder.belongsTo(User, { as: 'updatedByUser', foreignKey: 'updatedBy' });

// Audit associations for GRN
GRN.belongsTo(User, { as: 'createdByUser', foreignKey: 'createdBy' });
GRN.belongsTo(User, { as: 'updatedByUser', foreignKey: 'updatedBy' });

// Audit associations for Stock
Stock.belongsTo(User, { as: 'createdByUser', foreignKey: 'createdBy' });
Stock.belongsTo(User, { as: 'updatedByUser', foreignKey: 'updatedBy' });

// Audit associations for Item
Item.belongsTo(User, { as: 'createdByUser', foreignKey: 'createdBy' });
Item.belongsTo(User, { as: 'updatedByUser', foreignKey: 'updatedBy' });

// ColdRoom → PalletRack → Pallet associations
const PalletRack = require('./palletRack');
const Pallet = require('./pallet');
ColdRoom.belongsTo(Store, { foreignKey: 'storeId' });
ColdRoom.hasMany(PalletRack, { foreignKey: 'coldRoomId', as: 'PalletRacks' });
PalletRack.belongsTo(ColdRoom, { foreignKey: 'coldRoomId' });
PalletRack.hasMany(Pallet, { foreignKey: 'palletRackId', as: 'Pallets' });
Pallet.belongsTo(PalletRack, { foreignKey: 'palletRackId' });
// GRNItem associations for coldRoomId and palletRackId
// GRNItem associations with ColdRoom and PalletRack
GRNItem.belongsTo(ColdRoom, { foreignKey: 'coldRoomId', as: 'ColdRoom' });
GRNItem.belongsTo(PalletRack, { foreignKey: 'palletRackId', as: 'PalletRack' });

// Reverse associations for GRNItem
ColdRoom.hasMany(GRNItem, { foreignKey: 'coldRoomId', as: 'GRNItems' });
PalletRack.hasMany(GRNItem, { foreignKey: 'palletRackId', as: 'GRNItems' });
// GRN association for purchaseOrderId
GRN.belongsTo(PurchaseOrder, { foreignKey: 'purchaseOrderId' });
GRNScheduleItem.belongsTo(Item, { foreignKey: 'itemId' });
GRNScheduleItem.belongsTo(Customer, { foreignKey: 'customerId' });
GRNScheduleItem.belongsTo(GRN, { foreignKey: 'grn1Id', as: 'GRN1' });
GRNScheduleItem.belongsTo(GRN, { foreignKey: 'grn2Id', as: 'GRN2' });
GRNScheduleItem.belongsTo(GRN, { foreignKey: 'grn3Id', as: 'GRN3' });

// DeliveryOrderSummary associations
DeliveryOrderSummary.hasMany(DeliveryOrderSummaryItem, { foreignKey: 'deliveryOrderSummaryId', as: 'SummaryItems' });

// DeliveryOrderSummaryItem associations
DeliveryOrderSummaryItem.belongsTo(DeliveryOrderSummary, { foreignKey: 'deliveryOrderSummaryId', as: 'DeliveryOrderSummary' });
DeliveryOrderSummaryItem.belongsTo(DeliveryOrder, { foreignKey: 'deliveryOrderId', as: 'DeliveryOrder' });
DeliveryOrderSummaryItem.belongsTo(DeliveryOrderItem, { foreignKey: 'deliveryOrderItemId', as: 'DeliveryOrderItem' });
DeliveryOrderSummaryItem.belongsTo(Item, { foreignKey: 'itemId', as: 'Item' });
DeliveryOrderSummaryItem.belongsTo(Batch, { foreignKey: 'batchId', as: 'Batch' });
DeliveryOrderSummaryItem.belongsTo(Route, { foreignKey: 'routeId', as: 'Route' });
DeliveryOrderSummaryItem.belongsTo(Store, { foreignKey: 'releaseStoreId', as: 'ReleaseStore' });
DeliveryOrderSummaryItem.belongsTo(User, { as: 'createdByUser', foreignKey: 'createdBy' });
DeliveryOrderSummaryItem.belongsTo(User, { as: 'updatedByUser', foreignKey: 'updatedBy' });

// Reverse associations for DeliveryOrderSummaryItem
DeliveryOrder.hasMany(DeliveryOrderSummaryItem, { foreignKey: 'deliveryOrderId', as: 'SummaryItems' });
DeliveryOrderItem.hasMany(DeliveryOrderSummaryItem, { foreignKey: 'deliveryOrderItemId', as: 'SummaryItems' });
Item.hasMany(DeliveryOrderSummaryItem, { foreignKey: 'itemId', as: 'DeliveryOrderSummaryItems' });
Batch.hasMany(DeliveryOrderSummaryItem, { foreignKey: 'batchId', as: 'DeliveryOrderSummaryItems' });
Route.hasMany(DeliveryOrderSummaryItem, { foreignKey: 'routeId', as: 'DeliveryOrderSummaryItems' });
Store.hasMany(DeliveryOrderSummaryItem, { foreignKey: 'releaseStoreId', as: 'DeliveryOrderSummaryItems' });

// Stock → Vehicle association for lorry stock
Stock.belongsTo(Vehicle, { as: 'Lorry', foreignKey: 'lorryId' });
Vehicle.hasMany(Stock, { as: 'LorryStock', foreignKey: 'lorryId' });

// UserActivityLog associations
UserActivityLog.belongsTo(User, { foreignKey: 'userId', as: 'user' });
User.hasMany(UserActivityLog, { foreignKey: 'userId', as: 'activityLogs' });
User.hasMany(SalesOrder, { foreignKey: 'idSalesPerson' });
User.hasMany(Invoice, { foreignKey: 'idSalesPerson' });
User.hasMany(SalesPersonCustomer, { foreignKey: 'userId', as: 'AssignedCustomers' });
SalesPersonCustomer.belongsTo(User, { foreignKey: 'userId', as: 'SalesPerson' });
Customer.hasMany(SalesPersonCustomer, { foreignKey: 'customerId', as: 'SalesPeople' });
SalesPersonCustomer.belongsTo(Customer, { foreignKey: 'customerId', as: 'Customer' });

Customer.hasMany(CustomerCategoryDiscount, { foreignKey: 'customerId', as: 'CategoryDiscounts' });
CustomerCategoryDiscount.belongsTo(Customer, { foreignKey: 'customerId', as: 'Customer' });
Category.hasMany(CustomerCategoryDiscount, { foreignKey: 'categoryId', as: 'CustomerDiscounts' });
CustomerCategoryDiscount.belongsTo(Category, { foreignKey: 'categoryId', as: 'Category' });

// Audit associations for ReturnType
ReturnType.belongsTo(User, { as: 'Creator', foreignKey: 'createdBy' });
ReturnType.belongsTo(User, { as: 'Updater', foreignKey: 'updatedBy' });

// Audit associations for Unit
Unit.belongsTo(User, { as: 'Creator', foreignKey: 'createdBy' });
Unit.belongsTo(User, { as: 'Updater', foreignKey: 'updatedBy' });

// Audit associations for PaymentType
PaymentType.belongsTo(User, { as: 'Creator', foreignKey: 'createdBy' });
PaymentType.belongsTo(User, { as: 'Updater', foreignKey: 'updatedBy' });
PaymentType.hasMany(ReceiptPayment, { foreignKey: 'paymentTypeId', as: 'payments' });

// Receipt and ReceiptPayment associations
Receipt.belongsTo(Customer, { foreignKey: 'customerId' });
Receipt.belongsTo(User, { foreignKey: 'createdBy', as: 'Creator' });
Receipt.belongsTo(User, { foreignKey: 'updatedBy', as: 'Updater' });
Receipt.hasMany(ReceiptPayment, { foreignKey: 'receiptId', as: 'payments' });
Receipt.hasMany(ReceiptInvoice, { foreignKey: 'receiptId', as: 'invoices' });
Receipt.hasMany(ReceiptSettledCheque, { foreignKey: 'receiptId', as: 'settledCheques' });
ReceiptSettledCheque.belongsTo(Receipt, { foreignKey: 'receiptId', as: 'receipt' });
ReceiptSettledCheque.belongsTo(ReceiptPayment, { foreignKey: 'receiptPaymentId', as: 'cheque' });
ReceiptPayment.belongsTo(Receipt, { foreignKey: 'receiptId', as: 'receipt' });
ReceiptPayment.belongsTo(PaymentType, { foreignKey: 'paymentTypeId' });
ReceiptPayment.belongsTo(LedgerAccount, { foreignKey: 'ledgerAccountId', as: 'ledgerAccount' });
ReceiptPayment.belongsTo(Bank, { foreignKey: 'bankId', as: 'bank' });
ReceiptPayment.belongsTo(User, { foreignKey: 'cancelledBy', as: 'cancelledByUser' });
ReceiptPayment.belongsTo(User, { foreignKey: 'returnedBy', as: 'returnedByUser' });
ReceiptInvoice.belongsTo(Receipt, { foreignKey: 'receiptId', as: 'receipt' });
ReceiptInvoice.belongsTo(Invoice, { foreignKey: 'invoiceId', as: 'invoice' });

// Batch associations
Batch.belongsTo(GRN, { foreignKey: 'grnId', as: 'GRN' });
Batch.belongsTo(Location, { foreignKey: 'locationId', as: 'Location' });
Batch.belongsTo(Store, { foreignKey: 'storeId', as: 'Store' });
Batch.belongsTo(User, { foreignKey: 'createdBy', as: 'Creator' });
Batch.belongsTo(User, { foreignKey: 'updatedBy', as: 'Updater' });
Batch.hasMany(BatchItem, { foreignKey: 'batchId', as: 'BatchItems' });
Batch.hasMany(DeliveryOrderItem, { foreignKey: 'batchId' });


// BatchItem associations
BatchItem.belongsTo(Batch, { foreignKey: 'batchId', as: 'Batch' });
BatchItem.belongsTo(Item, { foreignKey: 'itemId', as: 'Item' });
BatchItem.belongsTo(Location, { foreignKey: 'locationId', as: 'Location' });
BatchItem.belongsTo(Store, { foreignKey: 'storeId', as: 'Store' });
BatchItem.belongsTo(User, { foreignKey: 'createdBy', as: 'Creator' });
BatchItem.belongsTo(User, { foreignKey: 'updatedBy', as: 'Updater' });

// Reverse associations
GRN.hasMany(Batch, { foreignKey: 'grnId', as: 'Batches' });
Location.hasMany(Batch, { foreignKey: 'locationId', as: 'Batches' });
Store.hasMany(Batch, { foreignKey: 'storeId', as: 'Batches' });
Location.hasMany(BatchItem, { foreignKey: 'locationId', as: 'BatchItems' });
Store.hasMany(BatchItem, { foreignKey: 'storeId', as: 'BatchItems' });
Item.hasMany(BatchItem, { foreignKey: 'itemId', as: 'BatchItems' });

// Production Config associations
ProductionConfig.belongsTo(Store, { foreignKey: 'rawMaterialStoreId', as: 'RawMaterialStore' });
ProductionConfig.belongsTo(Store, { foreignKey: 'outputStoreId', as: 'OutputStore' });
ProductionConfig.belongsTo(Location, { foreignKey: 'locationId', as: 'Location' });
ProductionConfig.belongsTo(User, { foreignKey: 'createdBy', as: 'Creator' });
ProductionConfig.belongsTo(User, { foreignKey: 'updatedBy', as: 'Updater' });

// BOM associations
BOM.belongsTo(Item, { foreignKey: 'itemId', as: 'Item' });
BOM.belongsTo(Location, { foreignKey: 'locationId', as: 'Location' });
BOM.belongsTo(User, { foreignKey: 'createdBy', as: 'Creator' });
BOM.belongsTo(User, { foreignKey: 'updatedBy', as: 'Updater' });
BOM.hasMany(BOMItem, { foreignKey: 'bomId', as: 'BOMItems' });
BOM.hasMany(ProductionOrder, { foreignKey: 'bomId', as: 'ProductionOrders' });

// BOMItem associations
BOMItem.belongsTo(BOM, { foreignKey: 'bomId', as: 'BOM' });
BOMItem.belongsTo(Item, { foreignKey: 'itemId', as: 'Item' });
BOMItem.belongsTo(User, { foreignKey: 'createdBy', as: 'Creator' });
BOMItem.belongsTo(User, { foreignKey: 'updatedBy', as: 'Updater' });

// ProductionOrder associations
ProductionOrder.belongsTo(Item, { foreignKey: 'itemId', as: 'Item' });
ProductionOrder.belongsTo(Batch, { foreignKey: 'batchId', as: 'Batch' });
ProductionOrder.belongsTo(BOM, { foreignKey: 'bomId', as: 'BOM' });
ProductionOrder.belongsTo(Location, { foreignKey: 'locationId', as: 'Location' });
ProductionOrder.belongsTo(User, { foreignKey: 'createdBy', as: 'Creator' });
ProductionOrder.belongsTo(User, { foreignKey: 'updatedBy', as: 'Updater' });
ProductionOrder.hasMany(ProductionOrderItem, { foreignKey: 'productionOrderId', as: 'ProductionOrderItems' });

// ProductionOrderItem associations
ProductionOrderItem.belongsTo(ProductionOrder, { foreignKey: 'productionOrderId', as: 'ProductionOrder' });
ProductionOrderItem.belongsTo(BOM, { foreignKey: 'bomId', as: 'BOM' });
ProductionOrderItem.belongsTo(Item, { foreignKey: 'itemId', as: 'Item' });
ProductionOrderItem.belongsTo(User, { foreignKey: 'createdBy', as: 'Creator' });
ProductionOrderItem.belongsTo(User, { foreignKey: 'updatedBy', as: 'Updater' });

// Reverse associations for production
Store.hasMany(ProductionConfig, { foreignKey: 'rawMaterialStoreId', as: 'RawMaterialConfigs' });
Store.hasMany(ProductionConfig, { foreignKey: 'outputStoreId', as: 'OutputConfigs' });
Location.hasMany(ProductionConfig, { foreignKey: 'locationId', as: 'ProductionConfigs' });
Location.hasMany(BOM, { foreignKey: 'locationId', as: 'BOMs' });
Location.hasMany(ProductionOrder, { foreignKey: 'locationId', as: 'ProductionOrders' });
Item.hasMany(BOM, { foreignKey: 'itemId', as: 'BOMs' });
Item.hasMany(BOMItem, { foreignKey: 'itemId', as: 'BOMItems' });
Item.hasMany(ProductionOrder, { foreignKey: 'itemId', as: 'ProductionOrders' });
Item.hasMany(ProductionOrderItem, { foreignKey: 'itemId', as: 'ProductionOrderItems' });
Batch.hasMany(ProductionOrder, { foreignKey: 'batchId', as: 'ProductionOrders' });
BOM.hasMany(ProductionOrderItem, { foreignKey: 'bomId', as: 'ProductionOrderItems' });

// Supplier Return associations
SupplierReturn.belongsTo(Supplier, { foreignKey: 'supplierId', as: 'Supplier' });
SupplierReturn.belongsTo(PurchaseOrder, { foreignKey: 'purchaseOrderId', as: 'PurchaseOrder' });
SupplierReturn.belongsTo(GRN, { foreignKey: 'grnId', as: 'GRN' });
SupplierReturn.belongsTo(ReturnType, { foreignKey: 'returnTypeId', as: 'ReturnType' });
SupplierReturn.belongsTo(Location, { foreignKey: 'locationId', as: 'Location' });
SupplierReturn.belongsTo(Store, { foreignKey: 'storeId', as: 'Store' });
SupplierReturn.belongsTo(User, { foreignKey: 'createdBy', as: 'Creator' });
SupplierReturn.belongsTo(User, { foreignKey: 'updatedBy', as: 'Updater' });
SupplierReturn.belongsTo(User, { foreignKey: 'approvedBy', as: 'ApprovedByUser' });
SupplierReturn.hasMany(SupplierReturnItem, { foreignKey: 'supplierReturnId', as: 'SupplierReturnItems' });

// Supplier Return Item associations
SupplierReturnItem.belongsTo(SupplierReturn, { foreignKey: 'supplierReturnId', as: 'SupplierReturn' });
SupplierReturnItem.belongsTo(Item, { foreignKey: 'itemId', as: 'Item' });
SupplierReturnItem.belongsTo(Batch, { foreignKey: 'batchId', as: 'Batch' });
SupplierReturnItem.belongsTo(Unit, { foreignKey: 'unitId', as: 'Unit' });
SupplierReturnItem.belongsTo(ColdRoom, { foreignKey: 'coldRoomId', as: 'ColdRoom' });
SupplierReturnItem.belongsTo(PalletRack, { foreignKey: 'palletRackId', as: 'PalletRack' });
SupplierReturnItem.belongsTo(User, { foreignKey: 'createdBy', as: 'Creator' });
SupplierReturnItem.belongsTo(User, { foreignKey: 'updatedBy', as: 'Updater' });

// Supplier Payment associations
SupplierPayment.belongsTo(Supplier, { foreignKey: 'supplierId', as: 'Supplier' });
SupplierPayment.belongsTo(PurchaseOrder, { foreignKey: 'purchaseOrderId', as: 'PurchaseOrder' });
SupplierPayment.belongsTo(GRN, { foreignKey: 'grnId', as: 'GRN' });
SupplierPayment.belongsTo(SupplierReturn, { foreignKey: 'supplierReturnId', as: 'SupplierReturn' });
SupplierPayment.belongsTo(Location, { foreignKey: 'locationId', as: 'Location' });
SupplierPayment.belongsTo(User, { foreignKey: 'createdBy', as: 'Creator' });
SupplierPayment.belongsTo(User, { foreignKey: 'updatedBy', as: 'Updater' });
SupplierPayment.belongsTo(User, { foreignKey: 'approvedBy', as: 'ApprovedByUser' });
SupplierPayment.belongsTo(User, { foreignKey: 'processedBy', as: 'ProcessedByUser' });

// Supplier Payment GRN associations
SupplierPaymentGRN.belongsTo(SupplierPayment, { foreignKey: 'supplierPaymentId', as: 'SupplierPayment' });
SupplierPaymentGRN.belongsTo(GRN, { foreignKey: 'grnId', as: 'GRN' });
SupplierPaymentGRN.belongsTo(User, { foreignKey: 'createdBy', as: 'Creator' });
SupplierPaymentGRN.belongsTo(User, { foreignKey: 'updatedBy', as: 'Updater' });

SupplierPayment.hasMany(SupplierPaymentGRN, { foreignKey: 'supplierPaymentId', as: 'PaymentGRNs' });
GRN.hasMany(SupplierPaymentGRN, { foreignKey: 'grnId', as: 'PaymentDetails' });

// Reverse associations for new models
Supplier.hasMany(SupplierReturn, { foreignKey: 'supplierId', as: 'SupplierReturns' });
Supplier.hasMany(SupplierPayment, { foreignKey: 'supplierId', as: 'SupplierPayments' });
PurchaseOrder.hasMany(SupplierReturn, { foreignKey: 'purchaseOrderId', as: 'SupplierReturns' });
PurchaseOrder.hasMany(SupplierPayment, { foreignKey: 'purchaseOrderId', as: 'SupplierPayments' });
GRN.hasMany(SupplierReturn, { foreignKey: 'grnId', as: 'SupplierReturns' });
GRN.hasMany(SupplierPayment, { foreignKey: 'grnId', as: 'SupplierPayments' });

// Supplier Payment Method associations
SupplierPaymentMethod.belongsTo(SupplierPayment, { foreignKey: 'supplierPaymentId', as: 'SupplierPayment' });
SupplierPaymentMethod.belongsTo(PaymentType, { foreignKey: 'paymentTypeId', as: 'PaymentType' });
SupplierPaymentMethod.belongsTo(LedgerAccount, { foreignKey: 'ledgerAccountId', as: 'LedgerAccount' });
SupplierPaymentMethod.belongsTo(Bank, { foreignKey: 'bankId', as: 'Bank' });
SupplierPaymentMethod.belongsTo(BankBranch, { foreignKey: 'bankBranchId', as: 'BankBranch' });

SupplierPayment.hasMany(SupplierPaymentMethod, { foreignKey: 'supplierPaymentId', as: 'PaymentMethods' });
PaymentType.hasMany(SupplierPaymentMethod, { foreignKey: 'paymentTypeId', as: 'SupplierPayments' });

ReturnType.hasMany(SupplierReturn, { foreignKey: 'returnTypeId', as: 'SupplierReturns' });
Location.hasMany(SupplierReturn, { foreignKey: 'locationId', as: 'SupplierReturns' });
Location.hasMany(SupplierPayment, { foreignKey: 'locationId', as: 'SupplierPayments' });
Store.hasMany(SupplierReturn, { foreignKey: 'storeId', as: 'SupplierReturns' });
Item.hasMany(SupplierReturnItem, { foreignKey: 'itemId', as: 'SupplierReturnItems' });
SupplierReturn.hasMany(SupplierPayment, { foreignKey: 'supplierReturnId', as: 'RefundPayments' });

// Customer Return associations
CustomerReturn.belongsTo(Customer, { foreignKey: 'customerId', as: 'Customer' });
CustomerReturn.belongsTo(SalesOrder, { foreignKey: 'salesOrderId', as: 'SalesOrder' });
CustomerReturn.belongsTo(Invoice, { foreignKey: 'invoiceId', as: 'Invoice' });
CustomerReturn.belongsTo(DeliveryOrder, { foreignKey: 'deliveryOrderId', as: 'DeliveryOrder' });
CustomerReturn.belongsTo(ReturnType, { foreignKey: 'returnTypeId', as: 'ReturnType' });
CustomerReturn.belongsTo(Location, { foreignKey: 'locationId', as: 'Location' });
CustomerReturn.belongsTo(Store, { foreignKey: 'storeId', as: 'Store' });
CustomerReturn.belongsTo(User, { foreignKey: 'createdBy', as: 'Creator' });
CustomerReturn.belongsTo(User, { foreignKey: 'updatedBy', as: 'Updater' });
CustomerReturn.belongsTo(User, { foreignKey: 'approvedBy', as: 'ApprovedByUser' });
CustomerReturn.hasMany(CustomerReturnItem, { foreignKey: 'customerReturnId', as: 'CustomerReturnItems' });

// ReceiptCreditNote associations
Receipt.hasMany(ReceiptCreditNote, { foreignKey: 'receiptId', as: 'creditNoteSetOffs' });
ReceiptCreditNote.belongsTo(Receipt, { foreignKey: 'receiptId', as: 'receipt' });
ReceiptCreditNote.belongsTo(CreditNote, { foreignKey: 'creditNoteId', as: 'CreditNote' });
CreditNote.hasMany(ReceiptCreditNote, { foreignKey: 'creditNoteId', as: 'ReceiptSetOffs' });

// Customer Return Item associations
CustomerReturnItem.belongsTo(CustomerReturn, { foreignKey: 'customerReturnId', as: 'CustomerReturn' });
CustomerReturnItem.belongsTo(Item, { foreignKey: 'itemId', as: 'Item' });
CustomerReturnItem.belongsTo(Batch, { foreignKey: 'batchId', as: 'Batch' });
CustomerReturnItem.belongsTo(Unit, { foreignKey: 'unitId', as: 'Unit' });
CustomerReturnItem.belongsTo(ColdRoom, { foreignKey: 'coldRoomId', as: 'ColdRoom' });
CustomerReturnItem.belongsTo(PalletRack, { foreignKey: 'palletRackId', as: 'PalletRack' });
CustomerReturnItem.belongsTo(User, { foreignKey: 'createdBy', as: 'Creator' });
CustomerReturnItem.belongsTo(User, { foreignKey: 'updatedBy', as: 'Updater' });

// Reverse associations for Customer Return
Customer.hasMany(CustomerReturn, { foreignKey: 'customerId', as: 'CustomerReturns' });
SalesOrder.hasMany(CustomerReturn, { foreignKey: 'salesOrderId', as: 'CustomerReturns' });
Invoice.hasMany(CustomerReturn, { foreignKey: 'invoiceId', as: 'CustomerReturns' });
DeliveryOrder.hasMany(CustomerReturn, { foreignKey: 'deliveryOrderId', as: 'CustomerReturns' });
ReturnType.hasMany(CustomerReturn, { foreignKey: 'returnTypeId', as: 'CustomerReturns' });
Location.hasMany(CustomerReturn, { foreignKey: 'locationId', as: 'CustomerReturns' });
Store.hasMany(CustomerReturn, { foreignKey: 'storeId', as: 'CustomerReturns' });
Item.hasMany(CustomerReturnItem, { foreignKey: 'itemId', as: 'CustomerReturnItems' });

// Credit Note associations
CreditNote.belongsTo(Customer, { foreignKey: 'customerId', as: 'Customer' });
CreditNote.belongsTo(Invoice, { foreignKey: 'invoiceId', as: 'Invoice' });
CreditNote.belongsTo(CustomerReturn, { foreignKey: 'customerReturnId', as: 'CustomerReturn' });
CreditNote.belongsTo(Location, { foreignKey: 'locationId', as: 'Location' });
CreditNote.belongsTo(User, { foreignKey: 'createdBy', as: 'Creator' });
CreditNote.belongsTo(User, { foreignKey: 'updatedBy', as: 'Updater' });
CreditNote.belongsTo(User, { foreignKey: 'approvedBy', as: 'ApprovedByUser' });
CreditNote.hasMany(CreditNoteItem, { foreignKey: 'creditNoteId', as: 'CreditNoteItems' });

// Credit Note Item associations
CreditNoteItem.belongsTo(CreditNote, { foreignKey: 'creditNoteId', as: 'CreditNote' });
CreditNoteItem.belongsTo(Item, { foreignKey: 'itemId', as: 'Item' });
CreditNoteItem.belongsTo(InvoiceItem, { foreignKey: 'invoiceItemId', as: 'InvoiceItem' });
CreditNoteItem.belongsTo(CustomerReturnItem, { foreignKey: 'customerReturnItemId', as: 'CustomerReturnItem' });
CreditNoteItem.belongsTo(User, { foreignKey: 'createdBy', as: 'Creator' });
CreditNoteItem.belongsTo(User, { foreignKey: 'updatedBy', as: 'Updater' });

// Reverse associations for Credit Note
Customer.hasMany(CreditNote, { foreignKey: 'customerId', as: 'CreditNotes' });
Invoice.hasMany(CreditNote, { foreignKey: 'invoiceId', as: 'CreditNotes' });
CustomerReturn.hasMany(CreditNote, { foreignKey: 'customerReturnId', as: 'CreditNotes' });
Location.hasMany(CreditNote, { foreignKey: 'locationId', as: 'CreditNotes' });
Item.hasMany(CreditNoteItem, { foreignKey: 'itemId', as: 'CreditNoteItems' });
InvoiceItem.hasMany(CreditNoteItem, { foreignKey: 'invoiceItemId', as: 'CreditNoteItems' });
CustomerReturnItem.hasMany(CreditNoteItem, { foreignKey: 'customerReturnItemId', as: 'CreditNoteItems' });



// Good Request Note associations
GoodRequestNote.belongsTo(Location, { foreignKey: 'fromLocationId', as: 'FromLocation' });
GoodRequestNote.belongsTo(Store, { foreignKey: 'fromStoreId', as: 'FromStore' });
GoodRequestNote.belongsTo(Location, { foreignKey: 'toLocationId', as: 'ToLocation' });
GoodRequestNote.belongsTo(Store, { foreignKey: 'toStoreId', as: 'ToStore' });
GoodRequestNote.belongsTo(User, { foreignKey: 'requestedBy', as: 'RequestedByUser' });
GoodRequestNote.belongsTo(User, { foreignKey: 'approvedBy', as: 'ApprovedByUser' });
GoodRequestNote.belongsTo(User, { foreignKey: 'createdBy', as: 'Creator' });
GoodRequestNote.belongsTo(User, { foreignKey: 'updatedBy', as: 'Updater' });
GoodRequestNote.hasMany(GoodRequestNoteItem, { foreignKey: 'goodRequestNoteId', as: 'Items' });

// Good Request Note Item associations
GoodRequestNoteItem.belongsTo(GoodRequestNote, { foreignKey: 'goodRequestNoteId', as: 'GoodRequestNote' });
GoodRequestNoteItem.belongsTo(Item, { foreignKey: 'itemId', as: 'Item' });
GoodRequestNoteItem.belongsTo(Unit, { foreignKey: 'unitId', as: 'Unit' });
GoodRequestNoteItem.belongsTo(User, { foreignKey: 'createdBy', as: 'Creator' });
GoodRequestNoteItem.belongsTo(User, { foreignKey: 'updatedBy', as: 'Updater' });

// Issue Note associations
IssueNote.belongsTo(GoodRequestNote, { foreignKey: 'goodRequestNoteId', as: 'GoodRequestNote' });
IssueNote.belongsTo(Location, { foreignKey: 'fromLocationId', as: 'FromLocation' });
IssueNote.belongsTo(Store, { foreignKey: 'fromStoreId', as: 'FromStore' });
IssueNote.belongsTo(Location, { foreignKey: 'toLocationId', as: 'ToLocation' });
IssueNote.belongsTo(Store, { foreignKey: 'toStoreId', as: 'ToStore' });
IssueNote.belongsTo(User, { foreignKey: 'issuedBy', as: 'IssuedByUser' });
IssueNote.belongsTo(User, { foreignKey: 'approvedBy', as: 'ApprovedByUser' });
IssueNote.belongsTo(User, { foreignKey: 'createdBy', as: 'Creator' });
IssueNote.belongsTo(User, { foreignKey: 'updatedBy', as: 'Updater' });
IssueNote.hasMany(IssueNoteItem, { foreignKey: 'issueNoteId', as: 'Items' });

// Issue Note Item associations
IssueNoteItem.belongsTo(IssueNote, { foreignKey: 'issueNoteId', as: 'IssueNote' });
IssueNoteItem.belongsTo(GoodRequestNoteItem, { foreignKey: 'goodRequestNoteItemId', as: 'GoodRequestNoteItem' });
IssueNoteItem.belongsTo(Item, { foreignKey: 'itemId', as: 'Item' });
IssueNoteItem.belongsTo(Batch, { foreignKey: 'batchId', as: 'Batch' });
IssueNoteItem.belongsTo(Unit, { foreignKey: 'unitId', as: 'Unit' });
IssueNoteItem.belongsTo(User, { foreignKey: 'createdBy', as: 'Creator' });
IssueNoteItem.belongsTo(User, { foreignKey: 'updatedBy', as: 'Updater' });

// Transfer In Note associations
TransferInNote.belongsTo(IssueNote, { foreignKey: 'issueNoteId', as: 'IssueNote' });
TransferInNote.belongsTo(GoodRequestNote, { foreignKey: 'goodRequestNoteId', as: 'GoodRequestNote' });
TransferInNote.belongsTo(Location, { foreignKey: 'fromLocationId', as: 'FromLocation' });
TransferInNote.belongsTo(Store, { foreignKey: 'fromStoreId', as: 'FromStore' });
TransferInNote.belongsTo(Location, { foreignKey: 'toLocationId', as: 'ToLocation' });
TransferInNote.belongsTo(Store, { foreignKey: 'toStoreId', as: 'ToStore' });
TransferInNote.belongsTo(User, { foreignKey: 'transferredBy', as: 'TransferredByUser' });
TransferInNote.belongsTo(User, { foreignKey: 'receivedBy', as: 'ReceivedByUser' });
TransferInNote.belongsTo(User, { foreignKey: 'approvedBy', as: 'ApprovedByUser' });
TransferInNote.belongsTo(Vehicle, { foreignKey: 'vehicleId', as: 'Vehicle' });
TransferInNote.belongsTo(Driver, { foreignKey: 'driverId', as: 'Driver' });
TransferInNote.belongsTo(User, { foreignKey: 'createdBy', as: 'Creator' });
TransferInNote.belongsTo(User, { foreignKey: 'updatedBy', as: 'Updater' });
TransferInNote.hasMany(TransferInNoteItem, { foreignKey: 'transferInNoteId', as: 'Items' });

// Transfer In Note Item associations
TransferInNoteItem.belongsTo(TransferInNote, { foreignKey: 'transferInNoteId', as: 'TransferInNote' });
TransferInNoteItem.belongsTo(IssueNoteItem, { foreignKey: 'issueNoteItemId', as: 'IssueNoteItem' });
TransferInNoteItem.belongsTo(Item, { foreignKey: 'itemId', as: 'Item' });
TransferInNoteItem.belongsTo(Batch, { foreignKey: 'sourceBatchId', as: 'SourceBatch' });
TransferInNoteItem.belongsTo(Batch, { foreignKey: 'targetBatchId', as: 'TargetBatch' });
TransferInNoteItem.belongsTo(Unit, { foreignKey: 'unitId', as: 'Unit' });
TransferInNoteItem.belongsTo(Location, { foreignKey: 'storageLocationId', as: 'StorageLocation' });
TransferInNoteItem.belongsTo(User, { foreignKey: 'createdBy', as: 'Creator' });
TransferInNoteItem.belongsTo(User, { foreignKey: 'updatedBy', as: 'Updater' });

// Reverse associations for the new models
Location.hasMany(GoodRequestNote, { foreignKey: 'fromLocationId', as: 'RequestsFrom' });
Location.hasMany(GoodRequestNote, { foreignKey: 'toLocationId', as: 'RequestsTo' });
Store.hasMany(GoodRequestNote, { foreignKey: 'fromStoreId', as: 'RequestsFrom' });
Store.hasMany(GoodRequestNote, { foreignKey: 'toStoreId', as: 'RequestsTo' });
Item.hasMany(GoodRequestNoteItem, { foreignKey: 'itemId', as: 'GoodRequestNoteItems' });
Item.hasMany(IssueNoteItem, { foreignKey: 'itemId', as: 'IssueNoteItems' });
Item.hasMany(TransferInNoteItem, { foreignKey: 'itemId', as: 'TransferInNoteItems' });
Unit.hasMany(GoodRequestNoteItem, { foreignKey: 'unitId', as: 'GoodRequestNoteItems' });
Unit.hasMany(IssueNoteItem, { foreignKey: 'unitId', as: 'IssueNoteItems' });
Unit.hasMany(TransferInNoteItem, { foreignKey: 'unitId', as: 'TransferInNoteItems' });
Batch.hasMany(IssueNoteItem, { foreignKey: 'batchId', as: 'IssueNoteItems' });
Batch.hasMany(TransferInNoteItem, { foreignKey: 'sourceBatchId', as: 'SourceTransferItems' });
Batch.hasMany(TransferInNoteItem, { foreignKey: 'targetBatchId', as: 'TargetTransferItems' });
Vehicle.hasMany(TransferInNote, { foreignKey: 'vehicleId', as: 'TransferInNotes' });
Driver.hasMany(TransferInNote, { foreignKey: 'driverId', as: 'TransferInNotes' });

// CustomerItemCode associations
CustomerItemCode.belongsTo(Customer, { foreignKey: 'customerId', as: 'Customer' });
CustomerItemCode.belongsTo(Item, { foreignKey: 'itemId', as: 'Item' });
CustomerItemCode.belongsTo(Location, { foreignKey: 'locationId', as: 'Location' });
CustomerItemCode.belongsTo(User, { foreignKey: 'createdBy', as: 'Creator' });
CustomerItemCode.belongsTo(User, { foreignKey: 'updatedBy', as: 'Updater' });

// Reverse associations for CustomerItemCode
Customer.hasMany(CustomerItemCode, { foreignKey: 'customerId', as: 'CustomerItemCodes' });
Item.hasMany(CustomerItemCode, { foreignKey: 'itemId', as: 'CustomerItemCodes' });
Location.hasMany(CustomerItemCode, { foreignKey: 'locationId', as: 'CustomerItemCodes' });

// ====== ACCOUNTING MODULE ASSOCIATIONS ======

// AccountType associations
AccountType.hasMany(AccountCategory, { foreignKey: 'accountTypeId', as: 'Categories' });
AccountType.hasMany(ControlAccount, { foreignKey: 'accountTypeId', as: 'ControlAccounts' });
AccountType.hasMany(LedgerAccount, { foreignKey: 'accountTypeId', as: 'LedgerAccounts' });

// AccountCategory associations
AccountCategory.belongsTo(AccountType, { foreignKey: 'accountTypeId', as: 'AccountType' });
AccountCategory.hasMany(ControlAccount, { foreignKey: 'accountCategoryId', as: 'ControlAccounts' });
AccountCategory.hasMany(LedgerAccount, { foreignKey: 'accountCategoryId', as: 'LedgerAccounts' });

// ControlAccount associations
ControlAccount.belongsTo(AccountType, { foreignKey: 'accountTypeId', as: 'AccountType' });
ControlAccount.belongsTo(AccountCategory, { foreignKey: 'accountCategoryId', as: 'AccountCategory' });
ControlAccount.hasMany(LedgerAccount, { foreignKey: 'controlAccountId', as: 'LedgerAccounts' });

// LedgerAccount associations
LedgerAccount.belongsTo(AccountType, { foreignKey: 'accountTypeId', as: 'AccountType' });
LedgerAccount.belongsTo(AccountCategory, { foreignKey: 'accountCategoryId', as: 'AccountCategory' });
LedgerAccount.belongsTo(ControlAccount, { foreignKey: 'controlAccountId', as: 'ControlAccount' });
LedgerAccount.hasMany(JournalEntryLine, { foreignKey: 'ledgerAccountId', as: 'JournalLines' });
LedgerAccount.belongsTo(Bank, { foreignKey: 'bankId', as: 'Bank' });
LedgerAccount.belongsTo(BankBranch, { foreignKey: 'branchId', as: 'Branch' });


// Bank associations
Bank.hasMany(BankBranch, { foreignKey: 'bankId', as: 'Branches' });
Bank.belongsTo(User, { foreignKey: 'createdBy', as: 'Creator' });
Bank.belongsTo(User, { foreignKey: 'updatedBy', as: 'Updater' });

// BankBranch associations
BankBranch.belongsTo(Bank, { foreignKey: 'bankId', as: 'Bank' });
BankBranch.belongsTo(User, { foreignKey: 'createdBy', as: 'Creator' });
BankBranch.belongsTo(User, { foreignKey: 'updatedBy', as: 'Updater' });

// JournalEntry associations
JournalEntry.hasMany(JournalEntryLine, { foreignKey: 'journalEntryId', as: 'Lines' });
JournalEntry.belongsTo(User, { foreignKey: 'createdBy', as: 'Creator' });
JournalEntry.belongsTo(User, { foreignKey: 'postedBy', as: 'PostedByUser' });
JournalEntry.belongsTo(User, { foreignKey: 'approvedBy', as: 'ApprovedByUser' });

// JournalEntryLine associations
JournalEntryLine.belongsTo(JournalEntry, { foreignKey: 'journalEntryId', as: 'JournalEntry' });
JournalEntryLine.belongsTo(LedgerAccount, { foreignKey: 'ledgerAccountId', as: 'LedgerAccount' });

// AutoPostingRule associations
AutoPostingRule.belongsTo(LedgerAccount, { foreignKey: 'debitLedgerId', as: 'DebitLedger' });
AutoPostingRule.belongsTo(LedgerAccount, { foreignKey: 'creditLedgerId', as: 'CreditLedger' });

// PettyCashBook associations
PettyCashBook.belongsTo(LedgerAccount, { foreignKey: 'ledgerAccountId', as: 'LedgerAccount' });
PettyCashBook.hasMany(PettyCashCategory, { foreignKey: 'pettyCashBookId', as: 'Categories' });

// PettyCashCategory associations
PettyCashCategory.belongsTo(LedgerAccount, { foreignKey: 'ledgerAccountId', as: 'LedgerAccount' });

// BillEntry associations
BillEntry.belongsTo(Supplier, { foreignKey: 'supplierId', as: 'Supplier' });
BillEntry.belongsTo(GRN, { foreignKey: 'grnId', as: 'GRN' });
BillEntry.belongsTo(PurchaseOrder, { foreignKey: 'purchaseOrderId', as: 'PurchaseOrder' });
BillEntry.belongsTo(JournalEntry, { foreignKey: 'journalEntryId', as: 'JournalEntry' });
BillEntry.belongsTo(User, { foreignKey: 'createdBy', as: 'Creator' });
BillEntry.belongsTo(User, { foreignKey: 'approvedBy', as: 'ApprovedByUser' });
BillEntry.belongsTo(User, { foreignKey: 'postedBy', as: 'PostedByUser' });
BillEntry.hasMany(PaymentAllocation, { foreignKey: 'billEntryId', as: 'PaymentAllocations' });
BillEntry.hasMany(BillEntryDetail, { foreignKey: 'billEntryId', as: 'Details' });

// BillEntryDetail associations
BillEntryDetail.belongsTo(BillEntry, { foreignKey: 'billEntryId', as: 'BillEntry' });
BillEntryDetail.belongsTo(LedgerAccount, { foreignKey: 'ledgerId', as: 'LedgerAccount' });
BillEntryDetail.belongsTo(User, { foreignKey: 'createdBy', as: 'Creator' });
BillEntryDetail.belongsTo(User, { foreignKey: 'updatedBy', as: 'Updater' });

// BillPaymentDetail associations
BillPaymentDetail.belongsTo(BillPayment, { foreignKey: 'billPaymentId', as: 'BillPayment' });
BillPaymentDetail.belongsTo(LedgerAccount, { foreignKey: 'ledgerAccountId', as: 'LedgerAccount' });
BillPaymentDetail.belongsTo(PaymentType, { foreignKey: 'paymentTypeId', as: 'PaymentType' });
BillPaymentDetail.belongsTo(Bank, { foreignKey: 'bankId', as: 'Bank' });
BillPaymentDetail.belongsTo(BankBranch, { foreignKey: 'bankBranchId', as: 'BankBranch' });
BillPaymentDetail.belongsTo(User, { foreignKey: 'createdBy', as: 'Creator' });
BillPaymentDetail.belongsTo(User, { foreignKey: 'updatedBy', as: 'Updater' });

// BillPaymentEntry associations
BillPaymentEntry.belongsTo(BillPayment, { foreignKey: 'billPaymentId', as: 'BillPayment' });
BillPaymentEntry.belongsTo(BillEntry, { foreignKey: 'billEntryId', as: 'BillEntry' });
BillPaymentEntry.belongsTo(User, { foreignKey: 'createdBy', as: 'Creator' });
BillPaymentEntry.belongsTo(User, { foreignKey: 'updatedBy', as: 'Updater' });

// BillPayment associations
BillPayment.hasMany(BillPaymentDetail, { foreignKey: 'billPaymentId', as: 'Details' });
BillPayment.hasMany(BillPaymentEntry, { foreignKey: 'billPaymentId', as: 'Entries' });

// BillPayment other associations
BillPayment.belongsTo(Supplier, { foreignKey: 'supplierId', as: 'Supplier' });
BillPayment.belongsTo(JournalEntry, { foreignKey: 'journalEntryId', as: 'JournalEntry' });
BillPayment.belongsTo(TransactionHeader, { foreignKey: 'transactionHeaderId', as: 'TransactionHeader' });
BillPayment.belongsTo(User, { foreignKey: 'createdBy', as: 'Creator' });
BillPayment.belongsTo(User, { foreignKey: 'approvedBy', as: 'ApprovedByUser' });
BillPayment.belongsTo(User, { foreignKey: 'postedBy', as: 'PostedByUser' });
BillPayment.hasMany(PaymentAllocation, { foreignKey: 'billPaymentId', as: 'Allocations' });

// PaymentAllocation associations
PaymentAllocation.belongsTo(BillPayment, { foreignKey: 'billPaymentId', as: 'BillPayment' });
PaymentAllocation.belongsTo(BillEntry, { foreignKey: 'billEntryId', as: 'BillEntry' });
PaymentAllocation.belongsTo(User, { foreignKey: 'createdBy', as: 'Creator' });

// OnePayment associations (restructured - no supplier, supports multiple lines and payment methods)
OnePayment.hasMany(OnePaymentLine, { foreignKey: 'onePaymentId', as: 'Lines' });
OnePayment.hasMany(OnePaymentMethod, { foreignKey: 'onePaymentId', as: 'PaymentMethods' });
OnePayment.belongsTo(User, { foreignKey: 'createdBy', as: 'Creator' });
OnePayment.belongsTo(User, { foreignKey: 'approvedBy', as: 'ApprovedByUser' });
OnePayment.belongsTo(User, { foreignKey: 'postedBy', as: 'PostedByUser' });
OnePayment.belongsTo(User, { foreignKey: 'reversedBy', as: 'ReversedByUser' });

// OnePaymentLine associations
OnePaymentLine.belongsTo(OnePayment, { foreignKey: 'onePaymentId', as: 'OnePayment' });
OnePaymentLine.belongsTo(LedgerAccount, { foreignKey: 'ledgerAccountId', as: 'LedgerAccount' });
OnePaymentLine.belongsTo(User, { foreignKey: 'createdBy', as: 'Creator' });

// OnePaymentMethod associations
OnePaymentMethod.belongsTo(OnePayment, { foreignKey: 'onePaymentId', as: 'OnePayment' });
OnePaymentMethod.belongsTo(LedgerAccount, { foreignKey: 'ledgerAccountId', as: 'LedgerAccount' });
OnePaymentMethod.belongsTo(User, { foreignKey: 'createdBy', as: 'Creator' });

// FundsTransfer associations
FundsTransfer.belongsTo(LedgerAccount, { foreignKey: 'sourceBankAccountId', as: 'SourceBankAccount' });
FundsTransfer.belongsTo(LedgerAccount, { foreignKey: 'destinationBankAccountId', as: 'DestinationBankAccount' });
FundsTransfer.belongsTo(JournalEntry, { foreignKey: 'journalEntryId', as: 'JournalEntry' });
// FundsTransfer.belongsTo(TransactionHeader, { foreignKey: 'transactionHeaderId', as: 'TransactionHeader' });
FundsTransfer.belongsTo(User, { foreignKey: 'createdBy', as: 'Creator' });
FundsTransfer.belongsTo(User, { foreignKey: 'approvedBy', as: 'ApprovedByUser' });
FundsTransfer.belongsTo(User, { foreignKey: 'postedBy', as: 'PostedByUser' });
FundsTransfer.belongsTo(User, { foreignKey: 'reconciledBy', as: 'ReconciledByUser' });

// TransactionHeader associations
TransactionHeader.hasMany(TransactionDetail, { foreignKey: 'transactionHeaderId', as: 'Details' });
TransactionHeader.belongsTo(JournalEntry, { foreignKey: 'journalEntryId', as: 'JournalEntry' });
TransactionHeader.belongsTo(User, { foreignKey: 'createdBy', as: 'Creator' });

// TransactionDetail associations
TransactionDetail.belongsTo(TransactionHeader, { foreignKey: 'transactionHeaderId', as: 'TransactionHeader' });
TransactionDetail.belongsTo(JournalEntryLine, { foreignKey: 'journalEntryLineId', as: 'JournalEntryLine' });
TransactionDetail.belongsTo(LedgerAccount, { foreignKey: 'ledgerAccountId', as: 'LedgerAccount' });
TransactionDetail.belongsTo(User, { foreignKey: 'createdBy', as: 'Creator' });

// BankReconciliation associations
BankReconciliation.belongsTo(LedgerAccount, { foreignKey: 'bankAccountId', as: 'BankAccount' });
BankReconciliation.belongsTo(User, { foreignKey: 'createdBy', as: 'Creator' });
BankReconciliation.belongsTo(User, { foreignKey: 'updatedBy', as: 'Updater' });
BankReconciliation.belongsTo(User, { foreignKey: 'approvedBy', as: 'ApprovedByUser' });
BankReconciliation.hasMany(BankReconciliationItem, { foreignKey: 'bankReconciliationId', as: 'Items' });

// BankReconciliationItem associations
BankReconciliationItem.belongsTo(BankReconciliation, { foreignKey: 'bankReconciliationId', as: 'BankReconciliation' });
BankReconciliationItem.belongsTo(JournalEntry, { foreignKey: 'journalEntryId', as: 'JournalEntry' });
BankReconciliationItem.belongsTo(JournalEntryLine, { foreignKey: 'journalEntryLineId', as: 'JournalEntryLine' });
BankReconciliationItem.belongsTo(Receipt, { foreignKey: 'receiptId', as: 'Receipt' });
BankReconciliationItem.belongsTo(BillPayment, { foreignKey: 'billPaymentId', as: 'BillPayment' });
BankReconciliationItem.belongsTo(FundsTransfer, { foreignKey: 'fundsTransferId', as: 'FundsTransfer' });
BankReconciliationItem.belongsTo(BankStatementLine, { foreignKey: 'bankStatementLineId', as: 'BankStatementLine' });
BankReconciliationItem.belongsTo(User, { foreignKey: 'createdBy', as: 'Creator' });
BankReconciliationItem.belongsTo(User, { foreignKey: 'updatedBy', as: 'Updater' });

// BankStatement associations
BankStatement.belongsTo(LedgerAccount, { foreignKey: 'bankAccountId', as: 'BankAccount' });
BankStatement.belongsTo(User, { foreignKey: 'createdBy', as: 'Creator' });
BankStatement.belongsTo(User, { foreignKey: 'updatedBy', as: 'Updater' });
BankStatement.hasMany(BankStatementLine, { foreignKey: 'bankStatementId', as: 'Lines' });

// BankStatementLine associations
BankStatementLine.belongsTo(BankStatement, { foreignKey: 'bankStatementId', as: 'BankStatement' });
BankStatementLine.belongsTo(BankReconciliationItem, { foreignKey: 'reconciledWith', as: 'ReconciledItem' });
BankStatementLine.belongsTo(User, { foreignKey: 'createdBy', as: 'Creator' });
BankStatementLine.belongsTo(User, { foreignKey: 'updatedBy', as: 'Updater' });

// Reverse associations for bank reconciliation
LedgerAccount.hasMany(BankReconciliation, { foreignKey: 'bankAccountId', as: 'BankReconciliations' });
LedgerAccount.hasMany(BankStatement, { foreignKey: 'bankAccountId', as: 'BankStatements' });
JournalEntry.hasMany(BankReconciliationItem, { foreignKey: 'journalEntryId', as: 'ReconciliationItems' });

// PettyCashPayment associations
PettyCashPayment.belongsTo(PettyCashBook, { foreignKey: 'pettyCashBookId', as: 'PettyCashBook' });
PettyCashPayment.hasMany(PettyCashPaymentLine, { foreignKey: 'pettyCashPaymentId', as: 'Lines' });
PettyCashPayment.belongsTo(JournalEntry, { foreignKey: 'journalEntryId', as: 'JournalEntry' });
PettyCashPayment.belongsTo(TransactionHeader, { foreignKey: 'transactionHeaderId', as: 'TransactionHeader' });
PettyCashPayment.belongsTo(User, { foreignKey: 'createdBy', as: 'Creator' });

// PettyCashPaymentLine associations
PettyCashPaymentLine.belongsTo(PettyCashPayment, { foreignKey: 'pettyCashPaymentId', as: 'PettyCashPayment' });
PettyCashPaymentLine.belongsTo(PettyCashCategory, { foreignKey: 'categoryId', as: 'Category' });
PettyCashPaymentLine.belongsTo(LedgerAccount, { foreignKey: 'ledgerAccountId', as: 'LedgerAccount' });
PettyCashPaymentLine.belongsTo(User, { foreignKey: 'createdBy', as: 'Creator' });

// PettyCashReimbursement associations
PettyCashReimbursement.belongsTo(PettyCashBook, { foreignKey: 'pettyCashBookId', as: 'PettyCashBook' });
PettyCashReimbursement.belongsTo(LedgerAccount, { foreignKey: 'sourceLedgerAccountId', as: 'SourceAccount' });
PettyCashReimbursement.belongsTo(TransactionHeader, { foreignKey: 'transactionHeaderId', as: 'TransactionHeader' });
PettyCashReimbursement.belongsTo(User, { foreignKey: 'createdBy', as: 'Creator' });
PettyCashReimbursement.belongsTo(User, { foreignKey: 'approvedBy', as: 'ApprovedByUser' });
PettyCashReimbursement.belongsTo(User, { foreignKey: 'postedBy', as: 'PostedByUser' });

// Reverse associations
PettyCashBook.hasMany(PettyCashPayment, { foreignKey: 'pettyCashBookId', as: 'Payments' });
PettyCashBook.hasMany(PettyCashReimbursement, { foreignKey: 'pettyCashBookId', as: 'Reimbursements' });
JournalEntryLine.hasMany(BankReconciliationItem, { foreignKey: 'journalEntryLineId', as: 'ReconciliationItems' });
Receipt.hasMany(BankReconciliationItem, { foreignKey: 'receiptId', as: 'ReconciliationItems' });
BillPayment.hasMany(BankReconciliationItem, { foreignKey: 'billPaymentId', as: 'ReconciliationItems' });
FundsTransfer.hasMany(BankReconciliationItem, { foreignKey: 'fundsTransferId', as: 'ReconciliationItems' });


// Stock Adjustment associations
StockAdjustment.belongsTo(Location, { foreignKey: 'locationId', as: 'Location' });
StockAdjustment.belongsTo(Store, { foreignKey: 'storeId', as: 'Store' });
StockAdjustment.belongsTo(User, { foreignKey: 'createdBy', as: 'Creator' });
StockAdjustment.belongsTo(User, { foreignKey: 'updatedBy', as: 'Updater' });
StockAdjustment.belongsTo(User, { foreignKey: 'approvedBy', as: 'ApprovedByUser' });
StockAdjustment.hasMany(StockAdjustmentItem, { foreignKey: 'adjustmentId', as: 'Items' });

StockAdjustmentItem.belongsTo(StockAdjustment, { foreignKey: 'adjustmentId', as: 'StockAdjustment' });
StockAdjustmentItem.belongsTo(Item, { foreignKey: 'itemId', as: 'Item' });
StockAdjustmentItem.belongsTo(Batch, { foreignKey: 'batchId', as: 'Batch' });
StockAdjustmentItem.belongsTo(User, { foreignKey: 'createdBy', as: 'Creator' });
StockAdjustmentItem.belongsTo(User, { foreignKey: 'updatedBy', as: 'Updater' });

// Stock Reconciliation associations
StockReconciliation.belongsTo(Location, { foreignKey: 'locationId', as: 'Location' });
StockReconciliation.belongsTo(Store, { foreignKey: 'storeId', as: 'Store' });
StockReconciliation.belongsTo(User, { foreignKey: 'createdBy', as: 'Creator' });
StockReconciliation.belongsTo(User, { foreignKey: 'updatedBy', as: 'Updater' });
StockReconciliation.belongsTo(User, { foreignKey: 'approvedBy', as: 'ApprovedByUser' });
StockReconciliation.hasMany(StockReconciliationItem, { foreignKey: 'reconciliationId', as: 'Items' });

StockReconciliationItem.belongsTo(StockReconciliation, { foreignKey: 'reconciliationId', as: 'StockReconciliation' });
StockReconciliationItem.belongsTo(Item, { foreignKey: 'itemId', as: 'Item' });
StockReconciliationItem.belongsTo(Batch, { foreignKey: 'batchId', as: 'Batch' });
StockReconciliationItem.belongsTo(User, { foreignKey: 'createdBy', as: 'Creator' });
StockReconciliationItem.belongsTo(User, { foreignKey: 'updatedBy', as: 'Updater' });

// Bank Deposit associations
BankDeposit.belongsTo(LedgerAccount, { foreignKey: 'bankAccountId', as: 'BankAccount' });
BankDeposit.belongsTo(User, { foreignKey: 'createdBy', as: 'Creator' });
BankDeposit.belongsTo(User, { foreignKey: 'updatedBy', as: 'Updater' });
BankDeposit.belongsTo(User, { foreignKey: 'approvedBy', as: 'ApprovedByUser' });
BankDeposit.hasMany(BankDepositItem, { foreignKey: 'bankDepositId', as: 'Items' });

BankDepositItem.belongsTo(BankDeposit, { foreignKey: 'bankDepositId', as: 'BankDeposit' });
BankDepositItem.belongsTo(ReceiptPayment, { foreignKey: 'receiptPaymentId', as: 'ReceiptPayment' });
BankDepositItem.belongsTo(LedgerAccount, { foreignKey: 'ledgerAccountId', as: 'LedgerAccount' });
BankDepositItem.belongsTo(User, { foreignKey: 'createdBy', as: 'Creator' });

ReceiptPayment.belongsTo(BankDeposit, { foreignKey: 'bankDepositId', as: 'BankDeposit' });

module.exports = {
    User,
    Role,
    Permission,
    RolePermission,
    Category,
    Location,
    Store,
    Route,
    Vehicle,
    Item,
    Supplier,
    Customer,
    PurchaseOrder,
    PurchaseOrderItem,
    GRN,
    GRNItem,
    Stock,
    StockDetail,
    SalesOrder,
    SalesOrderItem,
    Driver,
    DeliveryOrder,
    DeliveryOrderItem,
    DeliveryOrderSummary,
    DeliveryOrderSummaryItem,
    Invoice,
    InvoiceItem,
    ColdRoom,
    ColdRoomItem,
    ColdRoomLog,
    DocumentSequence,
    UserActivityLog,
    GRNScheduleItem,
    TimeSlot,
    ReturnType,
    Unit,
    PaymentType,
    Receipt,
    ReceiptPayment,
    ReceiptInvoice,
    ReceiptSettledCheque,
    Batch,
    BatchItem,
    ProductionConfig,
    BOM,
    BOMItem,
    ProductionOrder,
    ProductionOrderItem,
    SupplierReturn,
    SupplierReturnItem,
    CustomerReturn,
    CustomerReturnItem,
    CreditNote,
    CreditNoteItem,
    SupplierPayment,
    SupplierPaymentMethod,
    SupplierPaymentGRN,
    GoodRequestNote,
    GoodRequestNoteItem,
    IssueNote,
    IssueNoteItem,
    TransferInNote,
    TransferInNoteItem,
    CustomerItemCode,
    CustomerCategoryDiscount,
    // Accounting Module Models
    AccountType,
    AccountCategory,
    ControlAccount,
    LedgerAccount,
    Bank,
    BankBranch,
    JournalEntry,
    JournalEntryLine,
    AutoPostingRule,
    PettyCashBook,
    PettyCashCategory,
    BillEntry,
    BillEntryDetail,
    BillPayment,
    BillPaymentDetail,
    BillPaymentEntry,
    PaymentAllocation,
    OnePayment,
    OnePaymentLine,
    OnePaymentMethod,
    FundsTransfer,
    TransactionHeader,
    TransactionDetail,
    BankReconciliation,
    BankReconciliationItem,
    BankStatement,
    BankStatementLine,
    SalesPersonCustomer,
    sequelize,
    StockAdjustment,
    StockAdjustmentItem,
    StockReconciliation,
    StockReconciliationItem,
    PettyCashReimbursement,
    PettyCashPayment,
    PettyCashPaymentLine,
    BankDeposit,
    BankDepositItem,
    ReceiptCreditNote
};