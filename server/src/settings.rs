use serde::{Deserialize, Serialize};

#[derive(Clone, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct Settings {
    pub oidc: Oidc,
    pub bank_notification_token: String,
    pub base_currency: String,
    pub exchange_rate_api_url: String,
}

#[derive(Clone, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct Oidc {
    pub issuer: String,
    pub audience: String,
}

impl Settings {
    pub fn validate(&self) -> anyhow::Result<()> {
        anyhow::ensure!(
            [
                &self.oidc.issuer,
                &self.oidc.audience,
                &self.bank_notification_token,
                &self.base_currency
            ]
            .iter()
            .all(|value| !value.trim().is_empty()),
            "OIDC issuer/audience, worker token and base currency must not be empty"
        );
        crate::middleware::auth::validate_endpoint(&self.oidc.issuer)?;
        crate::middleware::auth::validate_endpoint(&self.exchange_rate_api_url)?;
        Ok(())
    }
}
