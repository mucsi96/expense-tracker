use crate::{
    models::categories::Model,
    services::{
        Result,
        categories::{self, CategoryInput},
    },
};
use axum::http::StatusCode;
use axum::{
    Json,
    extract::{Path, State, rejection::JsonRejection},
};
use loco_rs::{app::AppContext, controller::Routes};

async fn list(State(ctx): State<AppContext>) -> Result<Json<Vec<Model>>> {
    Ok(Json(categories::list(&ctx.db).await?))
}
async fn create(
    State(ctx): State<AppContext>,
    input: std::result::Result<Json<CategoryInput>, JsonRejection>,
) -> Result<(StatusCode, Json<Model>)> {
    Ok((
        StatusCode::CREATED,
        Json(categories::save(&ctx.db, None, super::payload(input)?).await?),
    ))
}
async fn update(
    State(ctx): State<AppContext>,
    Path(id): Path<i64>,
    input: std::result::Result<Json<CategoryInput>, JsonRejection>,
) -> Result<Json<Model>> {
    Ok(Json(
        categories::save(&ctx.db, Some(id), super::payload(input)?).await?,
    ))
}
async fn delete(State(ctx): State<AppContext>, Path(id): Path<i64>) -> Result<()> {
    categories::delete(&ctx.db, id).await
}
pub fn routes() -> Routes {
    Routes::at("/api/categories")
        .get("/", list)
        .post("/", create)
        .put("/{id}", update)
        .delete("/{id}", delete)
}
