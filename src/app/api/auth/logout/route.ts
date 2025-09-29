import { NextResponse } from 'next/server';

export async function POST() {
  // With JWT, logout is primarily handled client-side by removing the token
  // This endpoint can be used for logging purposes or future token blacklisting
  
  return NextResponse.json(
    { message: 'Logout successful' },
    { status: 200 }
  );
}