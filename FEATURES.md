# BookingCoo - Features Overview

BookingCoo is a comprehensive desk booking and coworking space management system built with Next.js, MongoDB, and TypeScript.

## 🎯 Core Features

### 🔐 Authentication & Authorization
- **Admin Login**: Secure JWT-based authentication for admin/staff users
- **Role-based Access**: Admin and staff roles with different permissions
- **Session Management**: Persistent login sessions with token validation

### 🪑 Desk Management
- **Desk Creation**: Add desks with labels, locations, descriptions, and hourly rates
- **Desk Status**: Track desk availability (available, reserved, occupied, maintenance)
- **Location-based Organization**: Organize desks by areas (Window Side, Center, Quiet Zone, etc.)
- **Pricing Management**: Set different hourly rates per desk

### 📅 Booking System
- **Desk Reservations**: Book desks for specific time slots
- **Enhanced Booking Creation**: 
  - Add inventory items/combos during booking creation
  - Live total calculation (desk + items)
  - Immediate payment processing option
  - Cart system for multiple items with quantity control
- **Booking Status Management**: 
  - Pending → Confirmed → Checked-in → Completed/Cancelled
- **Customer Information**: Store customer details (name, email, phone)
- **Time Conflict Prevention**: Automatic conflict detection for overlapping bookings
- **Public Booking Links**: Generate secure public URLs for customer self-service
- **QR Code Generation**: QR codes for easy booking access
- **Billing Integration**: Direct access to detailed billing page from any booking

### 👥 Customer Management
- **Customer Profiles**: Store customer information with booking history
- **Contact Information**: Track names, emails, and phone numbers
- **Booking History**: View all past and current bookings per customer

### 🛒 Food & Beverage Ordering
- **Inventory Management**: 
  - Food items (sandwiches, salads, pasta)
  - Beverages (coffee, tea, juices)
  - Office supplies (pens, notebooks)
  - Merchandise (t-shirts, mugs)
- **Order Management**: 
  - Multiple items per order with quantities
  - Order status tracking (pending → confirmed → preparing → ready → delivered)
  - Real-time kitchen workflow management
- **Cart System**: Add multiple items before checkout
- **Order History**: Track all orders per booking

### 💰 Payment & Billing
- **Payment Status Tracking**: Pending, Paid, Refunded
- **Automatic Pricing**: Calculate booking costs based on duration and hourly rates
- **Order Totals**: Calculate order totals with item quantities
- **Transaction Management**: Link payments to bookings and orders

### 📊 Admin Dashboard
- **Booking Overview**: View all bookings with filters and status updates
- **Order Management**: Kitchen-style order tracking and status updates
- **Inventory Control**: 
  - Stock level monitoring
  - Low stock alerts
  - SKU-based item management
- **Desk Utilization**: Monitor desk usage and availability
- **Revenue Tracking**: Payment status and amounts

### 🔄 Real-time Updates
- **Status Management**: 
  - Booking status changes (check-in/check-out)
  - Order status updates for kitchen workflow
  - Desk availability updates
- **Live Data**: Real-time data synchronization across admin panels
- **Notifications**: Toast notifications for successful operations

### 🎨 User Interface
- **Responsive Design**: Works on desktop, tablet, and mobile
- **Modern UI**: Clean interface with shadcn/ui components
- **Color-coded Status**: Visual indicators for different statuses
- **Interactive Elements**: Dropdowns, modals, and forms for easy management

### 🔧 Technical Features
- **Database**: MongoDB with Mongoose ODM
- **API**: RESTful API with Next.js App Router
- **Authentication**: JWT tokens for secure API access
- **Data Validation**: Comprehensive input validation and error handling
- **Seeding**: Database seeding script for development setup
- **Docker Support**: MongoDB containerization

## 📱 User Workflows

### Admin Workflow
1. **Login** → Admin dashboard
2. **Manage Desks** → Create/edit desk configurations
3. **View Bookings** → Monitor reservations and check-ins
4. **Process Orders** → Kitchen management and order fulfillment
5. **Manage Inventory** → Stock control and item management

### Customer Workflow (via Public Links)
1. **Access Booking** → Via QR code or public URL
2. **View Booking Details** → See reservation information
3. **Check-in** → Digital signature for arrival
4. **Order Food/Items** → Browse menu and place orders
5. **Track Orders** → Monitor order status

### Staff Workflow
1. **Login** → Staff dashboard access
2. **Booking Management** → Update booking statuses
3. **Order Processing** → Update order status in kitchen
4. **Customer Service** → Handle customer inquiries

## 🗄️ Data Models

### Core Entities
- **Users**: Admin/staff accounts with roles
- **Desks**: Physical workspace units with pricing
- **Bookings**: Reservations linking customers to desks
- **Orders**: Food/item orders linked to bookings
- **Inventory Items**: Available products with stock levels
- **Customers**: Guest information (embedded in bookings)

### Key Relationships
- Bookings → Desks (many-to-one)
- Orders → Bookings (many-to-one)
- Orders → Inventory Items (many-to-many via order items)
- Bookings → Customers (one-to-one embedded)

## 🔑 Default Access

### Admin Account
- **Email**: admin@bookingcoo.com
- **Password**: admin123
- **Permissions**: Full system access

### Staff Account
- **Email**: staff@bookingcoo.com
- **Password**: staff123
- **Permissions**: Booking and order management

## 🚀 Quick Start

1. **Start MongoDB**: `docker start bookingcoo-mongo`
2. **Seed Database**: `npm run seed`
3. **Start Application**: `npm run dev`
4. **Access Admin**: Login with admin credentials
5. **Create Bookings**: Start managing desk reservations
6. **Process Orders**: Handle food/item orders

---

*Built with Next.js 15, TypeScript, MongoDB, Tailwind CSS, and shadcn/ui components*