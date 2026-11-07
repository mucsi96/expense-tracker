use super::{Error, Result};
use crate::models::{categories, expenses, merchant_categories};
use sea_orm::IntoActiveModel;
use sea_orm::{
    ActiveValue::Set,
    Order, QueryOrder, TransactionTrait,
    entity::prelude::*,
    sea_query::{NullOrdering, OnConflict},
};

pub async fn list(db: &DatabaseConnection) -> Result<Vec<expenses::Model>> {
    Ok(expenses::Entity::find()
        .order_by_with_nulls(expenses::Column::Date, Order::Desc, NullOrdering::Last)
        .all(db)
        .await?)
}

pub async fn delete(db: &DatabaseConnection) -> Result<()> {
    expenses::Entity::delete_many().exec(db).await?;
    Ok(())
}

pub async fn categorize(
    db: &DatabaseConnection,
    id: i64,
    category: Option<String>,
) -> Result<expenses::Model> {
    let category = category.ok_or(Error::Unprocessable)?;
    let txn = db.begin().await?;
    if categories::Entity::find()
        .filter(categories::Column::Name.eq(&category))
        .one(&txn)
        .await?
        .is_none()
    {
        return Err(Error::Unprocessable);
    }
    let expense = expenses::Entity::find_by_id(id)
        .one(&txn)
        .await?
        .ok_or(Error::NotFound)?;
    if let Some(merchant) = expense
        .description
        .as_ref()
        .filter(|v| !v.trim().is_empty())
    {
        merchant_categories::Entity::insert(merchant_categories::ActiveModel {
            merchant: Set(merchant.clone()),
            category: Set(category.clone()),
            ..Default::default()
        })
        .on_conflict(
            OnConflict::column(merchant_categories::Column::Merchant)
                .update_column(merchant_categories::Column::Category)
                .to_owned(),
        )
        .exec(&txn)
        .await?;
        expenses::Entity::update_many()
            .col_expr(expenses::Column::Category, Expr::value(&category))
            .filter(expenses::Column::Description.eq(merchant))
            .exec(&txn)
            .await?;
    }
    let mut model = expense.into_active_model();
    model.category = Set(Some(category));
    let saved = model.update(&txn).await?;
    txn.commit().await?;
    Ok(saved)
}
