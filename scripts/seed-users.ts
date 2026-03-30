import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { hashPassword } from '../src/lib/auth';
import { User } from '../src/models';

dotenv.config({ path: '.env.local' });

const usersToSeed = [
  { name: 'Thuỷ', email: 'thuy@nestss.com', role: 'staff' as const, password: 'thuy4782' },
  { name: 'Hà',   email: 'ha@nestss.com',   role: 'staff' as const, password: 'ha9315' },
  { name: 'Huy',  email: 'huy@nestss.com',  role: 'staff' as const, password: 'huy6053' },
  { name: 'Bảo',  email: 'bao@nestss.com',  role: 'staff' as const, password: 'bao2741' },
  { name: 'Khoa', email: 'khoa@nestss.com', role: 'staff' as const, password: 'khoa8629' },
  { name: 'Na',   email: 'na@nestss.com',   role: 'admin' as const, password: 'na5194' },
];
async function seedUsers() {
  const MONGODB_URI = process.env.MONGODB_URI;
  if (!MONGODB_URI) {
    console.error('MONGODB_URI not set');
    process.exit(1);
  }

  await mongoose.connect(MONGODB_URI);
  console.log('Connected to MongoDB');

  for (const u of usersToSeed) {
    const existing = await User.findOne({ email: u.email });
    if (existing) {
      console.log(`  Skipped (already exists): ${u.name} <${u.email}>`);
      continue;
    }
    const hashed = await hashPassword(u.password);
    await User.create({ name: u.name, email: u.email, role: u.role, password: hashed });
    console.log(`  Created [${u.role}]: ${u.name} <${u.email}> / ${u.password}`);
  }

  await mongoose.disconnect();
  console.log('Done.');
}

seedUsers().catch((err) => {
  console.error(err);
  process.exit(1);
});
