import connectDB from "@/lib/mongodb";
import { Booking } from "@/models";
import { NextRequest } from "next/server";

interface ShortParams {
  params: Promise<{ code: string }>;
}

export async function GET(request: NextRequest, { params }: ShortParams) {
  await connectDB();
  const { code } = await params;
  const normalizedCode = code.trim().toUpperCase();

  let booking = await Booking.findOne({ publicShortCode: normalizedCode }).lean();
  if (!booking) {
    const escaped = normalizedCode.replace(/[.*+?^${}()|[\]\\]/g, "\$&");
    booking = await Booking.findOne({
      publicShortCode: { $regex: new RegExp(`^${escaped}$`, "i") },
    }).lean();
  }
  if (!booking || (booking as any).status === "cancelled") {
    return new Response("Not found", { status: 404 });
  }

  const token = (booking as any).publicToken;
  if (!token) {
    return new Response("Token not found", { status: 404 });
  }

  const origin = request.nextUrl.origin;
  const url = `${origin}/p/${(booking as any)._id}?t=${token}`;
  return Response.redirect(url, 302);
}
