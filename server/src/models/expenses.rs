use sea_orm::entity::prelude::*;
use serde::Serialize;

#[derive(Clone, Debug, PartialEq, DeriveEntityModel, Serialize)]
#[sea_orm(table_name = "expenses", schema_name = "expensetracker")]
#[serde(rename_all = "camelCase")]
pub struct Model {
    #[sea_orm(primary_key)]
    pub id: i64,
    #[sea_orm(column_name = "expense_date")]
    pub date: Option<DateTimeUtc>,
    pub description: Option<String>,
    pub location: Option<String>,
    pub category: Option<String>,
    pub amount: Option<Decimal>,
    pub currency: Option<String>,
    pub converted_amount: Option<Decimal>,
    pub base_currency: Option<String>,
    pub method: Option<String>,
    pub r#type: Option<String>,
    pub comment: Option<String>,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {}
impl ActiveModelBehavior for ActiveModel {}
