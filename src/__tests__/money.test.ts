import { describe, it, expect } from 'vitest';
import { Money } from '../domain/value-objects.js';
import { InvalidCurrencyError, InvalidMoneyAmountError } from '../domain/errors.js';

describe('Money', () => {
  describe('fromDecimalString', () => {
    it('convierte "19.99" USD a 1999 centavos', () => {
      const money = Money.fromDecimalString('19.99', 'USD');
      expect(money.toCents()).toBe(1999);
      expect(money.toDecimalString()).toBe('19.99');
      expect(money.toCurrencyCode()).toBe('USD');
    });

    it('convierte "0.00" USD a 0 centavos', () => {
      const money = Money.fromDecimalString('0.00', 'USD');
      expect(money.toCents()).toBe(0);
    });

    it('redondea correctamente', () => {
      const money = Money.fromDecimalString('10.999', 'USD');
      expect(money.toCents()).toBe(1100);
    });

    it('lanza InvalidCurrencyError para moneda no soportada', () => {
      expect(() => Money.fromDecimalString('10.00', 'XYZ')).toThrow(InvalidCurrencyError);
    });

    it('lanza InvalidMoneyAmountError para string inválido', () => {
      expect(() => Money.fromDecimalString('abc', 'USD')).toThrow(InvalidMoneyAmountError);
    });

    it('lanza InvalidMoneyAmountError para NaN', () => {
      expect(() => Money.fromDecimalString('', 'USD')).toThrow(InvalidMoneyAmountError);
    });
  });

  describe('fromCents', () => {
    it('crea Money desde centavos', () => {
      const money = Money.fromCents(1999, 'USD');
      expect(money.toCents()).toBe(1999);
      expect(money.toDecimalString()).toBe('19.99');
    });

    it('lanza InvalidCurrencyError para moneda no soportada', () => {
      expect(() => Money.fromCents(100, 'XYZ')).toThrow(InvalidCurrencyError);
    });
  });

  describe('operaciones aritméticas', () => {
    it('add suma correctamente', () => {
      const a = Money.fromCents(1000, 'USD');
      const b = Money.fromCents(500, 'USD');
      const result = a.add(b);
      expect(result.toCents()).toBe(1500);
    });

    it('subtract resta correctamente', () => {
      const a = Money.fromCents(1000, 'USD');
      const b = Money.fromCents(300, 'USD');
      const result = a.subtract(b);
      expect(result.toCents()).toBe(700);
    });

    it('multiply multiplica correctamente', () => {
      const a = Money.fromCents(1000, 'USD');
      const result = a.multiply(3);
      expect(result.toCents()).toBe(3000);
    });

    it('equals compara dos montos', () => {
      const a = Money.fromCents(1000, 'USD');
      const b = Money.fromCents(1000, 'USD');
      const c = Money.fromCents(2000, 'USD');
      expect(a.equals(b)).toBe(true);
      expect(a.equals(c)).toBe(false);
    });
  });

  describe('monedas soportadas', () => {
    it('soporta PEN', () => {
      const money = Money.fromDecimalString('50.00', 'PEN');
      expect(money.toCents()).toBe(5000);
    });

    it('soporta COP', () => {
      const money = Money.fromDecimalString('1000.00', 'COP');
      expect(money.toCents()).toBe(100000);
    });

    it('soporta MXN', () => {
      const money = Money.fromDecimalString('250.50', 'MXN');
      expect(money.toCents()).toBe(25050);
    });
  });
});
