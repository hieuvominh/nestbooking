// MongoDB initialization script
db = db.getSiblingDB('bookingcoo');

// Create a user for the application
db.createUser({
  user: 'app',
  pwd: 'apppassword123',
  roles: [
    {
      role: 'readWrite',
      db: 'bookingcoo'
    }
  ]
});

// Create indexes for better performance
db.users.createIndex({ email: 1 }, { unique: true });
db.desks.createIndex({ label: 1 }, { unique: true });
db.desks.createIndex({ status: 1 });
db.bookings.createIndex({ deskId: 1, startTime: 1, endTime: 1 });
db.bookings.createIndex({ publicToken: 1 }, { unique: true, sparse: true });
db.inventoryItems.createIndex({ sku: 1 }, { unique: true });
db.orders.createIndex({ bookingId: 1 });
db.transactions.createIndex({ type: 1, date: -1 });

print('Database initialized successfully');