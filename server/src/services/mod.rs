pub mod categories;
pub mod exchange;
pub mod expenses;
pub mod notifications;
pub mod settings;

use axum::{
    http::StatusCode,
    response::{IntoResponse, Response},
};

#[derive(Debug, thiserror::Error)]
pub enum Error {
    #[error("Invalid request")]
    Invalid,
    #[error("Not found")]
    NotFound,
    #[error("Category already exists")]
    Conflict,
    #[error("Unknown category or unrecognized notification")]
    Unprocessable,
    #[error(transparent)]
    Database(#[from] sea_orm::DbErr),
    #[error(transparent)]
    Internal(#[from] anyhow::Error),
}

impl IntoResponse for Error {
    fn into_response(self) -> Response {
        let status = match &self {
            Self::Invalid => StatusCode::BAD_REQUEST,
            Self::NotFound => StatusCode::NOT_FOUND,
            Self::Conflict => StatusCode::CONFLICT,
            Self::Unprocessable => StatusCode::UNPROCESSABLE_ENTITY,
            Self::Database(error)
                if matches!(
                    error.sql_err(),
                    Some(sea_orm::SqlErr::UniqueConstraintViolation(_))
                ) =>
            {
                StatusCode::CONFLICT
            }
            _ => {
                tracing::error!(error = %self, "Request failed");
                StatusCode::INTERNAL_SERVER_ERROR
            }
        };
        status.into_response()
    }
}

pub type Result<T> = std::result::Result<T, Error>;
