import { dbService } from './src/lib/firebase';
async function run() {
  console.log('Fetching orders...');
  const orders = await dbService.getOrders();
  console.log(`Found ${orders.length} orders. Clearing...`);
  await dbService.clearAllOrders(orders);
  console.log('Done!');
  process.exit(0);
}
run();
