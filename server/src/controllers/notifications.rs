use crate::services::{
    Result,
    exchange::Exchange,
    notifications::{self, Notification},
};
use axum::{
    Extension, Json,
    extract::{State, rejection::JsonRejection},
    http::StatusCode,
};
use loco_rs::{app::AppContext, controller::Routes};

async fn receive(
    State(ctx): State<AppContext>,
    Extension(exchange): Extension<Exchange>,
    input: std::result::Result<Json<Notification>, JsonRejection>,
) -> Result<StatusCode> {
    notifications::store(&ctx.db, &exchange, super::payload(input)?).await?;
    Ok(StatusCode::NO_CONTENT)
}
pub fn routes() -> Routes {
    Routes::at("/api/bank-notifications").post("/", receive)
}
