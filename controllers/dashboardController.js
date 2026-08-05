const VisitRequest = require('../models/VisitRequest');
const Employee = require('../models/Employee');
const User = require('../models/User');
const { asyncHandler, AppError } = require('../middleware/errorHandler');

const startOfDay = (d) => {
  const date = new Date(d);
  date.setHours(0, 0, 0, 0);
  return date;
};
const endOfDay = (d) => {
  const date = new Date(d);
  date.setHours(23, 59, 59, 999);
  return date;
};

// @route GET /api/dashboard
const getDashboard = asyncHandler(async (req, res) => {
  const today = new Date();
  const todayStart = startOfDay(today);
  const todayEnd = endOfDay(today);

  if (req.user.role === 'admin') {
    const [
      totalEmployees,
      totalUsers,
      todaysVisitors,
      currentlyInside,
      pendingApprovals,
      totalVisitsAllTime,
      statusBreakdownAgg,
    ] = await Promise.all([
      Employee.countDocuments({ isActive: true }),
      User.countDocuments({ isActive: true }),
      VisitRequest.countDocuments({ visitDate: { $gte: todayStart, $lte: todayEnd }, status: { $ne: 'cancelled' } }),
      VisitRequest.countDocuments({ status: 'checked-in' }),
      VisitRequest.countDocuments({ status: 'pending' }),
      VisitRequest.countDocuments(),
      VisitRequest.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    ]);

    const statusBreakdown = statusBreakdownAgg.reduce((acc, s) => ({ ...acc, [s._id]: s.count }), {});

    return res.json({
      role: 'admin',
      stats: {
        totalEmployees,
        totalUsers,
        todaysVisitors,
        currentlyInside,
        pendingApprovals,
        totalVisitsAllTime,
      },
      statusBreakdown,
    });
  }

  if (req.user.role === 'receptionist') {
    const [todaysVisitors, currentlyInside, scheduledVisitors, pendingApprovals, checkedOutToday] = await Promise.all([
      VisitRequest.countDocuments({ visitDate: { $gte: todayStart, $lte: todayEnd }, status: { $ne: 'cancelled' } }),
      VisitRequest.countDocuments({ status: 'checked-in' }),
      VisitRequest.countDocuments({ visitDate: { $gt: todayEnd }, status: { $in: ['pending', 'approved'] } }),
      VisitRequest.countDocuments({ status: 'pending' }),
      VisitRequest.countDocuments({ status: 'checked-out', checkOutTime: { $gte: todayStart, $lte: todayEnd } }),
    ]);

    const upcomingToday = await VisitRequest.find({
      visitDate: { $gte: todayStart, $lte: todayEnd },
      status: 'approved',
    })
      .populate('visitor', 'name phone')
      .populate('employee', 'name department')
      .sort({ expectedArrivalTime: 1 })
      .limit(10);

    return res.json({
      role: 'receptionist',
      stats: { todaysVisitors, currentlyInside, scheduledVisitors, pendingApprovals, checkedOutToday },
      upcomingToday,
    });
  }

  if (req.user.role === 'employee') {
    if (!req.user.employee) throw new AppError('Your account is not linked to an employee profile.', 400);
    const employeeId = req.user.employee;

    const [pendingRequests, approvedUpcoming, totalVisitorsHosted, todaysMeetings] = await Promise.all([
      VisitRequest.countDocuments({ employee: employeeId, status: 'pending' }),
      VisitRequest.countDocuments({ employee: employeeId, status: 'approved' }),
      VisitRequest.countDocuments({ employee: employeeId, status: 'checked-out' }),
      VisitRequest.countDocuments({
        employee: employeeId,
        visitDate: { $gte: todayStart, $lte: todayEnd },
        status: { $in: ['approved', 'checked-in', 'pending'] },
      }),
    ]);

    const recentRequests = await VisitRequest.find({ employee: employeeId })
      .populate('visitor', 'name phone company')
      .sort({ createdAt: -1 })
      .limit(10);

    return res.json({
      role: 'employee',
      stats: { pendingRequests, approvedUpcoming, totalVisitorsHosted, todaysMeetings },
      recentRequests,
    });
  }

  throw new AppError('Unknown role.', 400);
});

module.exports = { getDashboard };
