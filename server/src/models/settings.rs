use sea_orm::entity::prelude::*;

#[derive(Clone, Debug, PartialEq, DeriveEntityModel)]
#[sea_orm(table_name = "settings", schema_name = "expensetracker")]
pub struct Model {
    #[sea_orm(primary_key)]
    pub id: i64,
    pub closing_day: i32,
    pub monthly_budget: Decimal,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {}
impl ActiveModelBehavior for ActiveModel {}
