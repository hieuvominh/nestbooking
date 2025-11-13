import mongoose from 'mongoose';
import { hashPassword } from '../src/lib/auth';
import { User, Desk, InventoryItem, Booking, Order } from '../src/models';

async function seedDatabase() {
  try {
    // Connect to MongoDB
    const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/bookingcoo';
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    // Clear existing data
    await User.deleteMany({});
    await Desk.deleteMany({});
    await InventoryItem.deleteMany({});
    await Booking.deleteMany({});
    await Order.deleteMany({});
    
    // Drop any problematic indexes
    try {
      if (mongoose.connection.db) {
        await mongoose.connection.db.collection('desks').dropIndex('name_1');
        console.log('Dropped old name_1 index');
      }
    } catch (error) {
      // Index might not exist, which is fine
    }
    
    try {
      if (mongoose.connection.db) {
        await mongoose.connection.db.collection('bookings').dropIndex('publicToken_1');
        console.log('Dropped old publicToken_1 index');
      }
    } catch (error) {
      // Index might not exist, which is fine
    }
    
    console.log('Cleared existing data');

    // Create admin user
    const adminPassword = await hashPassword('admin123');
    const admin = new User({
      email: 'admin@bookingcoo.com',
      password: adminPassword,
      name: 'Admin User',
      role: 'admin',
      phone: '+1234567890'
    });
    await admin.save();
    console.log('Created admin user: admin@bookingcoo.com / admin123');

    // Create staff user
    const staffPassword = await hashPassword('staff123');
    const staff = new User({
      email: 'staff@bookingcoo.com',
      password: staffPassword,
      name: 'Staff User',
      role: 'staff',
      phone: '+1234567891'
    });
    await staff.save();
    console.log('Created staff user: staff@bookingcoo.com / staff123');

    // Create desks
    const desks = [
      { label: 'A1', location: 'Window Side', description: 'Desk with natural light', hourlyRate: 12 },
      { label: 'A2', location: 'Window Side', description: 'Desk with natural light', hourlyRate: 12 },
      { label: 'B1', location: 'Center', description: 'Standard workspace', hourlyRate: 10 },
      { label: 'B2', location: 'Center', description: 'Standard workspace', hourlyRate: 10 },
      { label: 'B3', location: 'Center', description: 'Standard workspace', hourlyRate: 10 },
      { label: 'C1', location: 'Quiet Zone', description: 'Perfect for focused work', hourlyRate: 15 },
      { label: 'C2', location: 'Quiet Zone', description: 'Perfect for focused work', hourlyRate: 15 },
      { label: 'D1', location: 'Collaborative Area', description: 'Good for team work', hourlyRate: 8 },
      { label: 'D2', location: 'Collaborative Area', description: 'Good for team work', hourlyRate: 8 },
      { label: 'E1', location: 'Private Room', description: 'Private workspace', hourlyRate: 25 }
    ];

    for (const deskData of desks) {
      const desk = new Desk(deskData);
      await desk.save();
    }
    console.log(`Created ${desks.length} desks`);

    // Create inventory items
    const inventoryItems = [
      // Food items
      { sku: 'SAND001', name: 'Club Sandwich', description: 'Fresh club sandwich with fries', category: 'food', price: 12.99, quantity: 20, lowStockThreshold: 5, unit: 'pcs' },
      { sku: 'SAND002', name: 'Grilled Chicken Sandwich', description: 'Grilled chicken with vegetables', category: 'food', price: 11.99, quantity: 15, lowStockThreshold: 3, unit: 'pcs' },
      { sku: 'SALA001', name: 'Caesar Salad', description: 'Fresh caesar salad', category: 'food', price: 9.99, quantity: 10, lowStockThreshold: 2, unit: 'pcs' },
      { sku: 'PASTA001', name: 'Pasta Carbonara', description: 'Creamy carbonara pasta', category: 'food', price: 14.99, quantity: 12, lowStockThreshold: 3, unit: 'pcs' },
      
      // Beverages
      { sku: 'COFF001', name: 'Espresso', description: 'Strong espresso shot', category: 'beverage', price: 3.50, quantity: 50, lowStockThreshold: 10, unit: 'cups' },
      { sku: 'COFF002', name: 'Cappuccino', description: 'Classic cappuccino', category: 'beverage', price: 4.50, quantity: 40, lowStockThreshold: 8, unit: 'cups' },
      { sku: 'COFF003', name: 'Latte', description: 'Smooth caffè latte', category: 'beverage', price: 5.00, quantity: 35, lowStockThreshold: 7, unit: 'cups' },
      { sku: 'TEA001', name: 'Green Tea', description: 'Fresh green tea', category: 'beverage', price: 3.00, quantity: 30, lowStockThreshold: 5, unit: 'cups' },
      { sku: 'JUICE001', name: 'Orange Juice', description: 'Fresh squeezed orange juice', category: 'beverage', price: 4.00, quantity: 25, lowStockThreshold: 5, unit: 'glasses' },
      { sku: 'WATER001', name: 'Sparkling Water', description: 'Premium sparkling water', category: 'beverage', price: 2.50, quantity: 60, lowStockThreshold: 15, unit: 'bottles' },
      
      // Office supplies
      { sku: 'PEN001', name: 'Blue Ballpoint Pen', description: 'High-quality ballpoint pen', category: 'office-supplies', price: 2.99, quantity: 100, lowStockThreshold: 20, unit: 'pcs' },
      { sku: 'NOTE001', name: 'Sticky Notes', description: 'Pack of colorful sticky notes', category: 'office-supplies', price: 4.99, quantity: 50, lowStockThreshold: 10, unit: 'packs' },
      { sku: 'NOTE002', name: 'A4 Notebook', description: 'Ruled A4 notebook', category: 'office-supplies', price: 8.99, quantity: 30, lowStockThreshold: 5, unit: 'pcs' },
      
      // Merchandise
      { sku: 'TSHIRT001', name: 'BookingCoo T-Shirt', description: 'Official BookingCoo branded t-shirt', category: 'merchandise', price: 24.99, quantity: 20, lowStockThreshold: 3, unit: 'pcs' },
      { sku: 'MUG001', name: 'BookingCoo Mug', description: 'Ceramic mug with logo', category: 'merchandise', price: 12.99, quantity: 25, lowStockThreshold: 5, unit: 'pcs' },
      
      // Combo Packages
      { 
        sku: 'COMBO001', 
        name: 'Half-Day Productivity Package', 
        description: 'Perfect for focused work sessions', 
        category: 'combo', 
        price: 49.99, 
        quantity: 10, 
        lowStockThreshold: 2, 
        unit: 'packages',
        type: 'combo',
        duration: 4,
        includedItems: ['4 hours desk time', 'Coffee or tea', 'Light snack', 'Water bottle']
      },
      { 
        sku: 'COMBO002', 
        name: 'Full-Day Premium Package', 
        description: 'Everything you need for a full workday', 
        category: 'combo', 
        price: 89.99, 
        quantity: 8, 
        lowStockThreshold: 2, 
        unit: 'packages',
        type: 'combo',
        duration: 8,
        includedItems: ['8 hours desk time', 'Lunch meal', 'Coffee & tea (unlimited)', 'Snacks', 'Water & juice', 'Priority support']
      },
      { 
        sku: 'COMBO003', 
        name: 'Quick Meeting Package', 
        description: 'Short productive meeting setup', 
        category: 'combo', 
        price: 29.99, 
        quantity: 15, 
        lowStockThreshold: 3, 
        unit: 'packages',
        type: 'combo',
        duration: 2,
        includedItems: ['2 hours desk time', 'Coffee or tea', 'Water']
      },
    ];

    for (const itemData of inventoryItems) {
      const item = new InventoryItem(itemData);
      await item.save();
    }
    console.log(`Created ${inventoryItems.length} inventory items`);

    // Create sample bookings first (needed for orders)
    const createdDesks = await Desk.find({});
    const sampleBookings = [
      {
        customer: {
          name: 'John Doe',
          email: 'john.doe@example.com',
          phone: '+1234567890'
        },
        deskId: createdDesks[0]._id,
        startTime: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
        endTime: new Date(Date.now() + 2 * 60 * 60 * 1000), // 2 hours from now
        status: 'confirmed',
        totalAmount: 48, // 4 hours * $12
        paymentStatus: 'paid'
      },
      {
        customer: {
          name: 'Jane Smith',
          email: 'jane.smith@example.com',
          phone: '+1234567891'
        },
        deskId: createdDesks[2]._id,
        startTime: new Date(Date.now() - 1 * 60 * 60 * 1000), // 1 hour ago
        endTime: new Date(Date.now() + 3 * 60 * 60 * 1000), // 3 hours from now
        status: 'checked-in',
        totalAmount: 40, // 4 hours * $10
        paymentStatus: 'paid'
      }
    ];

    const createdBookings = [];
    for (const bookingData of sampleBookings) {
      const booking = new Booking(bookingData);
      await booking.save();
      createdBookings.push(booking);
    }
    console.log(`Created ${createdBookings.length} sample bookings`);

    // Create sample orders
    const createdItems = await InventoryItem.find({});
    const sampleOrders = [
      {
        bookingId: createdBookings[0]._id,
        items: [
          {
            itemId: createdItems.find(item => item.sku === 'COFF002')?._id,
            name: 'Cappuccino',
            price: 4.50,
            quantity: 2,
            subtotal: 9.00
          },
          {
            itemId: createdItems.find(item => item.sku === 'SAND001')?._id,
            name: 'Club Sandwich',
            price: 12.99,
            quantity: 1,
            subtotal: 12.99
          }
        ],
        total: 21.99,
        status: 'ready',
        notes: 'Extra hot cappuccino',
        orderedAt: new Date(Date.now() - 30 * 60 * 1000) // 30 minutes ago
      },
      {
        bookingId: createdBookings[1]._id,
        items: [
          {
            itemId: createdItems.find(item => item.sku === 'COFF003')?._id,
            name: 'Latte',
            price: 5.00,
            quantity: 1,
            subtotal: 5.00
          },
          {
            itemId: createdItems.find(item => item.sku === 'PASTA001')?._id,
            name: 'Pasta Carbonara',
            price: 14.99,
            quantity: 1,
            subtotal: 14.99
          }
        ],
        total: 19.99,
        status: 'preparing',
        orderedAt: new Date(Date.now() - 15 * 60 * 1000) // 15 minutes ago
      }
    ];

    for (const orderData of sampleOrders) {
      const order = new Order(orderData);
      await order.save();
    }
    console.log(`Created ${sampleOrders.length} sample orders`);

    console.log('Database seeding completed successfully!');
    console.log('\nCreated accounts:');
    console.log('Admin: admin@bookingcoo.com / admin123');
    console.log('Staff: staff@bookingcoo.com / staff123');

  } catch (error) {
    console.error('Seeding error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

// Run the seed function
seedDatabase();