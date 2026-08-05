const VisitRequest = require('../models/VisitRequest');
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
const startOfWeek = (d) => {
  const date = startOfDay(d);
  const day = date.getDay(); // 0 = Sunday
  date.setDate(date.getDate() - day);
  return date;
};

// @route GET /api/reports/summary?range=today|week|custom&dateFrom=&dateTo=
const getSummaryReport = asyncHandler(async (req, res) => {
  const { range = 'today', dateFrom, dateTo } = req.query;

  let from, to;
  const now = new Date();
  if (range === 'today') {
    from = startOfDay(now);
    to = endOfDay(now);
  } else if (range === 'week') {
    from = startOfWeek(now);
    to = endOfDay(now);
  } else if (range === 'custom') {
    if (!dateFrom || !dateTo) throw new AppError('dateFrom and dateTo are required for a custom range.', 400);
    from = startOfDay(dateFrom);
    to = endOfDay(dateTo);
  } else {
    throw new AppError('Invalid range. Use today, week, or custom.', 400);
  }

  const dateFilter = { visitDate: { $gte: from, $lte: to } };

  const [
    totalRequests,
    statusAgg,
    byDepartmentAgg,
    byPurposeAgg,
    dailyTrendAgg,
    avgDurationAgg,
  ] = await Promise.all([
    VisitRequest.countDocuments(dateFilter),
    VisitRequest.aggregate([{ $match: dateFilter }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
    VisitRequest.aggregate([
      { $match: dateFilter },
      { $lookup: { from: 'employees', localField: 'employee', foreignField: '_id', as: 'emp' } },
      { $unwind: '$emp' },
      { $group: { _id: '$emp.department', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]),
    VisitRequest.aggregate([
      { $match: dateFilter },
      { $group: { _id: '$purpose', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]),
    VisitRequest.aggregate([
      { $match: dateFilter },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$visitDate' } }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]),
    VisitRequest.aggregate([
      { $match: { ...dateFilter, status: 'checked-out' } },
      { $project: { durationMinutes: { $divide: [{ $subtract: ['$checkOutTime', '$checkInTime'] }, 60000] } } },
      { $group: { _id: null, avgMinutes: { $avg: '$durationMinutes' } } },
    ]),
  ]);

  const statusBreakdown = statusAgg.reduce((acc, s) => ({ ...acc, [s._id]: s.count }), {});

  res.json({
    range: { from, to, type: range },
    totalRequests,
    statusBreakdown,
    byDepartment: byDepartmentAgg.map((d) => ({ department: d._id, count: d.count })),
    byPurpose: byPurposeAgg.map((d) => ({ purpose: d._id, count: d.count })),
    dailyTrend: dailyTrendAgg.map((d) => ({ date: d._id, count: d.count })),
    averageVisitDurationMinutes: avgDurationAgg[0] ? Math.round(avgDurationAgg[0].avgMinutes) : 0,
  });
});

module.exports = { getSummaryReport };
