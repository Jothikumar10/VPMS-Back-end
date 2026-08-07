const VisitRequest = require("../models/VisitRequest");
const Employee = require("../models/Employee");
const User = require("../models/User");
const { asyncHandler, AppError } = require("../middleware/errorHandler");

const startOfDay = (date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

const endOfDay = (date) => {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
};

// GET /api/dashboard
const getDashboard = asyncHandler(async (req, res) => {
  const today = new Date();
  const todayStart = startOfDay(today);
  const todayEnd = endOfDay(today);

  // ================= ADMIN =================
  if (req.user.role === "admin") {
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
      VisitRequest.countDocuments({
        visitDate: {
          $gte: todayStart,
          $lte: todayEnd,
        },
        status: { $ne: "cancelled" },
      }),
      VisitRequest.countDocuments({
        status: "checked-in",
      }),
      VisitRequest.countDocuments({
        status: "pending",
      }),
      VisitRequest.countDocuments(),
      VisitRequest.aggregate([
        {
          $group: {
            _id: "$status",
            count: { $sum: 1 },
          },
        },
      ]),
    ]);

    const statusBreakdown = {};

    statusBreakdownAgg.forEach((item) => {
      statusBreakdown[item._id] = item.count;
    });

    return res.json({
      role: "admin",
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

  // ================= RECEPTIONIST =================
  if (req.user.role === "receptionist") {
    const [
      todaysVisitors,
      currentlyInside,
      scheduledVisitors,
      pendingApprovals,
      checkedOutToday,
    ] = await Promise.all([
      VisitRequest.countDocuments({
        visitDate: {
          $gte: todayStart,
          $lte: todayEnd,
        },
        status: { $ne: "cancelled" },
      }),

      VisitRequest.countDocuments({
        status: "checked-in",
      }),

      VisitRequest.countDocuments({
        visitDate: { $gt: todayEnd },
        status: {
          $in: ["pending", "approved"],
        },
      }),

      VisitRequest.countDocuments({
        status: "pending",
      }),

      VisitRequest.countDocuments({
        status: "checked-out",
        checkOutTime: {
          $gte: todayStart,
          $lte: todayEnd,
        },
      }),
    ]);

    const upcomingToday = await VisitRequest.find({
      visitDate: {
        $gte: todayStart,
        $lte: todayEnd,
      },
      status: "approved",
    })
      .populate("visitor", "name phone")
      .populate("employee", "name department")
      .sort({ expectedArrivalTime: 1 })
      .limit(10);

    return res.json({
      role: "receptionist",
      stats: {
        todaysVisitors,
        currentlyInside,
        scheduledVisitors,
        pendingApprovals,
        checkedOutToday,
      },
      upcomingToday,
    });
  }

  // ================= EMPLOYEE =================
  if (req.user.role === "employee") {
    let employee = null;

    // Try linked employee ID first
    if (req.user.employee) {
      employee = await Employee.findById(req.user.employee);
    }

    // Otherwise find employee by email
    if (!employee) {
      employee = await Employee.findOne({
        email: req.user.email,
      });
    }

    if (!employee) {
      throw new AppError(
        "Employee profile not found. Please create an employee record with the same email as the login account.",
        404
      );
    }

    const employeeId = employee._id;

    const [
      pendingRequests,
      approvedUpcoming,
      totalVisitorsHosted,
      todaysMeetings,
    ] = await Promise.all([
      VisitRequest.countDocuments({
        employee: employeeId,
        status: "pending",
      }),

      VisitRequest.countDocuments({
        employee: employeeId,
        status: "approved",
      }),

      VisitRequest.countDocuments({
        employee: employeeId,
        status: "checked-out",
      }),

      VisitRequest.countDocuments({
        employee: employeeId,
        visitDate: {
          $gte: todayStart,
          $lte: todayEnd,
        },
        status: {
          $in: [
            "pending",
            "approved",
            "checked-in",
          ],
        },
      }),
    ]);

    const recentRequests = await VisitRequest.find({
      employee: employeeId,
    })
      .populate("visitor")
      .sort({ createdAt: -1 })
      .limit(10);

    return res.json({
      role: "employee",
      employee,
      stats: {
        pendingRequests,
        approvedUpcoming,
        totalVisitorsHosted,
        todaysMeetings,
      },
      recentRequests,
    });
  }

  throw new AppError("Unknown role.", 400);
});

module.exports = {
  getDashboard,
};