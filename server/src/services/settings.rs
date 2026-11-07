use super::{Error, Result};
use crate::models::settings;
use rust_decimal::Decimal;
use sea_orm::IntoActiveModel;
use sea_orm::{ActiveValue::Set, entity::prelude::*};
use serde::{Deserialize, Serialize};

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SettingsInput {
    pub closing_day: Option<i32>,
    pub monthly_budget: Option<Decimal>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SettingsResponse {
    closing_day: i32,
    monthly_budget: Decimal,
    base_currency: String,
}

async fn require(db: &DatabaseConnection) -> Result<settings::Model> {
    settings::Entity::find()
        .one(db)
        .await?
        .ok_or_else(|| Error::Internal(anyhow::anyhow!("Settings row is missing")))
}

fn response(model: settings::Model, base_currency: &str) -> SettingsResponse {
    SettingsResponse {
        closing_day: model.closing_day,
        monthly_budget: model.monthly_budget,
        base_currency: base_currency.into(),
    }
}

pub async fn get(db: &DatabaseConnection, base: &str) -> Result<SettingsResponse> {
    Ok(response(require(db).await?, base))
}

pub async fn update(
    db: &DatabaseConnection,
    base: &str,
    input: SettingsInput,
) -> Result<SettingsResponse> {
    let day = input
        .closing_day
        .filter(|v| (1..=31).contains(v))
        .ok_or(Error::Invalid)?;
    let mut model = require(db).await?.into_active_model();
    model.closing_day = Set(day);
    if let Some(budget) = input.monthly_budget {
        if budget < Decimal::ZERO
            || budget > Decimal::new(99999999999, 2)
            || budget.normalize().scale() > 2
        {
            return Err(Error::Invalid);
        }
        model.monthly_budget = Set(budget);
    }
    Ok(response(model.update(db).await?, base))
}
