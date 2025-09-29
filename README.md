# BookingCoo - Co-working Space Management System

A full-stack web application built with Next.js 13+ App Router, TypeScript, MongoDB, and TailwindCSS for managing a small co-working space.

## Features

### Admin Dashboard
- **Authentication**: Secure login/logout with JWT and bcrypt
- **Desk Management**: Manage up to 30 desks with status tracking (available, reserved, occupied, maintenance)
- **Booking Management**: 
  - Create/edit/cancel bookings with customer information
  - Prevent double-booking with availability checking
  - Generate public booking URLs with JWT signatures
- **Transaction Tracking**: Daily & monthly income/expense reporting with charts
- **Inventory Management**: 
  - CRUD operations for stock items (food/merchandise)
  - Low-stock alerts and quantity tracking
  - Stock in/out actions

### Public Booking Interface
- **QR Code Access**: Secure public URLs with signed JWT tokens
- **Check-in System**: Time-based check-in functionality
- **Food Ordering**: Cart system for ordering from available inventory
- **Real-time Updates**: 10-second polling for desk status and orders

## Tech Stack

- **Frontend**: Next.js 13+ App Router, TypeScript, TailwindCSS, shadcn/ui
- **Backend**: Next.js API Routes, MongoDB with Mongoose
- **Authentication**: JWT with bcrypt password hashing
- **Forms**: react-hook-form with zod validation
- **Data Fetching**: SWR for real-time updates
- **Charts**: Recharts for transaction visualization
- **Date Handling**: date-fns
- **Development**: Docker Compose for local setup

## Getting Started

### Prerequisites
- Node.js 20+
- MongoDB (or use Docker Compose)
- Docker & Docker Compose (optional)

### Local Development

1. **Clone and install dependencies**:
   ```bash
   git clone <your-repo>
   cd bookingcoo
   npm install
   ```

2. **Set up environment variables**:
   ```bash
   cp .env.local.example .env.local
   ```
   Edit `.env.local` with your configuration:
   ```env
   MONGODB_URI=mongodb://localhost:27017/bookingcoo
   JWT_SECRET=your-super-secret-jwt-key
   JWT_PUBLIC_SECRET=your-public-booking-secret
   NEXT_PUBLIC_APP_URL=http://localhost:3000
   PUBLIC_BOOKING_BUFFER_MINUTES=30
   ```

3. **Start with Docker Compose** (recommended):
   ```bash
   npm run docker:up
   ```
   This starts both MongoDB and the Next.js app.

4. **Or start manually**:
   ```bash
   # Start MongoDB separately, then:
   npm run dev
   ```

5. **Seed the database**:
   ```bash
   npm run seed
   ```

### Default Admin Credentials
After seeding:
- **Admin**: `admin@bookingcoo.com` / `admin123`
- **Staff**: `staff@bookingcoo.com` / `staff123`

## Database Schema

### Collections
- **users**: Admin/staff/customer accounts
- **desks**: Workspace desk information
- **bookings**: Booking records with customer info
- **inventoryItems**: Stock items (food/merchandise)
- **orders**: Orders tied to bookings
- **transactions**: Financial records

## Development Scripts

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Run ESLint
npm run seed         # Seed database with sample data
npm run docker:up    # Start with Docker Compose
npm run docker:down  # Stop Docker containers
npm run docker:build # Rebuild Docker images
```
