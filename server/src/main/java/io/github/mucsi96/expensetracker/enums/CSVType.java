package io.github.mucsi96.expensetracker.enums;

import lombok.Getter;
import lombok.RequiredArgsConstructor;

@Getter
@RequiredArgsConstructor
public enum CSVType {
  CARD_STATEMENT(
      "Account number;Card number;Account/Cardholder;Purchase date;Booking text;Sector;Amount;Original currency;Rate;Currency;Debit;Credit;Booked"),
  ACCOUNT_STATEMENT(
      "Trade date;Trade time;Booking date;Value date;Currency;Debit;Credit;Individual amount;Balance;Transaction no.;Description1;Description2;Description3;Footnotes;");

  private final String header;
}
