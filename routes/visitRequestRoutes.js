const express = require('express');
const router = express.Router();
const {
  registerVisitor, getVisitRequests, getVisitRequestById, getActivityHistory,
  approveRequest, rejectRequest, addRemarks,
  checkInVisitor, checkOutVisitor, cancelRequest,
} = require('../controllers/visitRequestController');
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/roleCheck');

router.use(protect);

// Search / list - all roles (results scoped per role inside controller)
router.get('/', authorize('admin', 'receptionist', 'employee'), getVisitRequests);
router.get('/:id', authorize('admin', 'receptionist', 'employee'), getVisitRequestById);
router.get('/:id/activity', authorize('admin', 'receptionist', 'employee'), getActivityHistory);

// Receptionist: registration, check-in, check-out, cancel
router.post('/', authorize('receptionist'), registerVisitor);
router.put('/:id/check-in', authorize('receptionist'), checkInVisitor);
router.put('/:id/check-out', authorize('receptionist'), checkOutVisitor);
router.put('/:id/cancel', authorize('receptionist'), cancelRequest);

// Employee: approve, reject, remarks
router.put('/:id/approve', authorize('employee'), approveRequest);
router.put('/:id/reject', authorize('employee'), rejectRequest);
router.put('/:id/remarks', authorize('employee'), addRemarks);

module.exports = router;
