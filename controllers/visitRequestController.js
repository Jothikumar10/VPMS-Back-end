const mongoose = require('mongoose');
const VisitRequest = require('../models/VisitRequest');
const Visitor = require('../models/Visitor');
const Employee = require('../models/Employee');
const ActivityLog = require('../models/ActivityLog');
const { asyncHandler, AppError } = require('../middleware/errorHandler');

const ACTIVE_STATUSES = VisitRequest.ACTIVE_STATUSES; // pending, approved, checked-in

const startOfDay = (d) => {
  const date = new Date(d);
  date.setHours(0, 0, 0, 0);
  return date;
};

const logActivity = (visitRequestId, action, performedBy, remarks = '') =>
  ActivityLog.create({ visitRequest: visitRequestId, action, performedBy, remarks });

const populateOpts = [
  { path: 'visitor' },
  { path: 'employee', select: 'name email department designation' },
  { path: 'createdBy', select: 'name role' },
  { path: 'decidedBy', select: 'name role' },
  { path: 'checkedInBy', select: 'name role' },
  { path: 'checkedOutBy', select: 'name role' },
];

// Helper to reliably retrieve Employee ID for an employee user
const getEmployeeIdFromUser = async (user) => {
  if (user.employee) return user.employee;
  
  // Fallback: search employee record linked by userId or email
  const employee = await Employee.findOne({
    $or: [{ user: user._id }, { email: user.email }]
  });
  return employee ? employee._id : null;
};

// ---------------------------------------------------------------------------
// @route POST /api/visit-requests   (receptionist OR self-service visitor)
// ---------------------------------------------------------------------------
const registerVisitor = asyncHandler(async (req, res) => {
  const {
    name, phone, email, company, idProofType, idProofNumber,
    employeeId, purpose, visitDate, expectedArrivalTime,
  } = req.body;

  if (!name || !phone || !employeeId || !purpose || !visitDate || !expectedArrivalTime) {
    throw new AppError('Visitor name, phone, employee, purpose, visit date and arrival time are required.', 400);
  }
  if (!/^\d{2}:\d{2}$/.test(expectedArrivalTime)) {
    throw new AppError('Expected arrival time must be in HH:mm format.', 400);
  }

  const employee = await Employee.findById(employeeId);
  if (!employee || !employee.isActive) throw new AppError('Selected employee is not available.', 404);

  // ---- Rule 3: Visit date cannot be earlier than current date ----
  const today = startOfDay(new Date());
  const requestedDate = startOfDay(visitDate);
  if (requestedDate < today) {
    throw new AppError('Visit date cannot be earlier than the current date.', 400);
  }

  // ---- Rule 4: For today's registrations, arrival time cannot be earlier than now ----
  if (requestedDate.getTime() === today.getTime()) {
    const now = new Date();
    const [h, m] = expectedArrivalTime.split(':').map(Number);
    const arrival = new Date();
    arrival.setHours(h, m, 0, 0);
    if (arrival < now) {
      throw new AppError('Expected arrival time cannot be earlier than the current time for a same-day visit.', 400);
    }
  }

  // Find or create the visitor profile, identified by phone number
  let visitor = await Visitor.findOne({ phone: phone.trim() });
  if (!visitor) {
    visitor = await Visitor.create({ name, phone, email, company, idProofType, idProofNumber });
  } else {
    // keep visitor profile reasonably up to date
    visitor.name = name;
    if (email) visitor.email = email;
    if (company) visitor.company = company;
    if (idProofType) visitor.idProofType = idProofType;
    if (idProofNumber) visitor.idProofNumber = idProofNumber;
    await visitor.save();
  }

  // Self-service submissions must be tied to the logged-in visitor's own
  // account email — never trust a visitor-editable email field for this.
  if (req.user.role === 'visitor' && visitor.email !== req.user.email) {
    visitor.email = req.user.email;
    await visitor.save();
  }

  // ---- Rule 1: Visitor cannot have more than one active visit at the same time ----
  const activeExisting = await VisitRequest.findOne({
    visitor: visitor._id,
    status: { $in: ACTIVE_STATUSES },
  });
  if (activeExisting) {
    throw new AppError(
      'This visitor already has an active visit request (pending, approved, or checked-in). It must be completed or cancelled first.',
      409
    );
  }

  // ---- Rule 2: Duplicate visitor registration for same visitor on same date ----
  const dupSameDay = await VisitRequest.findOne({
    visitor: visitor._id,
    visitDate: requestedDate,
    status: { $nin: ['cancelled', 'rejected'] },
  });
  if (dupSameDay) {
    throw new AppError('This visitor is already registered for a visit on this date.', 409);
  }

  // ---- Rule 5: Employee cannot have more than 3 pending requests ----
  const pendingCount = await VisitRequest.countDocuments({ employee: employee._id, status: 'pending' });
  if (pendingCount >= 3) {
    throw new AppError('This employee already has 3 pending visitor requests awaiting approval. Please try again later.', 409);
  }

  const visitRequest = await VisitRequest.create({
    visitor: visitor._id,
    employee: employee._id,
    purpose,
    visitDate: requestedDate,
    expectedArrivalTime,
    status: 'pending',
    createdBy: req.user._id,
  });

  await logActivity(visitRequest._id, 'Created', req.user._id, `Registered by ${req.user.name}`);

  const populated = await VisitRequest.findById(visitRequest._id).populate(populateOpts);
  res.status(201).json({ visitRequest: populated });
});

// ---------------------------------------------------------------------------
// @route GET /api/visit-requests   (search + filter, staff roles)
// ---------------------------------------------------------------------------
const getVisitRequests = asyncHandler(async (req, res) => {
  const { visitorName, employeeName, status, dateFrom, dateTo, excludeCancelled, page = 1, limit = 20 } = req.query;

  const filter = {};

  // Employees only see requests addressed to them
  if (req.user.role === 'employee') {
    const employeeId = await getEmployeeIdFromUser(req.user);
    if (!employeeId) {
      return res.json({
        visitRequests: [],
        pagination: { page: 1, limit: parseInt(limit, 10) || 20, total: 0, pages: 0 },
      });
    }
    filter.employee = employeeId;
  }

  if (status) filter.status = status;
  if (excludeCancelled === 'true') filter.status = { $ne: 'cancelled' };

  if (dateFrom || dateTo) {
    filter.visitDate = {};
    if (dateFrom) filter.visitDate.$gte = startOfDay(dateFrom);
    if (dateTo) filter.visitDate.$lte = startOfDay(dateTo);
  }

  let visitorIds, employeeIds;
  if (visitorName) {
    visitorIds = await Visitor.find({ name: { $regex: visitorName, $options: 'i' } }).distinct('_id');
    filter.visitor = { $in: visitorIds };
  }
  if (employeeName) {
    employeeIds = await Employee.find({ name: { $regex: employeeName, $options: 'i' } }).distinct('_id');
    filter.employee = filter.employee
      ? (employeeIds.map(String).includes(String(filter.employee)) ? filter.employee : new mongoose.Types.ObjectId())
      : { $in: employeeIds };
  }

  const pageNum = Math.max(parseInt(page, 10) || 1, 1);
  const limitNum = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);

  const [visitRequests, total] = await Promise.all([
    VisitRequest.find(filter)
      .populate(populateOpts)
      .sort({ createdAt: -1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum),
    VisitRequest.countDocuments(filter),
  ]);

  res.json({
    visitRequests,
    pagination: { page: pageNum, limit: limitNum, total, pages: Math.ceil(total / limitNum) },
  });
});

// ---------------------------------------------------------------------------
// @route GET /api/visit-requests/my-requests   (visitor - own requests only)
// ---------------------------------------------------------------------------
const getMyRequests = asyncHandler(async (req, res) => {
  const visitorDoc = await Visitor.findOne({ email: req.user.email });

  if (!visitorDoc) {
    return res.json({ visitRequests: [] });
  }

  const visitRequests = await VisitRequest.find({ visitor: visitorDoc._id })
    .populate(populateOpts)
    .sort({ createdAt: -1 });

  res.json({ visitRequests });
});

const getVisitRequestById = asyncHandler(async (req, res) => {
  const visitRequest = await VisitRequest.findById(req.params.id).populate(populateOpts);
  if (!visitRequest) throw new AppError('Visit request not found.', 404);

  if (req.user.role === 'employee') {
    const employeeId = await getEmployeeIdFromUser(req.user);
    if (String(visitRequest.employee._id) !== String(employeeId)) {
      throw new AppError('You are not authorized to view this request.', 403);
    }
  }
  res.json({ visitRequest });
});

const getActivityHistory = asyncHandler(async (req, res) => {
  const visitRequest = await VisitRequest.findById(req.params.id);
  if (!visitRequest) throw new AppError('Visit request not found.', 404);

  if (req.user.role === 'employee') {
    const employeeId = await getEmployeeIdFromUser(req.user);
    if (String(visitRequest.employee) !== String(employeeId)) {
      throw new AppError('You are not authorized to view this request.', 403);
    }
  }

  const activity = await ActivityLog.find({ visitRequest: req.params.id })
    .populate('performedBy', 'name role')
    .sort({ timestamp: 1 });

  res.json({ activity });
});

const approveRequest = asyncHandler(async (req, res) => {
  const visitRequest = await VisitRequest.findById(req.params.id);
  if (!visitRequest) throw new AppError('Visit request not found.', 404);

  const employeeId = await getEmployeeIdFromUser(req.user);
  if (String(visitRequest.employee) !== String(employeeId)) {
    throw new AppError('You can only approve requests addressed to you.', 403);
  }
  if (visitRequest.status !== 'pending') {
    throw new AppError(`Only pending requests can be approved. Current status: ${visitRequest.status}.`, 400);
  }

  visitRequest.status = 'approved';
  visitRequest.decidedBy = req.user._id;
  if (req.body.remarks) visitRequest.employeeRemarks = req.body.remarks;
  await visitRequest.save();

  await logActivity(visitRequest._id, 'Approved', req.user._id, req.body.remarks || '');

  const populated = await VisitRequest.findById(visitRequest._id).populate(populateOpts);
  res.json({ visitRequest: populated });
});

const rejectRequest = asyncHandler(async (req, res) => {
  const { reason, remarks } = req.body;
  const visitRequest = await VisitRequest.findById(req.params.id);
  if (!visitRequest) throw new AppError('Visit request not found.', 404);

  const employeeId = await getEmployeeIdFromUser(req.user);
  if (String(visitRequest.employee) !== String(employeeId)) {
    throw new AppError('You can only reject requests addressed to you.', 403);
  }
  if (visitRequest.status !== 'pending') {
    throw new AppError(`Only pending requests can be rejected. Current status: ${visitRequest.status}.`, 400);
  }

  visitRequest.status = 'rejected';
  visitRequest.decidedBy = req.user._id;
  visitRequest.rejectionReason = reason || 'Not specified';
  if (remarks) visitRequest.employeeRemarks = remarks;
  await visitRequest.save();

  await logActivity(visitRequest._id, 'Rejected', req.user._id, reason || remarks || '');

  const populated = await VisitRequest.findById(visitRequest._id).populate(populateOpts);
  res.json({ visitRequest: populated });
});

const addRemarks = asyncHandler(async (req, res) => {
  const { remarks } = req.body;
  if (!remarks) throw new AppError('Remarks text is required.', 400);

  const visitRequest = await VisitRequest.findById(req.params.id);
  if (!visitRequest) throw new AppError('Visit request not found.', 404);
  
  const employeeId = await getEmployeeIdFromUser(req.user);
  if (String(visitRequest.employee) !== String(employeeId)) {
    throw new AppError('You can only add remarks to requests addressed to you.', 403);
  }

  visitRequest.employeeRemarks = remarks;
  await visitRequest.save();
  const populated = await VisitRequest.findById(visitRequest._id).populate(populateOpts);
  res.json({ visitRequest: populated });
});

const checkInVisitor = asyncHandler(async (req, res) => {
  const visitRequest = await VisitRequest.findById(req.params.id);
  if (!visitRequest) throw new AppError('Visit request not found.', 404);

  if (visitRequest.status === 'rejected') {
    throw new AppError('Rejected visitor requests cannot be checked in.', 400);
  }
  if (visitRequest.status !== 'approved') {
    if (visitRequest.status === 'checked-in') {
      throw new AppError('This visitor is already checked in.', 400);
    }
    throw new AppError('Only approved visit requests can be checked in.', 400);
  }

  visitRequest.status = 'checked-in';
  visitRequest.checkInTime = new Date();
  visitRequest.checkedInBy = req.user._id;
  visitRequest.badgeNumber = req.body.badgeNumber || `VP-${Date.now().toString().slice(-6)}`;
  await visitRequest.save();

  await logActivity(visitRequest._id, 'Checked In', req.user._id);

  const populated = await VisitRequest.findById(visitRequest._id).populate(populateOpts);
  res.json({ visitRequest: populated });
});

const checkOutVisitor = asyncHandler(async (req, res) => {
  const visitRequest = await VisitRequest.findById(req.params.id);
  if (!visitRequest) throw new AppError('Visit request not found.', 404);

  if (visitRequest.status !== 'checked-in') {
    throw new AppError('Only checked-in visitors can be checked out.', 400);
  }

  const checkOutTime = new Date();
  if (checkOutTime <= visitRequest.checkInTime) {
    throw new AppError('Check-out time must be later than check-in time.', 400);
  }

  visitRequest.status = 'checked-out';
  visitRequest.checkOutTime = checkOutTime;
  visitRequest.checkedOutBy = req.user._id;
  await visitRequest.save();

  await logActivity(visitRequest._id, 'Checked Out', req.user._id);

  const populated = await VisitRequest.findById(visitRequest._id).populate(populateOpts);
  res.json({ visitRequest: populated });
});

const cancelRequest = asyncHandler(async (req, res) => {
  const visitRequest = await VisitRequest.findById(req.params.id);
  if (!visitRequest) throw new AppError('Visit request not found.', 404);

  if (['checked-out', 'cancelled', 'rejected'].includes(visitRequest.status)) {
    throw new AppError(`A request with status "${visitRequest.status}" cannot be cancelled.`, 400);
  }

  visitRequest.status = 'cancelled';
  visitRequest.cancellationReason = req.body.reason || 'Not specified';
  await visitRequest.save();

  await logActivity(visitRequest._id, 'Cancelled', req.user._id, req.body.reason || '');

  const populated = await VisitRequest.findById(visitRequest._id).populate(populateOpts);
  res.json({ visitRequest: populated });
});

module.exports = {
  registerVisitor,
  getVisitRequests,
  getMyRequests,
  getVisitRequestById,
  getActivityHistory,
  approveRequest,
  rejectRequest,
  addRemarks,
  checkInVisitor,
  checkOutVisitor,
  cancelRequest,
};