const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.$queryRawUnsafe(
  "SELECT column_name, data_type, udt_name FROM information_schema.columns WHERE table_name = 'SupportTicket' AND column_name = 'category'"
).then(r => {
  console.log(JSON.stringify(r, null, 2));
  return p.$disconnect();
}).catch(e => {
  console.error(e);
  return p.$disconnect();
});
