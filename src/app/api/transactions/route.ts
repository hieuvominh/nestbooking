import { NextRequest } from 'next/server';
import { startOfMonth, endOfMonth, parseISO } from 'date-fns';
import connectDB from '@/lib/mongodb';
import { Transaction } from '@/models';
import { withAuth, requireRole, ApiResponses, AuthenticatedRequest } from '@/lib/api-middleware';
import { getNowInVietnam, getVietnamDateString } from '@/lib/vietnam-time';

// GET /api/transactions
async function getTransactions(request: AuthenticatedRequest) {
  try {
    await connectDB();

    const { searchParams } = new URL(request.url);
    const month = searchParams.get('month'); // YYYY-MM
    const dateFrom = searchParams.get('dateFrom'); // YYYY-MM-DD
    const dateTo = searchParams.get('dateTo');     // YYYY-MM-DD
    const type = searchParams.get('type');
    const source = searchParams.get('source');
    const aggregate = searchParams.get('aggregate') === 'true';
    const daily = searchParams.get('daily') === 'true';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '200');

    // Build date range
    let dateQuery: any = {};
    if (dateFrom || dateTo) {
      dateQuery.date = {};
      if (dateFrom) {
        const from = new Date(dateFrom);
        from.setHours(0, 0, 0, 0);
        dateQuery.date.$gte = from;
      }
      if (dateTo) {
        const to = new Date(dateTo);
        to.setHours(23, 59, 59, 999);
        dateQuery.date.$lte = to;
      }
    } else if (month) {
      const [year, monthNum] = month.split('-').map(Number);
      dateQuery.date = {
        $gte: startOfMonth(new Date(year, monthNum - 1)),
        $lte: endOfMonth(new Date(year, monthNum - 1)),
      };
    } else {
      const now = getNowInVietnam();
      dateQuery.date = {
        $gte: startOfMonth(now),
        $lte: endOfMonth(now),
      };
    }

    // Staff can only view today's revenue (income) for safety
    const isAdmin = request.user?.role === 'admin';
    if (!isAdmin) {
      const today = getVietnamDateString();
      const todayStart = new Date(`${today}T00:00:00+07:00`);
      const end = new Date(`${today}T23:59:59.999+07:00`);
      dateQuery = { date: { $gte: todayStart, $lte: end } };
    }

    const query: any = { ...dateQuery };
    if (type && type !== 'all' && isAdmin) query.type = type;
    if (source && source !== 'all' && isAdmin) query.source = source;

    // --- Daily breakdown ---
    if (daily) {
      const [dailyRows, allTx] = await Promise.all([
        Transaction.aggregate([
          { $match: query },
          {
            $group: {
              _id: {
                date: { $dateToString: { format: '%Y-%m-%d', date: '$date', timezone: '+07:00' } },
                type: '$type',
                source: '$source',
              },
              total: { $sum: '$amount' },
              count: { $sum: 1 },
            },
          },
          { $sort: { '_id.date': -1 } },
        ]),
        Transaction.find(query)
          .populate('createdBy', 'name')
          .populate({
            path: 'referenceId',
            select: 'customer startTime endTime totalAmount notes items total status name unit category description',
          })
          .sort({ date: -1, createdAt: -1 })
          .select('type amount source description category date createdBy referenceId referenceModel')
          .lean(),
      ]);

      // Group into days
      const dayMap: Record<string, any> = {};
      for (const row of dailyRows) {
        const d = row._id.date;
        if (!dayMap[d]) {
          dayMap[d] = { date: d, income: 0, expense: 0, net: 0, bySource: {}, count: 0 };
        }
        const day = dayMap[d];
        if (row._id.type === 'income') day.income += row.total;
        else day.expense += row.total;
        day.count += row.count;
        if (!day.bySource[row._id.source]) day.bySource[row._id.source] = { income: 0, expense: 0 };
        day.bySource[row._id.source][row._id.type] = (day.bySource[row._id.source][row._id.type] || 0) + row.total;
      }
      for (const d of Object.values(dayMap)) d.net = d.income - d.expense;

      // Attach transactions to their day
      const txByDay: Record<string, any[]> = {};
      for (const tx of allTx) {
        const d = new Date(tx.date as any).toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
        if (!txByDay[d]) txByDay[d] = [];
        txByDay[d].push(tx);
      }
      const days = Object.values(dayMap).sort((a, b) => b.date.localeCompare(a.date));
      for (const day of days) day.transactions = txByDay[day.date] || [];

      const summary = days.reduce(
        (acc, d) => { acc.income += d.income; acc.expense += d.expense; acc.count += d.count; return acc; },
        { income: 0, expense: 0, count: 0 }
      );
      (summary as any).net = (summary as any).income - (summary as any).expense;

      return ApiResponses.success({ days, summary });
    }

    // --- Legacy aggregate ---
    if (aggregate) {
      const aggregated = await Transaction.aggregate([
        { $match: query },
        { $group: { _id: '$type', totalAmount: { $sum: '$amount' }, count: { $sum: 1 } } },
      ]);
      const summary = { totalIncome: 0, totalExpenses: 0, netIncome: 0, transactionCount: 0 };
      aggregated.forEach((item) => {
        if (item._id === 'income') summary.totalIncome = item.totalAmount;
        else if (item._id === 'expense') summary.totalExpenses = item.totalAmount;
        summary.transactionCount += item.count;
      });
      summary.netIncome = summary.totalIncome - summary.totalExpenses;
      return ApiResponses.success({ summary, breakdown: aggregated });
    }

    // --- List ---
    const skip = (page - 1) * limit;
    const [transactions, total] = await Promise.all([
      Transaction.find(query)
        .populate('createdBy', 'name email')
        .sort({ date: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Transaction.countDocuments(query),
    ]);
    return ApiResponses.success({ transactions, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });

  } catch (error) {
    console.error('Get transactions error:', error);
    return ApiResponses.serverError();
  }

}

// POST /api/transactions - Create manual transaction
async function createTransaction(request: AuthenticatedRequest) {
  try {
    await connectDB();

    const body = await request.json();
    const {
      type,
      amount,
      source,
      description,
      category,
      date
    } = body;

    if (!type || !amount || !source || !description) {
      return ApiResponses.badRequest('Type, amount, source, and description are required');
    }

    if (amount <= 0) {
      return ApiResponses.badRequest('Amount must be positive');
    }

    const transaction = new Transaction({
      type,
      amount,
      source,
      description,
      category,
      date: date ? new Date(date) : new Date(),
      createdBy: request.user.userId
    });

    await transaction.save();
    await transaction.populate('createdBy', 'name email');

    return ApiResponses.created(transaction, 'Transaction created successfully');

  } catch (error) {
    console.error('Create transaction error:', error);
    return ApiResponses.serverError();
  }
}

export const GET = requireRole(['admin', 'staff'])(getTransactions);
export const POST = requireRole(['admin'])(createTransaction);
