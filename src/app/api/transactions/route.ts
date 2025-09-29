import { NextRequest } from 'next/server';
import { startOfMonth, endOfMonth, startOfDay, endOfDay } from 'date-fns';
import connectDB from '@/lib/mongodb';
import { Transaction } from '@/models';
import { withAuth, requireRole, ApiResponses, AuthenticatedRequest } from '@/lib/api-middleware';

// GET /api/transactions - Get transactions with filtering and aggregation
async function getTransactions(request: AuthenticatedRequest) {
  try {
    await connectDB();

    const { searchParams } = new URL(request.url);
    const month = searchParams.get('month'); // Format: YYYY-MM
    const type = searchParams.get('type'); // income/expense
    const source = searchParams.get('source');
    const aggregate = searchParams.get('aggregate') === 'true';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');

    // Build date range query
    let dateQuery: any = {};
    if (month) {
      const [year, monthNum] = month.split('-').map(Number);
      const startDate = startOfMonth(new Date(year, monthNum - 1));
      const endDate = endOfMonth(new Date(year, monthNum - 1));
      dateQuery.date = { $gte: startDate, $lte: endDate };
    } else {
      // Default to current month if no month specified
      const now = new Date();
      const startDate = startOfMonth(now);
      const endDate = endOfMonth(now);
      dateQuery.date = { $gte: startDate, $lte: endDate };
    }

    // Build filter query
    const query: any = { ...dateQuery };
    if (type && type !== 'all') {
      query.type = type;
    }
    if (source && source !== 'all') {
      query.source = source;
    }

    if (aggregate) {
      // Return aggregated data
      const aggregationPipeline = [
        { $match: query },
        {
          $group: {
            _id: {
              type: '$type',
              source: '$source',
              date: { $dateToString: { format: '%Y-%m-%d', date: '$date' } }
            },
            totalAmount: { $sum: '$amount' },
            count: { $sum: 1 }
          }
        },
        {
          $group: {
            _id: '$_id.type',
            totalAmount: { $sum: '$totalAmount' },
            count: { $sum: '$count' },
            sources: {
              $push: {
                source: '$_id.source',
                amount: '$totalAmount',
                count: '$count'
              }
            }
          }
        }
      ];

      const aggregated = await Transaction.aggregate(aggregationPipeline);
      
      // Calculate summary
      const summary = {
        totalIncome: 0,
        totalExpenses: 0,
        netIncome: 0,
        transactionCount: 0
      };

      aggregated.forEach((item) => {
        if (item._id === 'income') {
          summary.totalIncome = item.totalAmount;
        } else if (item._id === 'expense') {
          summary.totalExpenses = item.totalAmount;
        }
        summary.transactionCount += item.count;
      });

      summary.netIncome = summary.totalIncome - summary.totalExpenses;

      return ApiResponses.success({
        summary,
        breakdown: aggregated
      });

    } else {
      // Return transaction list with pagination
      const skip = (page - 1) * limit;

      const [transactions, total] = await Promise.all([
        Transaction.find(query)
          .populate('referenceId')
          .populate('createdBy', 'name email')
          .sort({ date: -1, createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        Transaction.countDocuments(query)
      ]);

      return ApiResponses.success({
        transactions,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      });
    }

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