import express from 'express';

const app = express();

app.use(express.json());

// Value of one unit of each supported currency expressed in CHF. The rate to
// convert `base` into `symbol` is chfPerUnit[base] / chfPerUnit[symbol], which
// keeps cross rates consistent the way the real Frankfurter API does.
const CHF_PER_UNIT: Record<string, number> = {
  CHF: 1,
  EUR: 0.95,
  USD: 0.9,
  HUF: 0.0026,
};

app.use((req, res, next) => {
  if (req.url !== '/health') {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  }
  next();
});

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// Frankfurter-compatible historical endpoint: GET /v1/:date?base=EUR&symbols=CHF
app.get('/v1/:date', (req, res) => {
  const base = String(req.query.base ?? 'EUR').toUpperCase();
  const symbols = String(req.query.symbols ?? '')
    .split(',')
    .map((symbol) => symbol.trim().toUpperCase())
    .filter(Boolean);

  const baseChf = CHF_PER_UNIT[base];
  if (baseChf === undefined) {
    res.status(404).json({ message: `Unsupported base currency: ${base}` });
    return;
  }

  const rates = symbols.reduce<Record<string, number>>((acc, symbol) => {
    const symbolChf = CHF_PER_UNIT[symbol];
    return symbolChf === undefined
      ? acc
      : { ...acc, [symbol]: Number((baseChf / symbolChf).toFixed(8)) };
  }, {});

  res.status(200).json({
    amount: 1,
    base,
    date: req.params.date,
    rates,
  });
});

const PORT = process.env.PORT ?? 8065;
app.listen(PORT, () => {
  console.log(`Mock exchange rate server is running on port ${PORT}`);
});
