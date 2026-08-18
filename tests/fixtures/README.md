# Test fixtures

Every fixture here is **synthetic**. Real customer bank statements must never be
committed to this repository (spec §29).

## Layout

```
fixtures/
  generic/
    statement-01.csv        the file the parser reads
    statement-01.expected.json   what it must produce
```

Each `*.expected.json` records the numbers a parse has to reproduce exactly:

```json
{
  "transactionCount": 12,
  "openingBalance": 125000,
  "closingBalance": 189500,
  "totalDebits": 41200,
  "totalCredits": 105700,
  "parseStatus": "VALID",
  "firstTransaction": { "date": "2025-04-01", "debit": 0, "credit": 50000 }
}
```

## Adding a bank adapter

Bank adapters in `lib/bankStatement/parser/banks/` ship with
`validated: false` and are **not** trusted to parse real statements. Promoting
one is a four-step process, in this order:

1. **Obtain anonymised statements** from real users of that bank. Replace the
   account holder name, account number, address, IFSC and any transaction
   references that identify a counterparty — but preserve the layout, the column
   positions, the page breaks, the narration structure, the debit/credit
   formatting and the balance behaviour. A fixture that has been "tidied up" is
   worse than no fixture, because it proves the parser works on a file that does
   not exist.
2. **Add them here** under `fixtures/<bank>/`, with an expected-output JSON
   built by reading the statement by hand — not by running the parser and
   recording whatever it happened to produce.
3. **Make the golden test pass** for that bank.
4. **Only then** flip `validated: true` in the adapter.

Until step 4, the tool tells the CA that the file was read with the generic
layout engine and that the bank-specific parser is unverified. That message is
the product working correctly, not a gap to paper over.
