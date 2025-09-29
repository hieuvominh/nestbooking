import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8 text-center">
        <div>
          <h1 className="text-4xl font-bold text-gray-900 mb-2">BookingCoo</h1>
          <p className="text-xl text-gray-600 mb-8">Co-working Space Management</p>
        </div>
        
        <div className="space-y-4">
          <Link
            href="/admin/login"
            className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Admin Login
          </Link>
          
          <div className="text-sm text-gray-500">
            <p>Demo credentials:</p>
            <p>Admin: admin@bookingcoo.com / admin123</p>
            <p>Staff: staff@bookingcoo.com / staff123</p>
          </div>
        </div>
        
        <div className="mt-8 text-sm text-gray-400">
          <p>Features:</p>
          <ul className="mt-2 space-y-1">
            <li>• Desk Management</li>
            <li>• Booking System</li>
            <li>• Inventory Tracking</li>
            <li>• Transaction Reports</li>
            <li>• Public Booking URLs</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
