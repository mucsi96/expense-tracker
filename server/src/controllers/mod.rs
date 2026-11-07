pub mod categories;
pub mod expenses;
pub mod notifications;
pub mod settings;

use crate::services::{Error, Result};
use axum::{Json, extract::rejection::JsonRejection};

fn payload<T>(value: std::result::Result<Json<T>, JsonRejection>) -> Result<T> {
    value.map(|Json(value)| value).map_err(|_| Error::Invalid)
}
