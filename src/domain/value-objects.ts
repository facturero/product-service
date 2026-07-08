import { dinero, add, subtract, multiply, toDecimal, toSnapshot, haveSameCurrency, type Dinero } from 'dinero.js';
import { USD, EUR, COP, PEN, MXN, type DineroCurrency } from 'dinero.js/currencies';
import { InvalidCurrencyError, InvalidMoneyAmountError } from './errors.js';

const SUPPORTED: Record<string, DineroCurrency<number>> = { USD, EUR, COP, PEN, MXN };

export class Money {
  private constructor(private readonly d: Dinero<number>) {}

  static fromCents(cents: number, currencyCode: string): Money {
    const currency = SUPPORTED[currencyCode];
    if (!currency) throw new InvalidCurrencyError(currencyCode);
    return new Money(dinero({ amount: cents, currency }));
  }

  static fromDecimalString(value: string, currencyCode: string): Money {
    const currency = SUPPORTED[currencyCode];
    if (!currency) throw new InvalidCurrencyError(currencyCode);
    const num = parseFloat(value);
    if (isNaN(num) || !isFinite(num)) throw new InvalidMoneyAmountError();
    const cents = Math.round(num * 10 ** currency.exponent);
    return new Money(dinero({ amount: cents, currency }));
  }

  add(other: Money): Money {
    if (!haveSameCurrency([this.d, other.d])) throw new Error('Moneda diferente.');
    return new Money(add(this.d, other.d));
  }

  subtract(other: Money): Money {
    if (!haveSameCurrency([this.d, other.d])) throw new Error('Moneda diferente.');
    return new Money(subtract(this.d, other.d));
  }

  multiply(multiplier: number): Money {
    return new Money(multiply(this.d, multiplier));
  }

  toCents(): number {
    return toSnapshot(this.d).amount;
  }

  toCurrencyCode(): string {
    return toSnapshot(this.d).currency.code;
  }

  toDecimalString(): string {
    return toDecimal(this.d);
  }

  equals(other: Money): boolean {
    const a = toSnapshot(this.d);
    const b = toSnapshot(other.d);
    return a.amount === b.amount && a.currency.code === b.currency.code;
  }
}
