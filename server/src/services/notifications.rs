use super::{Error, Result, exchange::Exchange};
use crate::models::{expenses, merchant_categories};
use chrono::{DateTime, NaiveDate, NaiveTime, TimeZone, Utc};
use chrono_tz::Europe::Zurich;
use fancy_regex::Regex;
use mail_parser::MessageParser;
use rust_decimal::Decimal;
use sea_orm::{ActiveValue::Set, TransactionTrait, entity::prelude::*};
use serde::Deserialize;

#[derive(Debug, Deserialize)]
pub struct Notification {
    pub from: String,
    pub to: String,
    pub subject: Option<String>,
    pub raw: String,
}

struct Transaction {
    amount: Decimal,
    currency: String,
    merchant: String,
    date: DateTime<Utc>,
}

fn capture(pattern: &str, text: &str) -> Option<String> {
    Regex::new(pattern)
        .expect("valid notification pattern")
        .captures(text)
        .ok()??
        .get(1)
        .map(|v| v.as_str().trim().to_owned())
}

fn replace(pattern: &str, text: &str, replacement: &str) -> String {
    Regex::new(pattern)
        .expect("valid notification pattern")
        .replace_all(text, replacement)
        .into_owned()
}

const AMOUNT: &str = r"\d[\d'’]*(?:[.,]\d{1,2})?";
const DATE: &str =
    r"(\d{2}\.\d{2}\.\d{4}|\d{4}-\d{2}-\d{2})(?:[\sT,]+(?:at\s+|um\s+)?(\d{2}:\d{2}(?::\d{2})?))?";

fn money(text: &str) -> Option<(Decimal, String)> {
    let labeled = capture(
        r"(?im)^[ \t]*(?:amount|betrag|montant|importo)[ \t]*:[ \t]*(.+)$",
        text,
    );
    for text in labeled.as_deref().into_iter().chain(std::iter::once(text)) {
        for (pattern, amount_group, currency_group) in [
            (format!(r"\b([A-Z]{{3}})\s*({AMOUNT})\b"), 2, 1),
            (format!(r"\b({AMOUNT})\s*([A-Z]{{3}})\b"), 1, 2),
        ] {
            let regex = Regex::new(&pattern).expect("valid money pattern");
            for matched in regex.captures_iter(text).flatten() {
                let code = matched.get(currency_group)?.as_str();
                let Some(currency) = iso_currency::Currency::from_code(code) else {
                    continue;
                };
                if currency.exponent().is_none() {
                    continue;
                }
                let value = matched
                    .get(amount_group)?
                    .as_str()
                    .replace(['\'', '’'], "")
                    .replace(',', ".");
                if let Ok(amount) = value.parse() {
                    return Some((amount, code.to_owned()));
                }
            }
        }
    }
    None
}

fn parse(request: &Notification) -> Option<Transaction> {
    let message = MessageParser::default().parse(request.raw.as_bytes())?;
    // Do not use body_html(): it synthesizes HTML from plain text emails.
    let html = message.html_bodies().next()?.text_contents()?;
    let region = capture(
        r"(?s)<!--\s*NOTIFICATION_CONTENT_BEGIN\s*-->(.*?)<!--\s*NOTIFICATION_CONTENT_END\s*-->",
        html,
    )?;
    let text = replace(r"(?is)<(style|script|head)\b[^>]*>.*?</\1>", &region, " ");
    let text = replace(r"(?s)<!--.*?-->", &text, " ");
    let text = replace(
        r"(?i)<br[^>]*>|</(?:p|div|li|td|th|tr|table|h[1-6]|blockquote)>",
        &text,
        "\n",
    );
    let text = replace(r"<[^>]+>", &text, " ")
        .replace("&nbsp;", "\u{a0}")
        .replace("&quot;", "\"")
        .replace("&#39;", "'")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&amp;", "&");
    let text = replace(r"[ \t]+", &text, " ");
    let text = replace(r" ?\n ?", &text, "\n");
    let (amount, currency) = money(&text).or_else(|| request.subject.as_deref().and_then(money))?;
    let money_pattern = format!(r"(?:[A-Z]{{3}}\s*{AMOUNT}|{AMOUNT}\s*[A-Z]{{3}})");
    let merchant = capture(r"(?im)^[ \t]*(?:merchant|h(?:ä|ae)ndler|commer[cç]ant|esercente)[ \t]*:[ \t]*(.+?)[ \t]*$", &text)
        .or_else(|| capture(&format!(r"(?i){money_pattern}\s+(?:at|bei|chez|presso)\s+(.+?)(?=\s+(?:on|am|le|il)\s+\d|\s*[.;\r\n]|\s*$)"), &text))
        .or_else(|| capture(&format!(r#"(?i){money_pattern}\s+(?:has|have)\s+been\s+charged\s+to\s+(?:your\s+)?card\s+"?[0-9Xx*]+"?\.\s*(.+?)(?=\s*\.(?:\s|$)|\s*[;\r\n]|\s*$)"#), &text))
        .filter(|v| !v.is_empty())?;
    let date_text = capture(
        r"(?im)^[ \t]*(?:(?:transaction |purchase )?date|datum|data)[ \t]*:[ \t]*(.+)$",
        &text,
    )
    .or_else(|| capture(&format!(r"(?i)\b(?:on|am|le|il|vom)\s+({DATE})"), &text));
    let date = date_text.as_deref().and_then(parse_date).or_else(|| {
        message
            .date()
            .and_then(|d| DateTime::from_timestamp(d.to_timestamp(), 0))
    })?;
    Some(Transaction {
        amount,
        currency,
        merchant,
        date,
    })
}

fn parse_date(text: &str) -> Option<DateTime<Utc>> {
    let regex = Regex::new(DATE).expect("valid date pattern");
    let matched = regex.captures(text).ok()??;
    let date = matched.get(1)?.as_str();
    let date = NaiveDate::parse_from_str(
        date,
        if date.contains('.') {
            "%d.%m.%Y"
        } else {
            "%Y-%m-%d"
        },
    )
    .ok()?;
    let time = match matched.get(2).map(|v| v.as_str()) {
        Some(value) => NaiveTime::parse_from_str(
            value,
            if value.len() == 5 {
                "%H:%M"
            } else {
                "%H:%M:%S"
            },
        )
        .ok()?,
        None => NaiveTime::MIN,
    };
    Zurich
        .from_local_datetime(&date.and_time(time))
        .earliest()
        .map(|v| v.with_timezone(&Utc))
}

pub async fn store(
    db: &DatabaseConnection,
    exchange: &Exchange,
    request: Notification,
) -> Result<()> {
    if [&request.from, &request.to, &request.raw]
        .iter()
        .any(|v| v.trim().is_empty())
    {
        return Err(Error::Invalid);
    }
    let transaction = parse(&request).ok_or_else(|| {
        tracing::error!(from = %request.from, to = %request.to, subject = ?request.subject, raw = %request.raw, "Unrecognized bank notification");
        Error::Unprocessable
    })?;
    let converted = exchange
        .convert(
            transaction.amount,
            &transaction.currency,
            transaction.date.with_timezone(&Zurich).date_naive(),
        )
        .await?;
    let txn = db.begin().await?;
    let existing = expenses::Entity::find()
        .filter(expenses::Column::Description.eq(&transaction.merchant))
        .all(&txn)
        .await?;
    if existing.iter().any(|e| {
        e.date
            .is_some_and(|d| d.date_naive() == transaction.date.date_naive())
            && e.amount
                .is_some_and(|a| a.trunc() == transaction.amount.trunc())
    }) {
        tracing::info!(merchant = %transaction.merchant, "Duplicate notification skipped");
        return Ok(());
    }
    let category = merchant_categories::Entity::find()
        .filter(merchant_categories::Column::Merchant.eq(&transaction.merchant))
        .one(&txn)
        .await?
        .map(|m| m.category)
        .unwrap_or_default();
    expenses::ActiveModel {
        date: Set(Some(transaction.date)),
        description: Set(Some(transaction.merchant)),
        amount: Set(Some(transaction.amount)),
        currency: Set(Some(transaction.currency)),
        converted_amount: Set(Some(converted)),
        base_currency: Set(Some(exchange.base.clone())),
        category: Set(Some(category)),
        location: Set(Some(String::new())),
        comment: Set(Some(String::new())),
        method: Set(Some("Card payment".into())),
        r#type: Set(Some("Expense".into())),
        ..Default::default()
    }
    .insert(&txn)
    .await?;
    txn.commit().await?;
    tracing::info!(from = %request.from, subject = ?request.subject, "Bank notification stored");
    Ok(())
}
