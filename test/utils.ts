import { Pool } from 'pg';

const pool = new Pool({
  host: 'localhost',
  port: 5461,
  database: 'test',
  user: 'postgres',
  password: 'postgres',
});

export async function query(text: string, params?: any[]) {
  const client = await pool.connect();
  try {
    return await client.query(text, params);
  } finally {
    client.release();
  }
}

export async function cleanupDb() {
  await query('DELETE FROM expensetracker.expenses');
  await query('DELETE FROM expensetracker.categories');
}

export async function insertCategory(name: string) {
  await query('INSERT INTO expensetracker.categories (name) VALUES ($1)', [
    name,
  ]);
}

export async function getCategories() {
  const result = await query(
    'SELECT * FROM expensetracker.categories ORDER BY name'
  );
  return result.rows;
}

export async function insertExpense(
  date: string,
  description: string,
  category: string,
  amount: number,
  currency: string,
  method: string,
  type: string,
  convertedAmount: number = amount,
  baseCurrency: string = currency
) {
  await query(
    `INSERT INTO expensetracker.expenses (expense_date, description, location, category, amount, currency, converted_amount, base_currency, method, type, comment)
     VALUES ($1, $2, '', $3, $4, $5, $8, $9, $6, $7, '')`,
    [date, description, category, amount, currency, method, type, convertedAmount, baseCurrency]
  );
}

export async function getExpenses() {
  const result = await query('SELECT * FROM expensetracker.expenses ORDER BY id');
  return result.rows;
}
