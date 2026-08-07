const express = require('express');
const router = express.Router();
const {
  registerVisitor, getVisitRequests, getMyRequests, getVisitRequestById, getActivityHistory,
  approveRequest, rejectRequest, addRemarks,
  checkInVisitor, checkOutVisitor, cancelRequest,
} = require('../controllers/visitRequestController');
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/roleCheck');

router.use(protect);

// Visitor: view own requests — must come BEFORE '/:id',
// otherwise Express matches "my-requests" as an :id param
router.get('/my-requests', authorize('visitor'), getMyRequests);

// Registration — receptionist (walk-ins) or the visitor themself (self-service)
router.post('/', authorize('receptionist', 'visitor'), registerVisitor);

// Search / list - staff roles (results scoped per role inside controller)
router.get('/', authorize('admin', 'receptionist', 'employee'), getVisitRequests);
router.get('/:id', authorize('admin', 'receptionist', 'employee', 'visitor'), getVisitRequestById);
router.get('/:id/activity', authorize('admin', 'receptionist', 'employee'), getActivityHistory);

// Receptionist: check-in, check-out, cancel
router.put('/:id/check-in', authorize('receptionist'), checkInVisitor);
router.put('/:id/check-out', authorize('receptionist'), checkOutVisitor);
router.put('/:id/cancel', authorize('receptionist', 'visitor'), cancelRequest);

// Employee: approve, reject, remarks
router.put('/:id/approve', authorize('employee'), approveRequest);
router.put('/:id/reject', authorize('employee'), rejectRequest);
router.put('/:id/remarks', authorize('employee'), addRemarks);

module.exports = router;