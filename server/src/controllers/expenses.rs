use crate::{
    models::expenses::Model,
    services::{Result, expenses},
};
use axum::{
    Json,
    extract::{Path, State, rejection::JsonRejection},
};
use loco_rs::{app::AppContext, controller::Routes};
use serde::Deserialize;

#[derive(Deserialize)]
struct CategoryInput {
    category: Option<String>,
}

async fn list(State(ctx): State<AppContext>) -> Result<Json<Vec<Model>>> {
    Ok(Json(expenses::list(&ctx.db).await?))
}
async fn delete(State(ctx): State<AppContext>) -> Result<()> {
    expenses::delete(&ctx.db).await
}
async fn categorize(
    State(ctx): State<AppContext>,
    Path(id): Path<i64>,
    input: std::result::Result<Json<CategoryInput>, JsonRejection>,
) -> Result<Json<Model>> {
    Ok(Json(
        expenses::categorize(&ctx.db, id, super::payload(input)?.category).await?,
    ))
}
pub fn routes() -> Routes {
    Routes::at("/api/expenses")
        .get("/", list)
        .delete("/", delete)
        .put("/{id}/category", categorize)
}
