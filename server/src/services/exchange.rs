use chrono::NaiveDate;
use rust_decimal::{Decimal, RoundingStrategy};
use serde::Deserialize;
use std::{
    collections::HashMap,
    sync::Arc,
    time::{Duration, Instant},
};
use tokio::sync::Mutex;

type Rates = HashMap<(String, NaiveDate), (Instant, Decimal)>;

#[derive(Clone)]
pub struct Exchange {
    pub base: String,
    url: String,
    client: reqwest::Client,
    cache: Arc<Mutex<Rates>>,
}

#[derive(Deserialize)]
struct RatesResponse {
    rates: HashMap<String, Decimal>,
}

impl Exchange {
    pub fn new(url: String, base: String) -> anyhow::Result<Self> {
        Ok(Self {
            base,
            url,
            client: reqwest::Client::builder()
                .timeout(Duration::from_secs(5))
                .build()?,
            cache: Arc::default(),
        })
    }

    pub async fn convert(
        &self,
        amount: Decimal,
        currency: &str,
        date: NaiveDate,
    ) -> anyhow::Result<Decimal> {
        let rate = if currency.eq_ignore_ascii_case(&self.base) {
            Decimal::ONE
        } else {
            let key = (currency.to_owned(), date);
            let mut cache = self.cache.lock().await;
            if let Some((_, rate)) = cache
                .get(&key)
                .filter(|(time, _)| time.elapsed() < Duration::from_secs(86400))
            {
                *rate
            } else {
                let response: RatesResponse = self
                    .client
                    .get(format!("{}/{date}", self.url.trim_end_matches('/')))
                    .query(&[("base", currency), ("symbols", &self.base)])
                    .send()
                    .await?
                    .error_for_status()?
                    .json()
                    .await?;
                let rate = *response
                    .rates
                    .get(&self.base)
                    .ok_or_else(|| anyhow::anyhow!("Missing exchange rate"))?;
                cache.insert(key, (Instant::now(), rate));
                rate
            }
        };
        Ok((amount * rate).round_dp_with_strategy(2, RoundingStrategy::MidpointAwayFromZero))
    }
}
