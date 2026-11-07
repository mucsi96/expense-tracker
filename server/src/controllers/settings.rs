use crate::services::{
    Result,
    exchange::Exchange,
    settings::{self, SettingsInput, SettingsResponse},
};
use axum::{
    Extension, Json,
    extract::{State, rejection::JsonRejection},
};
use loco_rs::{app::AppContext, controller::Routes};

async fn get(
    State(ctx): State<AppContext>,
    Extension(exchange): Extension<Exchange>,
) -> Result<Json<SettingsResponse>> {
    Ok(Json(settings::get(&ctx.db, &exchange.base).await?))
}
async fn update(
    State(ctx): State<AppContext>,
    Extension(exchange): Extension<Exchange>,
    input: std::result::Result<Json<SettingsInput>, JsonRejection>,
) -> Result<Json<SettingsResponse>> {
    Ok(Json(
        settings::update(&ctx.db, &exchange.base, super::payload(input)?).await?,
    ))
}
pub fn routes() -> Routes {
    Routes::at("/api/settings").get("/", get).put("/", update)
}
