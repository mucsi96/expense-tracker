use super::{Error, Result};
use crate::models::{categories, expenses, merchant_categories};
use sea_orm::IntoActiveModel;
use sea_orm::{ActiveValue::Set, QueryOrder, TransactionTrait, entity::prelude::*};
use serde::Deserialize;

#[derive(Deserialize)]
pub struct CategoryInput {
    pub name: Option<String>,
    pub emoji: Option<String>,
    pub description: Option<String>,
}

fn normalized(value: Option<String>) -> Option<String> {
    value.map(|v| v.trim().to_owned()).filter(|v| !v.is_empty())
}

pub async fn list(db: &DatabaseConnection) -> Result<Vec<categories::Model>> {
    Ok(categories::Entity::find()
        .order_by_asc(categories::Column::Name)
        .all(db)
        .await?)
}

pub async fn save(
    db: &DatabaseConnection,
    id: Option<i64>,
    input: CategoryInput,
) -> Result<categories::Model> {
    let name = normalized(input.name).ok_or(Error::Invalid)?;
    let txn = db.begin().await?;
    let mut model = if let Some(id) = id {
        let existing = categories::Entity::find_by_id(id)
            .one(&txn)
            .await?
            .ok_or(Error::NotFound)?;
        if existing.name != name {
            expenses::Entity::update_many()
                .col_expr(expenses::Column::Category, Expr::value(&name))
                .filter(expenses::Column::Category.eq(&existing.name))
                .exec(&txn)
                .await?;
            merchant_categories::Entity::update_many()
                .col_expr(merchant_categories::Column::Category, Expr::value(&name))
                .filter(merchant_categories::Column::Category.eq(&existing.name))
                .exec(&txn)
                .await?;
        }
        existing.into_active_model()
    } else {
        Default::default()
    };
    model.name = Set(name);
    model.emoji = Set(normalized(input.emoji));
    model.description = Set(normalized(input.description));
    let saved = if id.is_some() {
        model.update(&txn).await?
    } else {
        model.insert(&txn).await?
    };
    txn.commit().await?;
    Ok(saved)
}

pub async fn delete(db: &DatabaseConnection, id: i64) -> Result<()> {
    let txn = db.begin().await?;
    let category = categories::Entity::find_by_id(id)
        .one(&txn)
        .await?
        .ok_or(Error::NotFound)?;
    merchant_categories::Entity::delete_many()
        .filter(merchant_categories::Column::Category.eq(category.name))
        .exec(&txn)
        .await?;
    categories::Entity::delete_by_id(id).exec(&txn).await?;
    txn.commit().await?;
    Ok(())
}
